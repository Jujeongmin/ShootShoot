import { describe, it, expect } from 'vitest';
import { createTutorialStore } from '../game/src/gameplay/tutorialStore';
import { createMemoryStorage } from './helpers/memoryStorage';

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
