import { describe, it, expect } from 'vitest';
import { computeLaneLayout } from '../game/src/gameplay/laneLayout';
import { FORMATIONS } from '../game/src/gameplay/roundComposition';
import { createPatrol } from '../game/src/gameplay/patrolMotion';

// computeLaneLayout이 만드는 슬롯 하나의 모양. 반환 타입에서 그대로 뽑아 쓰므로
// laneLayout.ts의 슬롯 필드가 바뀌면 여기도 같이 바뀐다.
type LaneSlot = ReturnType<typeof computeLaneLayout>[number];

// 원숭이의 실제 x 좌표 재현: patrolMotion.ts의 offsetX와 동일한 공식
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
      expect(computeLaneLayout(n, 0.5, 1.0, 'columns')).toHaveLength(n);
    }
  });

  it('partitions monkeys into lanes of 2-3 (unique base angles = lane count)', () => {
    function laneCount(n: number) {
      const slots = computeLaneLayout(n, 0.5, 1.0, 'columns');
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
    const slots = computeLaneLayout(2, 0.5, 1.0, 'columns');
    const [a, b] = slots;
    const halfPeriod = Math.PI / a.swayFrequency;
    expect(rayRatio(a, 0)).toBeCloseTo(rayRatio(b, 0), 10);
    expect(rayRatio(a, halfPeriod)).toBeCloseTo(rayRatio(b, halfPeriod), 10);
    const quarter = halfPeriod / 2;
    expect(Math.abs(rayRatio(a, quarter) - rayRatio(b, quarter))).toBeGreaterThan(0.01);
  });

  it('every pair in a 3-lane has its own periodic alignment moment', () => {
    const slots = computeLaneLayout(3, 0.5, 1.0, 'columns');
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
    const slots = computeLaneLayout(10, 0.5, 1.0, 'columns');
    const ratios = slots.map((s) => s.swayAmplitude / Math.abs(s.z));
    for (const r of ratios) {
      expect(r).toBeCloseTo(ratios[0], 10);
    }
  });

  it('scales depth gap with monkeyScale', () => {
    const big = computeLaneLayout(3, 0.5, 1.0, 'columns');
    const small = computeLaneLayout(3, 0.5, 0.5, 'columns');
    const gapBig = Math.abs(big[1].z - big[0].z);
    const gapSmall = Math.abs(small[1].z - small[0].z);
    expect(gapSmall).toBeCloseTo(gapBig * 0.5, 10);
  });

  it('sway frequency scales with monkeySpeed', () => {
    const slow = computeLaneLayout(3, 0.5, 1.0, 'columns');
    const fast = computeLaneLayout(3, 1.0, 1.0, 'columns');
    expect(fast[0].swayFrequency).toBeCloseTo(slow[0].swayFrequency * 2, 10);
  });
});

// world.ts 의 섬 폭이 26이다. 절반을 넘으면 원숭이가 섬 밖 허공에 선다.
const ISLAND_HALF_WIDTH = 13;

describe('formations', () => {
  it('leaves columns byte-identical to what it was', () => {
    // 이 값들은 대형이 생기기 전 computeLaneLayout(7, 0.25, 1) 의 출력이다.
    const slots = computeLaneLayout(7, 0.25, 1, 'columns');
    expect(slots).toHaveLength(7);
    expect(slots[0].x).toBeCloseTo(-0.09 * 78, 10);
    expect(slots[0].z).toBeCloseTo(-78, 10);
    expect(slots[1].z).toBeCloseTo(-84, 10);
    expect(slots[0].swayAmplitude).toBeCloseTo(0.038 * 78, 10);
    expect(slots[0].swayFrequency).toBeCloseTo(1.8 * 0.25, 10);
  });

  it('keeps every monkey over the island in every formation', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        for (const slot of computeLaneLayout(count, 0.25, 1, formation)) {
          const reach = Math.abs(slot.x) + slot.swayAmplitude;
          expect(reach, `${formation} with ${count}`).toBeLessThanOrEqual(ISLAND_HALF_WIDTH);
        }
      }
    }
  });

  it('never puts two monkeys on top of each other', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        const slots = computeLaneLayout(count, 0.25, 1, formation);
        for (let i = 0; i < slots.length; i += 1) {
          for (let j = i + 1; j < slots.length; j += 1) {
            const dx = slots[i].x - slots[j].x;
            const dz = slots[i].z - slots[j].z;
            expect(Math.hypot(dx, dz), `${formation} with ${count}, slots ${i}/${j}`)
              .toBeGreaterThan(2);
          }
        }
      }
    }
  });

  // 리뷰 회귀 방어. 위 테스트는 스폰 시점(t=0) 한 순간만 본다 -- 두 슬롯이 진짜
  // 겹치는지는 시간에 따라 봐야 안다. 예전에는 sway 주기가 모두 같아서(모든
  // 슬롯이 laneLayout.ts 의 frequency 하나를 공유) 위상차가 고정이라 정적
  // 검사로 충분했다. 개체별 speedScale(roundComposition.ts 의 VARIANTS)이
  // 진폭에만 실리고 주기에는 안 실리는 지금도 그 전제가 유지되는지를 여기서
  // 직접 확인한다 -- 만약 다시 누군가 주기를 개체마다 다르게 스케일하면, 그
  // 순간 위상차가 시간이 지나며 흐르기 시작해서 언젠가 두 원숭이가 같은 자리를
  // 지나친다.
  //
  // patrolMotion.createPatrol 이 실제로 쓰는 곡선을 그대로 불러 쓴다 --
  // steady(behavior)는 sign(sin) x |sin|^1 이라 그냥 sin 이고, 진폭·주기·위상
  // 이 실제 게임과 동일한 방식(targetManager.ts)으로 조합된다: 주기는
  // 슬롯이 공유하고, 개체별 배율은 진폭에만 곱한다.
  it('keeps a real floor between lane monkeys across a full sway period, even with per-monkey amplitude variance', () => {
    // roundComposition.ts 의 VARIANTS.speedScale 값을 그대로 옮겨 왔다. 거기가
    // 바뀌면 여기도 같이 바꿔야 한다 -- import 하지 않는 이유는 VARIANTS 가
    // export 되어 있지 않아서고(구성기 내부 세부사항), 그 경계를 넘기지 않기
    // 위해서다.
    const AMPLITUDE_FACTORS = [0.8, 1.0, 1.2];
    const SAMPLES = 200;

    let worst = Infinity;
    let worstInfo = '';

    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        const slots = computeLaneLayout(count, 0.25, 1, formation);
        const period = (2 * Math.PI) / slots[0].swayFrequency;

        for (let i = 0; i < slots.length; i += 1) {
          for (let j = i + 1; j < slots.length; j += 1) {
            const a = slots[i];
            const b = slots[j];
            const dz = a.z - b.z;

            for (const fa of AMPLITUDE_FACTORS) {
              for (const fb of AMPLITUDE_FACTORS) {
                const patrolA = createPatrol({
                  amplitude: a.swayAmplitude * fa,
                  frequency: a.swayFrequency,
                  phase: a.swayPhase,
                  behavior: 'steady',
                });
                const patrolB = createPatrol({
                  amplitude: b.swayAmplitude * fb,
                  frequency: b.swayFrequency,
                  phase: b.swayPhase,
                  behavior: 'steady',
                });

                for (let s = 0; s < SAMPLES; s += 1) {
                  const t = (period * s) / SAMPLES;
                  const xa = a.x + patrolA.sample(t, 0).offsetX;
                  const xb = b.x + patrolB.sample(t, 0).offsetX;
                  const sep = Math.hypot(xa - xb, dz);
                  if (sep < worst) {
                    worst = sep;
                    worstInfo = `${formation} count=${count} slots ${i}/${j} fa=${fa} fb=${fb} t=${t.toFixed(3)}`;
                  }
                }
              }
            }
          }
        }
      }
    }

    // 실측 최솟값은 약 1.2096 (columns 대형, count=10, 슬롯 4/7, 둘 다 배율
    // 1.2일 때). 그 바로 아래에 문턱을 둔다 -- 문턱을 먼저 정하고 코드를
    // 거기 맞추는 대신, 실측값 아래에 여유를 살짝만 두는 쪽으로 뒀다.
    expect(worst, worstInfo).toBeGreaterThan(1.2);
  });

  it('gives every formation the same number of slots it was asked for', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        expect(computeLaneLayout(count, 0.25, 1, formation)).toHaveLength(count);
      }
    }
  });

  // 회귀 방어. 분수 중심으로 잡으면 레인이 둘일 때 두 레인이 같은 값을 받아
  // 쐐기가 사라진다. 4라운드가 원숭이 6마리 = 레인 둘이라 바로 그 경우다.
  it('actually staggers depth in a wedge, even with only two lanes', () => {
    for (const count of [4, 5, 6]) {
      const slots = computeLaneLayout(count, 0.25, 1, 'wedge');
      const depths = new Set(slots.map((slot) => slot.z));
      const columnDepths = new Set(computeLaneLayout(count, 0.25, 1, 'columns').map((s) => s.z));
      expect(depths.size, `wedge with ${count}`).toBeGreaterThan(columnDepths.size);
    }
  });
});
