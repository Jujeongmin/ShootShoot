import { describe, it, expect } from 'vitest';
import { createTutorialStore } from '../game/src/gameplay/tutorialStore';

// 다른 스토어 테스트의 가짜 storage 에는 removeItem 이 없다. clear() 가 그것을
// 쓰므로 여기서는 셋을 다 갖춘다. 실제 Storage 인터페이스(length, clear, key
// 포함) 전체를 채워야 createTutorialStore(storage: Storage, ...)에 그대로
// 넘길 수 있다.
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

describe('createTutorialStore', () => {
  it('is not done when nothing is stored', () => {
    const store = createTutorialStore(createMemoryStorage(), 'test.tutorial');
    expect(store.isDone()).toBe(false);
  });

  it('is done after markDone()', () => {
    const store = createTutorialStore(createMemoryStorage(), 'test.tutorial');
    store.markDone();
    expect(store.isDone()).toBe(true);
  });

  it('is not done again after clear()', () => {
    const store = createTutorialStore(createMemoryStorage(), 'test.tutorial');
    store.markDone();
    store.clear();
    expect(store.isDone()).toBe(false);
  });

  it('treats any other stored value as not done', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.tutorial', 'yes');
    const store = createTutorialStore(storage, 'test.tutorial');
    expect(store.isDone()).toBe(false);
  });

  it('markDone() twice leaves it done', () => {
    const store = createTutorialStore(createMemoryStorage(), 'test.tutorial');
    store.markDone();
    store.markDone();
    expect(store.isDone()).toBe(true);
  });
});
