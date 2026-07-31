import { describe, it, expect } from 'vitest';
import { createPatrol } from '../game/src/gameplay/patrolMotion.js';

const AMPLITUDE = 3;
// frequency 1, phase 0 이면 elapsed 가 곧 각도다. 아래 시각들의 의미:
//   0        cos = 1   최고속, 오른쪽으로 간다
//   PI/2     cos = 0   순찰 오른쪽 끝, 멈춘다
//   PI       cos = -1  최고속, 왼쪽으로 간다
const patrol = () => createPatrol({ amplitude: AMPLITUDE, frequency: 1, phase: 0 });

describe('createPatrol', () => {
  it('keeps the existing sway curve exactly', () => {
    const p = patrol();
    for (const t of [0, 0.7, 1.4, 2.9, 5.1]) {
      expect(p.sample(t, 0.016).offsetX).toBeCloseTo(Math.sin(t) * AMPLITUDE, 10);
    }
  });

  it('faces fully sideways at top speed, and the sign follows the direction', () => {
    const p = patrol();
    expect(p.sample(0, 0.016).facing).toBeCloseTo(Math.PI / 2, 10);
    expect(p.sample(Math.PI, 0.016).facing).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('faces the player at both ends of the patrol', () => {
    const p = patrol();
    expect(p.sample(Math.PI / 2, 0.016).facing).toBeCloseTo(0, 10);
    expect(p.sample(Math.PI * 1.5, 0.016).facing).toBeCloseTo(0, 10);
  });

  it('blends the turn instead of snapping it', () => {
    const p = patrol();
    // 끝(PI/2)에 가까워질수록 |facing| 이 단조 감소해야 한다.
    const samples = [1.2, 1.35, 1.45, 1.55].map((t) => Math.abs(p.sample(t, 0.016).facing));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it('taunts only near the ends', () => {
    const p = patrol();
    expect(p.sample(Math.PI / 2, 0.016).taunt).toBeCloseTo(1, 10);
    expect(p.sample(0, 0.016).taunt).toBe(0);
    expect(p.sample(Math.PI, 0.016).taunt).toBe(0);
  });

  it('advances the gait by distance travelled, not by time', () => {
    const p = patrol();
    const dt = 0.016;
    const moving = p.sample(0, dt).gaitDelta;
    const stopped = p.sample(Math.PI / 2, dt).gaitDelta;
    expect(moving).toBeCloseTo(AMPLITUDE * 1 * dt, 10);
    expect(stopped).toBeCloseTo(0, 10);
    // 같은 시각에 dt 가 두 배면 나아간 거리도 두 배다.
    expect(p.sample(0, dt * 2).gaitDelta).toBeCloseTo(moving * 2, 10);
  });

  it('holds a zero-amplitude monkey still but still lets it taunt', () => {
    const still = createPatrol({ amplitude: 0, frequency: 1, phase: 0 });
    for (const t of [0, 0.5, Math.PI / 2, Math.PI, 4.2]) {
      const s = still.sample(t, 0.016);
      expect(s.offsetX).toBe(0);
      expect(s.facing).toBe(0);
      expect(s.gaitDelta).toBe(0);
    }
    expect(still.sample(Math.PI / 2, 0.016).taunt).toBeCloseTo(1, 10);
    expect(still.sample(0, 0.016).taunt).toBe(0);
  });

  it('respects the phase offset', () => {
    const shifted = createPatrol({ amplitude: AMPLITUDE, frequency: 1, phase: Math.PI / 2 });
    expect(shifted.sample(0, 0.016).offsetX).toBeCloseTo(AMPLITUDE, 10);
    expect(shifted.sample(0, 0.016).facing).toBeCloseTo(0, 10);
  });
});
