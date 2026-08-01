import { describe, it, expect } from 'vitest';
import { createSettingsStore } from '../game/src/gameplay/settingsStore';

// 실제 Storage 인터페이스 전체(length, clear, key, removeItem 포함)를 갖춰야
// createSettingsStore(storage: Storage, ...)에 그대로 넘길 수 있다.
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

describe('createSettingsStore', () => {
  it('returns default sensitivity when nothing stored', () => {
    const store = createSettingsStore(createMemoryStorage(), 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });

  it('persists and retrieves a set sensitivity', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage, 'test.settings');
    store.set({ sensitivity: 1.5 });
    expect(store.get()).toEqual({ sensitivity: 1.5 });
  });

  it('falls back to default when stored value is corrupted JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.settings', 'not valid json{{{');
    const store = createSettingsStore(storage, 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });

  it('falls back to default sensitivity when stored value has the wrong type', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.settings', JSON.stringify({ sensitivity: 'fast' }));
    const store = createSettingsStore(storage, 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });
});
