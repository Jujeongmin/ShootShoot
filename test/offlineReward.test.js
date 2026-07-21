import { describe, it, expect } from 'vitest';
import { calculateOfflineGold, createLastSeenStore } from '../game/src/gameplay/offlineReward.js';
import { CONFIG } from '../game/src/config.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('calculateOfflineGold', () => {
  it('returns 0 for zero or negative elapsed time', () => {
    expect(calculateOfflineGold(0, CONFIG.offlineReward)).toBe(0);
    expect(calculateOfflineGold(-1000, CONFIG.offlineReward)).toBe(0);
  });

  it('computes gold proportional to elapsed hours', () => {
    expect(calculateOfflineGold(60 * 60 * 1000, CONFIG.offlineReward)).toBe(10);
    expect(calculateOfflineGold(30 * 60 * 1000, CONFIG.offlineReward)).toBe(5);
  });

  it('caps at maxHours', () => {
    expect(calculateOfflineGold(10 * 60 * 60 * 1000, CONFIG.offlineReward)).toBe(80);
  });
});

describe('createLastSeenStore', () => {
  it('returns null when nothing stored', () => {
    const store = createLastSeenStore(createMemoryStorage(), 'test.lastseen');
    expect(store.get()).toBeNull();
  });

  it('set()/get() round trip', () => {
    const store = createLastSeenStore(createMemoryStorage(), 'test.lastseen');
    store.set(12345);
    expect(store.get()).toBe(12345);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const store1 = createLastSeenStore(storage, 'test.lastseen');
    store1.set(99999);
    const store2 = createLastSeenStore(storage, 'test.lastseen');
    expect(store2.get()).toBe(99999);
  });
});
