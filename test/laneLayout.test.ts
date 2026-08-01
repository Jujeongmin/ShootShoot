import { describe, it, expect } from 'vitest';
import { computeLaneLayout } from '../game/src/gameplay/laneLayout';

// computeLaneLayout이 만드는 슬롯 하나의 모양. 반환 타입에서 그대로 뽑아 쓰므로
// laneLayout.ts의 슬롯 필드가 바뀌면 여기도 같이 바뀐다.
type LaneSlot = ReturnType<typeof computeLaneLayout>[number];

// 원숭이의 실제 x 좌표 재현: patrolMotion.js의 offsetX와 동일한 공식
function xAt(slot: LaneSlot, t: number) {
  return slot.x + Math.sin(slot.swayFrequency * t + slot.swayPhase) * slot.swayAmplitude;
}

// 카메라(x=0) 기준 시선 각도 비율
function rayRatio(slot: LaneSlot, t: number) {
  return xAt(slot, t) / Math.abs(slot.z);
}

describe('computeLaneLayout', () => {
  it('returns exactly monkeyCount slots for the whole supported range', () => {
    for (let n = 1; n <= 10; n++) {
      expect(computeLaneLayout(n, 0.5, 1.0)).toHaveLength(n);
    }
  });

  it('partitions monkeys into lanes of 2-3 (unique base angles = lane count)', () => {
    function laneCount(n: number) {
      const slots = computeLaneLayout(n, 0.5, 1.0);
      const angles = new Set(slots.map((s) => (s.x / Math.abs(s.z)).toFixed(6)));
      return angles.size;
    }
    expect(laneCount(3)).toBe(1);
    expect(laneCount(4)).toBe(2);
    expect(laneCount(5)).toBe(2);
    expect(laneCount(7)).toBe(3);
    expect(laneCount(10)).toBe(4);
  });

  it('monkeys in the same 2-lane align exactly (equal ray ratio) at spawn and every half period', () => {
    const slots = computeLaneLayout(2, 0.5, 1.0);
    const [a, b] = slots;
    const halfPeriod = Math.PI / a.swayFrequency;
    expect(rayRatio(a, 0)).toBeCloseTo(rayRatio(b, 0), 10);
    expect(rayRatio(a, halfPeriod)).toBeCloseTo(rayRatio(b, halfPeriod), 10);
    const quarter = halfPeriod / 2;
    expect(Math.abs(rayRatio(a, quarter) - rayRatio(b, quarter))).toBeGreaterThan(0.01);
  });

  it('every pair in a 3-lane has its own periodic alignment moment', () => {
    const slots = computeLaneLayout(3, 0.5, 1.0);
    const [a, b, c] = slots;
    const w = a.swayFrequency;
    // 쌍 (φ1, φ2)의 정렬 시각: w*t = (π - φ1 - φ2)/2 + kπ
    function alignTime(p: LaneSlot, q: LaneSlot) {
      return (Math.PI - p.swayPhase - q.swayPhase) / 2 / w;
    }
    expect(rayRatio(a, alignTime(a, b))).toBeCloseTo(rayRatio(b, alignTime(a, b)), 10);
    expect(rayRatio(b, alignTime(b, c))).toBeCloseTo(rayRatio(c, alignTime(b, c)), 10);
    expect(rayRatio(a, alignTime(a, c))).toBeCloseTo(rayRatio(c, alignTime(a, c)), 10);
  });

  it('sway amplitude is proportional to |z| (equal angular amplitude)', () => {
    const slots = computeLaneLayout(10, 0.5, 1.0);
    const ratios = slots.map((s) => s.swayAmplitude / Math.abs(s.z));
    for (const r of ratios) {
      expect(r).toBeCloseTo(ratios[0], 10);
    }
  });

  it('scales depth gap with monkeyScale', () => {
    const big = computeLaneLayout(3, 0.5, 1.0);
    const small = computeLaneLayout(3, 0.5, 0.5);
    const gapBig = Math.abs(big[1].z - big[0].z);
    const gapSmall = Math.abs(small[1].z - small[0].z);
    expect(gapSmall).toBeCloseTo(gapBig * 0.5, 10);
  });

  it('sway frequency scales with monkeySpeed', () => {
    const slow = computeLaneLayout(3, 0.5, 1.0);
    const fast = computeLaneLayout(3, 1.0, 1.0);
    expect(fast[0].swayFrequency).toBeCloseTo(slow[0].swayFrequency * 2, 10);
  });
});
