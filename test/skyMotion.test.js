import { describe, it, expect } from 'vitest';
import { driftWrapped, flightProgress, createSeededRandom } from '../game/src/gameplay/skyMotion.js';

describe('driftWrapped', () => {
  it('moves by the delta while inside the range', () => {
    expect(driftWrapped(0, 1.2, -170, 170)).toBeCloseTo(1.2);
  });

  it('wraps to the near edge after passing the far edge', () => {
    expect(driftWrapped(169, 2, -170, 170)).toBeCloseTo(-169);
  });

  it('wraps to the far edge when drifting backwards', () => {
    expect(driftWrapped(-169, -2, -170, 170)).toBeCloseTo(169);
  });

  it('stays inside the range after a delta wider than the range', () => {
    const x = driftWrapped(0, 1000, -170, 170);
    expect(x).toBeGreaterThanOrEqual(-170);
    expect(x).toBeLessThan(170);
  });
});

describe('flightProgress', () => {
  it('advances by the fraction of the duration', () => {
    expect(flightProgress(0, 6, 24)).toBeCloseTo(0.25);
  });

  it('wraps past one without losing the overshoot', () => {
    expect(flightProgress(0.9, 6, 24)).toBeCloseTo(0.15);
  });

  it('returns 0 for a zero duration rather than dividing by it', () => {
    expect(flightProgress(0.5, 1, 0)).toBe(0);
  });
});

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    const first = [a(), a(), a(), a(), a()];
    const second = [b(), b(), b(), b(), b()];
    expect(first).toEqual(second);
  });

  it('produces numbers in [0, 1)', () => {
    const random = createSeededRandom(20260729);
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
