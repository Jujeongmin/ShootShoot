import { describe, it, expect } from 'vitest';
import { composeRound, roundSeed } from '../game/src/gameplay/roundComposition';
import { createSeededRandom } from '../game/src/gameplay/skyMotion';

// obstacles.ts 의 실제 슬롯 수: 타워 2 + 통로 2.
const SLOTS = 4;
// 그 4개 중 진짜 타워(진폭 0) 슬롯은 2개뿐이다. 나머지 2개는 통로라 움직인다.
const STATIC_SLOTS = 2;

describe('composeRound', () => {
  it('gives the same composition for the same round every time', () => {
    expect(composeRound(12, 10, SLOTS, STATIC_SLOTS)).toEqual(composeRound(12, 10, SLOTS, STATIC_SLOTS));
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
    const composition = composeRound(1, 3, SLOTS, STATIC_SLOTS);
    expect(composition.structureCount).toBe(2);
    expect(composition.laneCount).toBe(1);
  });

  it('never plans more monkeys than the round has', () => {
    for (let round = 1; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const composition = composeRound(round, count, SLOTS, STATIC_SLOTS);
      expect(composition.structureCount + composition.laneCount).toBe(count);
      expect(composition.monkeys).toHaveLength(count);
      expect(composition.structureCount).toBeLessThanOrEqual(SLOTS);
      expect(composition.laneCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves the first three rounds exactly as they were', () => {
    for (const [round, count] of [[1, 3], [2, 4], [3, 5]] as const) {
      const composition = composeRound(round, count, SLOTS, STATIC_SLOTS);
      expect(composition.formation).toBe('columns');
      for (const monkey of composition.monkeys) {
        expect(monkey).toEqual({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
      }
    }
  });

  it('holds the columns formation until round 4', () => {
    for (let round = 1; round <= 3; round += 1) {
      expect(composeRound(round, 3 + round - 1, SLOTS, STATIC_SLOTS).formation).toBe('columns');
    }
  });

  it('uses more than one formation once they unlock', () => {
    const seen = new Set<string>();
    for (let round = 4; round <= 40; round += 1) {
      seen.add(composeRound(round, Math.min(3 + round - 1, 10), SLOTS, STATIC_SLOTS).formation);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  // monkeyAllocation.test.ts 가 지키던 경계들이다. 지금 게임에서는 안 나오지만
  // 태스크 3~5 가 이 배분 위에 얹히므로 계약으로 남긴다.
  it('handles the degenerate inputs', () => {
    expect(composeRound(1, 7, 0, 0)).toMatchObject({ structureCount: 0, laneCount: 7 });
    expect(composeRound(1, 1, 4, STATIC_SLOTS)).toMatchObject({ structureCount: 0, laneCount: 1 });
    expect(composeRound(1, 0, 4, STATIC_SLOTS)).toMatchObject({ structureCount: 0, laneCount: 0 });
  });

  it('holds every behaviour but steady until it unlocks', () => {
    const unlock = { pause: 6, dash: 10, bob: 15 } as const;
    for (let round = 1; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      for (const monkey of composeRound(round, count, SLOTS, STATIC_SLOTS).monkeys) {
        if (monkey.behavior === 'steady') continue;
        expect(round, `${monkey.behavior} at round ${round}`)
          .toBeGreaterThanOrEqual(unlock[monkey.behavior]);
      }
    }
  });

  it('never stacks more hard behaviours than the round can afford', () => {
    const weight = { steady: 0, pause: -1, dash: 2, bob: 2 } as const;
    for (let round = 1; round <= 60; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const spent = composeRound(round, count, SLOTS, STATIC_SLOTS).monkeys
        .reduce((sum, monkey) => sum + weight[monkey.behavior], 0);
      const budget = Math.max(0, Math.min(Math.floor((round - 4) / 2), count));
      expect(spent, `round ${round}`).toBeLessThanOrEqual(budget);
    }
  });

  it('still gives the first three rounds nothing but steady', () => {
    for (const [round, count] of [[1, 3], [2, 4], [3, 5]] as const) {
      for (const monkey of composeRound(round, count, SLOTS, STATIC_SLOTS).monkeys) {
        expect(monkey.behavior).toBe('steady');
      }
    }
  });

  // 리뷰 회귀 방어. pause 는 가중치가 음수라 예산을 절대 넘지 않아 항상 후보에
  // 남는다 -- 몫을 안 막으면 해금되자마자(6라운드) 판을 뒤덮어서 5라운드보다
  // 쉬워진다. 구조물 슬롯을 0으로 둬서(structureSlotCount=0) 정적 슬롯 스킵과
  // 섞이지 않은 순수한 몫 계산만 확인한다.
  it('caps the share of monkeys drawing an easier-than-steady behaviour', () => {
    const weight = { steady: 0, pause: -1, dash: 2, bob: 2 } as const;
    for (let round = 6; round <= 60; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const easyCount = composeRound(round, count, 0, 0).monkeys.filter(
        (monkey) => weight[monkey.behavior] < 0
      ).length;
      expect(easyCount, `round ${round}`).toBeLessThanOrEqual(Math.floor(count / 3));
    }
  });

  // 리뷰 회귀 방어. 진폭이 0인 슬롯은 patrolMotion이 그 위에서 어떤 behavior를
  // 받아도 제자리에 세운다. 구성기가 거기 어려운 것을 배정하면 예산만 쓰고
  // 화면에는 안 보였다 -- 앞쪽 정적 슬롯만큼은 뽑지 않고 steady로 고정해야 한다.
  it('freezes static structure slots on steady without spending budget or easy share', () => {
    for (let round = 10; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const composition = composeRound(round, count, SLOTS, STATIC_SLOTS);
      const staticCount = Math.min(STATIC_SLOTS, composition.structureCount);
      for (let i = 0; i < staticCount; i += 1) {
        expect(composition.monkeys[i].behavior, `round ${round} slot ${i}`).toBe('steady');
      }
    }
  });
});
