import { describe, it, expect } from 'vitest';
import { allocateMonkeys } from '../game/src/gameplay/monkeyAllocation';
import { getRoundParams } from '../game/src/gameplay/difficulty';
import { CONFIG } from '../game/src/config';

// 타워 2개 + 통로 2자리
const SLOTS = 4;

describe('allocateMonkeys', () => {
  it('fills structures first but always leaves one monkey in the lanes', () => {
    expect(allocateMonkeys(3, SLOTS)).toEqual({ structureCount: 2, laneCount: 1 });
    expect(allocateMonkeys(4, SLOTS)).toEqual({ structureCount: 3, laneCount: 1 });
    expect(allocateMonkeys(5, SLOTS)).toEqual({ structureCount: 4, laneCount: 1 });
    expect(allocateMonkeys(6, SLOTS)).toEqual({ structureCount: 4, laneCount: 2 });
    expect(allocateMonkeys(10, SLOTS)).toEqual({ structureCount: 4, laneCount: 6 });
  });

  it('never loses or invents a monkey, for every round the game can reach', () => {
    for (let round = 1; round <= 50; round++) {
      const { monkeyCount } = getRoundParams(round, CONFIG);
      const { structureCount, laneCount } = allocateMonkeys(monkeyCount, SLOTS);
      expect(structureCount + laneCount).toBe(monkeyCount);
      expect(structureCount).toBeLessThanOrEqual(SLOTS);
      expect(laneCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves the lanes alone when there are no structure slots', () => {
    expect(allocateMonkeys(7, 0)).toEqual({ structureCount: 0, laneCount: 7 });
  });

  it('keeps a single monkey in the lanes rather than on a structure', () => {
    expect(allocateMonkeys(1, SLOTS)).toEqual({ structureCount: 0, laneCount: 1 });
  });

  it('handles an empty round without going negative', () => {
    expect(allocateMonkeys(0, SLOTS)).toEqual({ structureCount: 0, laneCount: 0 });
  });
});
