import { describe, it, expect } from 'vitest';
import { calculateOfflineGold, createLastSeenStore } from '../game/src/gameplay/offlineReward';
import { CONFIG } from '../game/src/config';

// 실제 Storage 인터페이스 전체(length, clear, key, removeItem 포함)를 갖춰야
// createLastSeenStore(storage: Storage, ...)에 그대로 넘길 수 있다.
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
