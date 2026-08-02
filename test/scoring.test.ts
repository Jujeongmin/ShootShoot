import { describe, it, expect } from 'vitest';
import {
  createScoreState,
  calculateShotScore,
  applyShot,
  roundSettlementGold,
  createHighScoreStore,
} from '../game/src/gameplay/scoring';
import { CONFIG } from '../game/src/config';
import { createMemoryStorage } from './helpers/memoryStorage';

describe('calculateShotScore', () => {
  it('awards base hit score for a single body hit with no streak', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit);
  });

  it('adds headshot bonus', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'head', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit + CONFIG.score.headshotBonus);
  });

  it('multiplies score for multi-monkey penetration', () => {
    const outcome = {
      isMiss: false,
      penetrationCount: 2,
      hits: [
        { monkeyId: 'a', part: 'body', penetrationIndex: 0 },
        { monkeyId: 'b', part: 'body', penetrationIndex: 1 },
      ],
    };
    const single = CONFIG.score.baseHit * 2;
    const expected = Math.round(single * (1 + CONFIG.score.comboMultiplierPerPenetration));
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(expected);
  });

  it('applies streak multiplier, capped', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const highStreak = 100;
    const expected = Math.round(CONFIG.score.baseHit * CONFIG.score.streakMultiplierCap);
    expect(calculateShotScore(outcome, highStreak, CONFIG)).toBe(expected);
  });

  it('returns 0 for a miss', () => {
    expect(calculateShotScore({ isMiss: true, penetrationCount: 0, hits: [] }, 5, CONFIG)).toBe(0);
  });

  it('returns 0 for a neutral outcome (structures destroyed, no monkeys killed)', () => {
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    expect(calculateShotScore(outcome, 5, CONFIG)).toBe(0);
  });

  it('scores nothing for a hit that killed nobody, and keeps the streak alive', () => {
    const outcome = { isMiss: false, penetrationCount: 0, hits: [] };
    expect(calculateShotScore(outcome, 3, CONFIG)).toBe(0);

    const next = applyShot({ score: 500, streak: 3 }, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
  });
});

describe('applyShot', () => {
  it('increments score and streak on hit', () => {
    const state = createScoreState();
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(CONFIG.score.baseHit);
    expect(next.streak).toBe(1);
  });

  it('resets the streak on a miss', () => {
    const state = { score: 500, streak: 4 };
    const outcome = { isMiss: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(0);
  });

  it('leaves score and streak unchanged on a neutral outcome', () => {
    const state = { score: 500, streak: 4 };
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
  });

  it('does not treat a neutral outcome as a miss even from a fresh state', () => {
    const state = createScoreState();
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next).toEqual(state);
  });
});

describe('roundSettlementGold', () => {
  const config = { scorePerGold: 10, goldRoundMultiplierPerRound: 0.15 };

  it('pays nothing for a round that scored nothing', () => {
    expect(roundSettlementGold(0, 1, config)).toBe(0);
    expect(roundSettlementGold(-50, 1, config)).toBe(0);
  });

  it('leaves round 1 on the plain conversion', () => {
    expect(roundSettlementGold(330, 1, config)).toBe(33);
  });

  it('scales with the round', () => {
    // 8라운드 배율은 1 + 7 x 0.15 = 2.05. 2000 / 10 x 2.05 = 410.
    expect(roundSettlementGold(2000, 8, config)).toBe(410);
    // 50라운드 배율은 1 + 49 x 0.15 = 8.35. 2000 / 10 x 8.35 = 1670.
    expect(roundSettlementGold(2000, 50, config)).toBe(1670);
  });

  // 회귀 방어. 나눈 뒤 버리고 곱하면 6 x 2.05 = 12 가 나온다. 한 번만 버려야 13이다.
  it('floors once, not twice', () => {
    expect(roundSettlementGold(65, 8, config)).toBe(13);
  });

  it('drops the remainder rather than carrying it', () => {
    expect(roundSettlementGold(19, 1, config)).toBe(1);
  });

  // 참조값을 BigInt 로 따로 계산한다. 앞서 이 자리를 부동소수로 두었더니 구현과
  // 똑같은 연산을 똑같은 순서로 반복해서, 구현과 공유하는 오류는 잡을 수 없었다.
  // 정수 나눗셈은 BigInt 가 정확하므로 바닥 함수도 필요 없다.
  it('matches exact rational arithmetic across many rounds and scores', () => {
    const hundredthsPerRound = BigInt(Math.round(config.goldRoundMultiplierPerRound * 100));
    const denominator = BigInt(config.scorePerGold) * 100n;
    for (let round = 1; round <= 120; round += 1) {
      for (let score = 1; score <= 2000; score += 37) {
        const numerator = BigInt(score) * (100n + BigInt(round - 1) * hundredthsPerRound);
        const exact = Number(numerator / denominator);
        expect(roundSettlementGold(score, round, config), `score ${score}, round ${round}`).toBe(exact);
      }
    }
  });
});

describe('createHighScoreStore', () => {
  it('returns 0 when nothing stored', () => {
    const store = createHighScoreStore(createMemoryStorage(), 'test.key');
    expect(store.get()).toBe(0);
  });

  it('submits a new high score when higher than stored', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    expect(store.submit(100)).toBe(100);
    expect(store.get()).toBe(100);
  });

  it('keeps the existing high score when submitted score is lower', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    store.submit(200);
    expect(store.submit(50)).toBe(200);
    expect(store.get()).toBe(200);
  });
});
