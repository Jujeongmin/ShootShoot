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

  it('starts monkeys at 1 HP and adds 1 HP every 2 rounds', () => {
    expect(getRoundParams(1, CONFIG).monkeyHp).toBe(1);
    expect(getRoundParams(2, CONFIG).monkeyHp).toBe(1);
    expect(getRoundParams(3, CONFIG).monkeyHp).toBe(2);
    expect(getRoundParams(4, CONFIG).monkeyHp).toBe(2);
    expect(getRoundParams(9, CONFIG).monkeyHp).toBe(5);
  });

  it('keeps raising monkey HP without any cap', () => {
    expect(getRoundParams(21, CONFIG).monkeyHp).toBe(11);
    expect(getRoundParams(101, CONFIG).monkeyHp).toBe(51);
  });
});
