import { describe, it, expect } from 'vitest';
import { createUpgradeStore, computeUpgradeCost } from '../game/src/gameplay/upgradeStore.js';
import { CONFIG } from '../game/src/config.js';

function createMemoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('computeUpgradeCost', () => {
  it('returns baseCost at level 0', () => {
    expect(computeUpgradeCost(0, CONFIG.damageUpgrade)).toBe(50);
    expect(computeUpgradeCost(0, CONFIG.offlineUpgrade)).toBe(80);
  });

  it('grows by costMultiplier each level', () => {
    const level1 = computeUpgradeCost(1, CONFIG.damageUpgrade);
    const level2 = computeUpgradeCost(2, CONFIG.damageUpgrade);
    expect(level1).toBe(Math.round(50 * 1.15));
    expect(level2).toBe(Math.round(50 * 1.15 ** 2));
    expect(level2).toBeGreaterThan(level1);
  });

  it('keeps rising with no cap at high levels', () => {
    const low = computeUpgradeCost(5, CONFIG.offlineUpgrade);
    const high = computeUpgradeCost(50, CONFIG.offlineUpgrade);
    expect(high).toBeGreaterThan(low);
  });
});

describe('createUpgradeStore', () => {
  it('defaults both levels to 0 when nothing stored', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('levelUpDamage() increments only the damage level and returns the new level', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.levelUpDamage()).toBe(1);
    expect(store.levelUpDamage()).toBe(2);
    expect(store.getDamageLevel()).toBe(2);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('levelUpOffline() increments only the offline level and returns the new level', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.levelUpOffline()).toBe(1);
    expect(store.getOfflineLevel()).toBe(1);
    expect(store.getDamageLevel()).toBe(0);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createUpgradeStore(storage, 'test.upgrades');
    first.levelUpDamage();
    first.levelUpOffline();
    first.levelUpOffline();

    const second = createUpgradeStore(storage, 'test.upgrades');
    expect(second.getDamageLevel()).toBe(1);
    expect(second.getOfflineLevel()).toBe(2);
  });

  it('recovers from malformed stored JSON', () => {
    const store = createUpgradeStore(createMemoryStorage({ 'test.upgrades': '{not json' }), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('recovers from a stored value with non-integer levels', () => {
    const stored = JSON.stringify({ damageLevel: 'three', offlineLevel: null });
    const store = createUpgradeStore(createMemoryStorage({ 'test.upgrades': stored }), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });
});
