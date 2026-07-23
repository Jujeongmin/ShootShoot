import { describe, it, expect } from 'vitest';
import { createWeaponStore } from '../game/src/gameplay/weaponStore.js';

function createMemoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createWeaponStore', () => {
  it('defaults to owning and equipping only the basic weapon', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    expect(store.getEquipped()).toBe('basic');
    expect(store.getOwned()).toEqual(['basic']);
    expect(store.isOwned('basic')).toBe(true);
    expect(store.isOwned('sniper')).toBe(false);
  });

  it('markOwned() accumulates weapons without changing what is equipped', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    store.markOwned('assault');
    store.markOwned('sniper');
    expect(store.getOwned()).toEqual(['basic', 'assault', 'sniper']);
    expect(store.getEquipped()).toBe('basic');
  });

  it('markOwned() is idempotent', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    store.markOwned('assault');
    store.markOwned('assault');
    expect(store.getOwned()).toEqual(['basic', 'assault']);
  });

  it('equip() succeeds only for owned weapons', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    expect(store.equip('sniper')).toBe(false);
    expect(store.getEquipped()).toBe('basic');

    store.markOwned('sniper');
    expect(store.equip('sniper')).toBe(true);
    expect(store.getEquipped()).toBe('sniper');
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createWeaponStore(storage, 'test.weapons');
    first.markOwned('raygun');
    first.equip('raygun');

    const second = createWeaponStore(storage, 'test.weapons');
    expect(second.getOwned()).toEqual(['basic', 'raygun']);
    expect(second.getEquipped()).toBe('raygun');
  });

  it('recovers from malformed stored JSON', () => {
    const store = createWeaponStore(createMemoryStorage({ 'test.weapons': '{not json' }), 'test.weapons');
    expect(store.getOwned()).toEqual(['basic']);
    expect(store.getEquipped()).toBe('basic');
  });

  it('recovers when the stored equipped weapon is not owned', () => {
    const stored = JSON.stringify({ owned: ['basic'], equipped: 'raygun' });
    const store = createWeaponStore(createMemoryStorage({ 'test.weapons': stored }), 'test.weapons');
    expect(store.getEquipped()).toBe('basic');
  });
});
