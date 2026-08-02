import { describe, it, expect } from 'vitest';
import { composeRound, roundSeed } from '../game/src/gameplay/roundComposition';
import { createSeededRandom } from '../game/src/gameplay/skyMotion';

// obstacles.ts 의 실제 슬롯 수: 타워 2 + 통로 2.
const SLOTS = 4;

describe('composeRound', () => {
  it('gives the same composition for the same round every time', () => {
    expect(composeRound(12, 10, SLOTS)).toEqual(composeRound(12, 10, SLOTS));
  });

  // 회귀 방어. 이웃 라운드의 난수열이 실제로 갈라지는지 본다.
  //
  // "모든 쌍이 0.01 이상 떨어진다"로 판정하면 안 된다. 실측하면 그 조건은 나쁜
  // 해시를 통과시키고 좋은 해시를 떨어뜨린다 — 라운드에 큰 홀수를 한 번만 곱한
  // 버전은 평균 간격이 0.043 인데도 0.01 미만인 쌍이 하나도 없고, 제대로 섞은
  // 쪽은 독립 균등분포라 2t - t^2 ≈ 2% 의 쌍이 우연히 가까이 붙는다.
  //
  // 그래서 분포로 본다. 독립인 두 균등분포의 기대 간격은 1/3 이다.
  // 실측: 라운드 번호 그대로 0.0004, 단일 곱셈 0.043, 지금 혼합 0.351.
  it('sends adjacent rounds down genuinely different random streams', () => {
    const gaps: number[] = [];
    for (let round = 1; round <= 500; round += 1) {
      const a = createSeededRandom(roundSeed(round))();
      const b = createSeededRandom(roundSeed(round + 1))();
      gaps.push(Math.abs(a - b));
    }
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const closeFraction = gaps.filter((gap) => gap < 0.01).length / gaps.length;

    // 선형 해시는 0.05 를 못 넘는다. 제대로 섞이면 1/3 근처다.
    expect(mean).toBeGreaterThan(0.25);
    // 라운드 번호를 그대로 넣으면 이 값이 1.0 이 된다.
    expect(closeFraction).toBeLessThan(0.06);
  });

  it('hands one monkey to the lanes even when the structures could take them all', () => {
    // 1라운드는 원숭이 셋에 슬롯 넷이다. 슬롯을 다 채우면 레인이 빈다.
    const composition = composeRound(1, 3, SLOTS);
    expect(composition.structureCount).toBe(2);
    expect(composition.laneCount).toBe(1);
  });

  it('never plans more monkeys than the round has', () => {
    for (let round = 1; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const composition = composeRound(round, count, SLOTS);
      expect(composition.structureCount + composition.laneCount).toBe(count);
      expect(composition.monkeys).toHaveLength(count);
      expect(composition.structureCount).toBeLessThanOrEqual(SLOTS);
      expect(composition.laneCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves the first three rounds exactly as they were', () => {
    for (const [round, count] of [[1, 3], [2, 4], [3, 5]] as const) {
      const composition = composeRound(round, count, SLOTS);
      expect(composition.formation).toBe('columns');
      for (const monkey of composition.monkeys) {
        expect(monkey).toEqual({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
      }
    }
  });

  // 이 테스트는 임시다 -- 태스크 3이 대형을 씨앗에서 뽑기 시작하면 라운드마다
  // 구성이 달라지는 게 맞으므로, 그때 이 테스트를 지운다. 지금 이 자리를
  // 지켜야 할 계약으로 착각하지 말 것.
  it('produces the same composition for every round until formations arrive', () => {
    const baseline = composeRound(1, 10, SLOTS);
    for (let round = 2; round <= 40; round += 1) {
      expect(composeRound(round, 10, SLOTS)).toEqual(baseline);
    }
  });
});
