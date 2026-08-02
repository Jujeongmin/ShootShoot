import { describe, it, expect } from 'vitest';
import { composeRound } from '../game/src/gameplay/roundComposition';

// obstacles.ts 의 실제 슬롯 수: 타워 2 + 통로 2.
const SLOTS = 4;

describe('composeRound', () => {
  it('gives the same composition for the same round every time', () => {
    expect(composeRound(12, 10, SLOTS)).toEqual(composeRound(12, 10, SLOTS));
  });

  // 회귀 방어. LCG는 이웃 씨앗에서 첫 출력이 거의 같아서, 라운드 번호를 그대로
  // 씨앗으로 쓰면 이 테스트가 깨진다.
  it('gives different compositions to adjacent rounds', () => {
    const rounds = [10, 11, 12, 13, 14].map((n) => JSON.stringify(composeRound(n, 10, SLOTS)));
    expect(new Set(rounds).size).toBeGreaterThan(1);
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
});
