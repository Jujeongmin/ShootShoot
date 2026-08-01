import { describe, it, expect } from 'vitest';
import { createSettingsStore } from '../game/src/gameplay/settingsStore';
import { createMemoryStorage } from './helpers/memoryStorage';

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
