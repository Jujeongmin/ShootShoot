import { describe, it, expect } from 'vitest';
import { resolveShot, computeHitDamage, resolveKillOutcome } from '../game/src/gameplay/shooting.js';
import { CONFIG } from '../game/src/config.js';

describe('resolveShot', () => {
  it('returns a miss when there are no hits', () => {
    const outcome = resolveShot([]);
    expect(outcome.isMiss).toBe(true);
    expect(outcome.penetrationCount).toBe(0);
    expect(outcome.hits).toEqual([]);
  });

  it('returns a single hit with penetrationIndex 0', () => {
    const outcome = resolveShot([{ monkeyId: 'a', part: 'head' }]);
    expect(outcome.isMiss).toBe(false);
    expect(outcome.penetrationCount).toBe(1);
    expect(outcome.hits).toEqual([{ monkeyId: 'a', part: 'head', penetrationIndex: 0 }]);
  });

  it('preserves order and assigns increasing penetrationIndex for multiple hits', () => {
    const outcome = resolveShot([
      { monkeyId: 'a', part: 'body' },
      { monkeyId: 'b', part: 'head' },
      { monkeyId: 'c', part: 'body' },
    ]);
    expect(outcome.penetrationCount).toBe(3);
    expect(outcome.hits.map((h) => h.penetrationIndex)).toEqual([0, 1, 2]);
    expect(outcome.hits.map((h) => h.monkeyId)).toEqual(['a', 'b', 'c']);
  });
});

describe('computeHitDamage', () => {
  it('deals the weapon damage on a body shot', () => {
    expect(computeHitDamage('body', 3, CONFIG)).toBe(3);
  });

  it('doubles the weapon damage on a head shot', () => {
    expect(computeHitDamage('head', 3, CONFIG)).toBe(6);
  });
});

describe('resolveKillOutcome', () => {
  it('stays a miss when the shot missed', () => {
    const outcome = resolveKillOutcome({ isMiss: true, penetrationCount: 0, hits: [] }, []);
    expect(outcome).toEqual({ isMiss: true, penetrationCount: 0, hits: [] });
  });

  it('is not a miss but scores nothing when a hit killed nobody', () => {
    const shot = resolveShot([{ monkeyId: 'a', part: 'body' }]);
    const outcome = resolveKillOutcome(shot, []);
    expect(outcome.isMiss).toBe(false);
    expect(outcome.penetrationCount).toBe(0);
    expect(outcome.hits).toEqual([]);
  });

  it('counts only the monkeys that died, not everyone hit', () => {
    const shot = resolveShot([
      { monkeyId: 'a', part: 'body' },
      { monkeyId: 'b', part: 'head' },
      { monkeyId: 'c', part: 'body' },
    ]);
    const killed = shot.hits.filter((hit) => hit.monkeyId !== 'b');
    const outcome = resolveKillOutcome(shot, killed);
    expect(outcome.penetrationCount).toBe(2);
    expect(outcome.hits.map((h) => h.monkeyId)).toEqual(['a', 'c']);
  });
});
