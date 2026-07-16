import { describe, it, expect } from 'vitest';
import { resolveShot } from '../game/src/gameplay/shooting.js';

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
