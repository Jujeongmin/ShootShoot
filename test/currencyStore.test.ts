import { describe, it, expect } from 'vitest';
import { createCurrencyStore } from '../game/src/gameplay/currencyStore';
import { createMemoryStorage } from './helpers/memoryStorage';

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

  it('spend() deducts and returns true when the balance is sufficient', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(500);
    expect(store.spend(200)).toBe(true);
    expect(store.get()).toBe(300);
  });

  it('spend() allows spending the exact balance', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(500);
    expect(store.spend(500)).toBe(true);
    expect(store.get()).toBe(0);
  });

  it('spend() returns false and changes nothing when the balance is short', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(100);
    expect(store.spend(101)).toBe(false);
    expect(store.get()).toBe(100);
  });
});
