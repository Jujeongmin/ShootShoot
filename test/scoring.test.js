import { describe, it, expect } from 'vitest';
import {
  createScoreState,
  calculateShotScore,
  applyShot,
  createHighScoreStore,
} from '../game/src/gameplay/scoring.js';
import { CONFIG } from '../game/src/config.js';

describe('calculateShotScore', () => {
  it('awards base hit score for a single body hit with no streak', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit);
  });

  it('adds headshot bonus', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'head', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit + CONFIG.score.headshotBonus);
  });

  it('multiplies score for multi-monkey penetration', () => {
    const outcome = {
      isMiss: false,
      penetrationCount: 2,
      hits: [
        { monkeyId: 'a', part: 'body', penetrationIndex: 0 },
        { monkeyId: 'b', part: 'body', penetrationIndex: 1 },
      ],
    };
    const single = CONFIG.score.baseHit * 2;
    const expected = Math.round(single * (1 + CONFIG.score.comboMultiplierPerPenetration));
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(expected);
  });

  it('applies streak multiplier, capped', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const highStreak = 100;
    const expected = Math.round(CONFIG.score.baseHit * CONFIG.score.streakMultiplierCap);
    expect(calculateShotScore(outcome, highStreak, CONFIG)).toBe(expected);
  });

  it('returns 0 for a miss', () => {
    expect(calculateShotScore({ isMiss: true, penetrationCount: 0, hits: [] }, 5, CONFIG)).toBe(0);
  });

  it('returns 0 for a neutral outcome (structures destroyed, no monkeys killed)', () => {
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    expect(calculateShotScore(outcome, 5, CONFIG)).toBe(0);
  });

  it('scores nothing for a hit that killed nobody, and keeps the streak alive', () => {
    const outcome = { isMiss: false, penetrationCount: 0, hits: [] };
    expect(calculateShotScore(outcome, 3, CONFIG)).toBe(0);

    const next = applyShot({ score: 500, streak: 3, misses: 1 }, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
    expect(next.misses).toBe(1);
  });
});

describe('applyShot', () => {
  it('increments score and streak on hit', () => {
    const state = createScoreState();
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(CONFIG.score.baseHit);
    expect(next.streak).toBe(1);
    expect(next.misses).toBe(0);
  });

  it('resets streak and increments misses on miss', () => {
    const state = { score: 500, streak: 4, misses: 1 };
    const outcome = { isMiss: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(0);
    expect(next.misses).toBe(2);
  });

  it('leaves score, streak, and misses all unchanged on a neutral outcome', () => {
    const state = { score: 500, streak: 4, misses: 1 };
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
    expect(next.misses).toBe(1);
  });

  it('does not treat a neutral outcome as a miss even from a fresh state', () => {
    const state = createScoreState();
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next).toEqual(state);
  });
});

describe('createHighScoreStore', () => {
  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    };
  }

  it('returns 0 when nothing stored', () => {
    const store = createHighScoreStore(createMemoryStorage(), 'test.key');
    expect(store.get()).toBe(0);
  });

  it('submits a new high score when higher than stored', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    expect(store.submit(100)).toBe(100);
    expect(store.get()).toBe(100);
  });

  it('keeps the existing high score when submitted score is lower', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    store.submit(200);
    expect(store.submit(50)).toBe(200);
    expect(store.get()).toBe(200);
  });
});
