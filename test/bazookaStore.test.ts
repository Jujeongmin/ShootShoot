import { describe, it, expect } from 'vitest';
import { createBazookaStore } from '../game/src/gameplay/bazookaStore';

// 실제 Storage 인터페이스 전체(length, clear, key, removeItem 포함)를 갖춰야
// createBazookaStore(storage: Storage, ...)에 그대로 넘길 수 있다.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
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
