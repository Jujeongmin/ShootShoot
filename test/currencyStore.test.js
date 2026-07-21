import { describe, it, expect } from 'vitest';
import { createCurrencyStore } from '../game/src/gameplay/currencyStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createCurrencyStore', () => {
  it('returns 0 when nothing stored', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    expect(store.get()).toBe(0);
  });

  it('earn() adds to the stored total and returns the new total', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    expect(store.earn(50)).toBe(50);
    expect(store.get()).toBe(50);
  });

  it('earn() accumulates across multiple calls', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(30);
    store.earn(20);
    expect(store.get()).toBe(50);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const store1 = createCurrencyStore(storage, 'test.gold');
    store1.earn(75);
    const store2 = createCurrencyStore(storage, 'test.gold');
    expect(store2.get()).toBe(75);
  });
});
