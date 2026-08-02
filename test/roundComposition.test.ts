import { describe, it, expect } from 'vitest';
import { composeRound, roundSeed } from '../game/src/gameplay/roundComposition';
import { createSeededRandom } from '../game/src/gameplay/skyMotion';

// obstacles.ts 의 실제 슬롯 수: 타워 2 + 통로 2.
const SLOTS = 4;

describe('composeRound', () => {
  it('gives the same composition for the same round every time', () => {
    expect(composeRound(12, 10, SLOTS)).toEqual(composeRound(12, 10, SLOTS));
  });

  // 회귀 방어. LCG는 이웃 씨앗에서 첫 출력이 거의 같다(1664525 / 2^32 ≈ 0.0004).
  // 라운드 번호를 그대로, 또는 큰 홀수를 한 번만 곱해서 넣으면 12라운드와 13라운드가
  // 사실상 같은 난수열을 밟는다. 선형이 아닌 혼합을 거쳐야 갈라진다.
  it('sends adjacent rounds down genuinely different random streams', () => {
    for (let round = 1; round <= 200; round += 1) {
      const a = createSeededRandom(roundSeed(round))();
      const b = createSeededRandom(roundSeed(round + 1))();
      expect(Math.abs(a - b), `rounds ${round} and ${round + 1}`).toBeGreaterThan(0.01);
    }
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
