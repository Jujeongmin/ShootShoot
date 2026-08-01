import { describe, it, expect } from 'vitest';
import { dataKeysToClear, clearGameData } from '../game/src/gameplay/gameReset';
import { CONFIG } from '../game/src/config';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe('dataKeysToClear', () => {
  it('picks every storage key out of a config', () => {
    const config = {
      scorePerGold: 10,
      goldStorageKey: 'test.gold',
      weaponStorageKey: 'test.weapons',
      highScoreStorageKey: 'test.highscore',
      settingsStorageKey: 'test.settings',
    };
    expect(dataKeysToClear(config).sort()).toEqual(['test.gold', 'test.weapons']);
  });

  it('never includes the high score key', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.highScoreStorageKey);
  });

  it('never includes the settings key', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.settingsStorageKey);
  });

  it('includes the real gold, weapon, upgrade, bazooka, tutorial and progress keys', () => {
    const keys = dataKeysToClear(CONFIG);
    expect(keys).toContain(CONFIG.currencyStorageKey);
    expect(keys).toContain(CONFIG.weaponStorageKey);
    expect(keys).toContain(CONFIG.upgradeStorageKey);
    expect(keys).toContain(CONFIG.bazookaStorageKey);
    expect(keys).toContain(CONFIG.tutorialStorageKey);
    expect(keys).toContain(CONFIG.progressStorageKey);
  });

  it('ignores config entries that are not storage keys', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.scorePerGold);
  });

  it('wipes the last-seen timestamp so a new game has no offline reward history', () => {
    expect(dataKeysToClear(CONFIG)).toContain(CONFIG.lastSeenStorageKey);
  });
});

describe('clearGameData', () => {
  it('removes every key it is given and leaves the rest alone', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.gold', '500');
    storage.setItem('test.highscore', '9000');
    clearGameData(storage, ['test.gold']);
    expect(storage.getItem('test.gold')).toBe(null);
    expect(storage.getItem('test.highscore')).toBe('9000');
  });

  it('does not throw when a key was never stored', () => {
    const storage = createMemoryStorage();
    expect(() => clearGameData(storage, ['test.missing'])).not.toThrow();
  });
});
