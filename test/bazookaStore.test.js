import { describe, it, expect } from 'vitest';
import { createBazookaStore } from '../game/src/gameplay/bazookaStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createBazookaStore', () => {
  it('returns 0 when nothing stored', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.getRounds()).toBe(0);
  });

  it('refill() sets rounds to the given max and returns it', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.refill(5)).toBe(5);
    expect(store.getRounds()).toBe(5);
  });

  it('consumeRound() decrements and returns the new value', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    store.refill(5);
    expect(store.consumeRound()).toBe(4);
    expect(store.getRounds()).toBe(4);
  });

  it('consumeRound() never goes below 0', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.consumeRound()).toBe(0);
    expect(store.consumeRound()).toBe(0);
  });

  it('reset() forces rounds to 0 and returns 0', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    store.refill(5);
    expect(store.reset()).toBe(0);
    expect(store.getRounds()).toBe(0);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createBazookaStore(storage, 'test.bazooka');
    first.refill(5);
    first.consumeRound();
    const second = createBazookaStore(storage, 'test.bazooka');
    expect(second.getRounds()).toBe(4);
  });

  it('recovers from a malformed stored value', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.bazooka', 'not-a-number');
    const store = createBazookaStore(storage, 'test.bazooka');
    expect(store.getRounds()).toBe(0);
  });
});
