import { describe, it, expect } from 'vitest';
import { getRoundParams } from '../game/src/gameplay/difficulty.js';
import { CONFIG } from '../game/src/config.js';

describe('getRoundParams', () => {
  it('returns base values for round 1', () => {
    const params = getRoundParams(1, CONFIG);
    expect(params.monkeyCount).toBe(CONFIG.round.baseMonkeyCount);
    expect(params.timeLimit).toBe(CONFIG.round.baseTimeLimit);
    expect(params.monkeySpeed).toBe(CONFIG.round.baseMonkeySpeed);
    expect(params.monkeyScale).toBe(CONFIG.round.baseMonkeyScale);
  });

  it('increases monkey count and speed as rounds progress, capped at max', () => {
    const early = getRoundParams(2, CONFIG);
    const later = getRoundParams(20, CONFIG);
    expect(early.monkeyCount).toBeGreaterThan(CONFIG.round.baseMonkeyCount);
    expect(later.monkeyCount).toBe(CONFIG.round.maxMonkeyCount);
    expect(later.monkeySpeed).toBeGreaterThan(early.monkeySpeed);
  });

  it('decreases time limit and scale as rounds progress, clamped at minimums', () => {
    const later = getRoundParams(50, CONFIG);
    expect(later.timeLimit).toBe(CONFIG.round.minTimeLimit);
    expect(later.monkeyScale).toBe(CONFIG.round.minMonkeyScale);
  });
});
