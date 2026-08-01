import { describe, it, expect } from 'vitest';
import { getRoundParams } from '../game/src/gameplay/difficulty';
import { computeHitDamage } from '../game/src/gameplay/shooting';
import { CONFIG } from '../game/src/config';

describe('getRoundParams', () => {
  it('returns base values for round 1', () => {
    const params = getRoundParams(1, CONFIG);
    expect(params.monkeyCount).toBe(CONFIG.round.baseMonkeyCount);
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

  it('keeps monkey scale constant across rounds', () => {
    const early = getRoundParams(1, CONFIG);
    const later = getRoundParams(50, CONFIG);
    expect(early.monkeyScale).toBe(CONFIG.round.baseMonkeyScale);
    expect(later.monkeyScale).toBe(CONFIG.round.baseMonkeyScale);
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

describe('weapon damage ladder', () => {
  // 스펙 §2.2: 데미지 d인 무기는 라운드 2d까지 몸통 원샷, 4d까지 헤드샷 원샷.
  const cases = [
    { damage: 1, bodyThrough: 2, headThrough: 4 },
    { damage: 2, bodyThrough: 4, headThrough: 8 },
    { damage: 3, bodyThrough: 6, headThrough: 12 },
    { damage: 5, bodyThrough: 10, headThrough: 20 },
  ];

  for (const { damage, bodyThrough, headThrough } of cases) {
    it(`damage ${damage} one-shots bodies through round ${bodyThrough} and heads through ${headThrough}`, () => {
      const body = computeHitDamage('body', damage, CONFIG);
      const head = computeHitDamage('head', damage, CONFIG);
      expect(body).toBeGreaterThanOrEqual(getRoundParams(bodyThrough, CONFIG).monkeyHp);
      expect(body).toBeLessThan(getRoundParams(bodyThrough + 1, CONFIG).monkeyHp);
      expect(head).toBeGreaterThanOrEqual(getRoundParams(headThrough, CONFIG).monkeyHp);
      expect(head).toBeLessThan(getRoundParams(headThrough + 1, CONFIG).monkeyHp);
    });
  }
});
