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

  it('computes ammo per round as a fraction of monkey count, with a floor', () => {
    const round1 = getRoundParams(1, CONFIG);
    expect(round1.monkeyCount).toBe(3);
    expect(round1.ammo).toBe(3);

    const round3 = getRoundParams(3, CONFIG);
    expect(round3.monkeyCount).toBe(5);
    expect(round3.ammo).toBe(4);

    const round20 = getRoundParams(20, CONFIG);
    expect(round20.monkeyCount).toBe(10);
    expect(round20.ammo).toBe(7);
  });
});
