import { describe, it, expect } from 'vitest';
import { createProgressStore } from '../game/src/gameplay/progressStore';

// 실제 Storage 인터페이스 전체(length, clear, key 포함)를 갖춰야
// createProgressStore(storage: Storage, ...)에 그대로 넘길 수 있다.
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

describe('createProgressStore', () => {
  it('returns round 1 when nothing is stored', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    expect(store.getReachedRound()).toBe(1);
  });

  it('submitCleared(n) makes the next round the reached round', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    expect(store.submitCleared(3)).toBe(4);
    expect(store.getReachedRound()).toBe(4);
  });

  it('keeps the highest reached round when a lower round is cleared again', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    store.submitCleared(9);
    expect(store.submitCleared(1)).toBe(10);
    expect(store.getReachedRound()).toBe(10);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    createProgressStore(storage, 'test.progress').submitCleared(5);
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(6);
  });

  it('clear() drops back to round 1', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    store.submitCleared(7);
    store.clear();
    expect(store.getReachedRound()).toBe(1);
  });

  it('falls back to round 1 when the stored value is not a number', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.progress', 'abc');
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(1);
  });

  it('falls back to round 1 when the stored value is below the first round', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.progress', '0');
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(1);
  });
});
