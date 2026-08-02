interface Hit {
  part: string;
}

interface ShotOutcome {
  isMiss: boolean;
  isNeutral?: boolean;
  hits: Hit[];
  penetrationCount: number;
}

interface ScoreConfig {
  score: {
    baseHit: number;
    headshotBonus: number;
    comboMultiplierPerPenetration: number;
    streakMultiplierStep: number;
    streakMultiplierCap: number;
  };
}

interface ScoreState {
  score: number;
  streak: number;
}

export function createScoreState(): ScoreState {
  return { score: 0, streak: 0 };
}

export function calculateShotScore(shotOutcome: ShotOutcome, streak: number, config: ScoreConfig): number {
  if (shotOutcome.isMiss || shotOutcome.isNeutral) return 0;
  const base = shotOutcome.hits.reduce((sum, hit) => {
    return sum + config.score.baseHit + (hit.part === 'head' ? config.score.headshotBonus : 0);
  }, 0);
  const comboMultiplier = 1 + (shotOutcome.penetrationCount - 1) * config.score.comboMultiplierPerPenetration;
  const streakMultiplier = Math.min(
    1 + streak * config.score.streakMultiplierStep,
    config.score.streakMultiplierCap
  );
  return Math.round(base * comboMultiplier * streakMultiplier);
}

export function applyShot(scoreState: ScoreState, shotOutcome: ShotOutcome, config: ScoreConfig): ScoreState {
  // 구조물만 부순 발사처럼 명중도 빗나감도 아닌 경우. 연속 배율을 올리지도,
  // 끊지도 않는다.
  if (shotOutcome.isNeutral) return scoreState;
  if (shotOutcome.isMiss) {
    return { score: scoreState.score, streak: 0 };
  }
  const gained = calculateShotScore(shotOutcome, scoreState.streak, config);
  return { score: scoreState.score + gained, streak: scoreState.streak + 1 };
}

// 라운드를 클리어할 때 미정산 점수를 골드로 바꾼다. 나머지는 버린다 —
// 이월을 만들면 상태가 하나 더 늘고 체감 차이가 없다.
//
// 나누기와 배율을 한 번에 곱하고 버림은 한 번만 한다. 나눈 뒤 버리고 곱하면
// 라운드마다 최대 1골드씩 새고 낮은 라운드일수록 그 비율이 크다.
export function roundSettlementGold(
  pendingScore: number,
  roundNumber: number,
  config: { scorePerGold: number; goldRoundMultiplierPerRound: number }
): number {
  if (pendingScore <= 0) return 0;
  const multiplier = 1 + (roundNumber - 1) * config.goldRoundMultiplierPerRound;
  // 나누기를 배율 곱셈보다 먼저 하면(예: (score / spg) * multiplier) 부동소수점
  // 오차로 200 * 2.05 가 409.99999999999994 로 나와 버림에서 1이 샌다. 곱셈을
  // 먼저 하면 이 케이스들에서 정확히 떨어진다.
  return Math.floor((pendingScore * multiplier) / config.scorePerGold);
}

export function createHighScoreStore(storage: Storage, key: string) {
  return {
    get() {
      const raw = storage.getItem(key);
      const value = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isNaN(value) ? 0 : value;
    },
    submit(score: number) {
      const current = this.get();
      if (score > current) {
        storage.setItem(key, String(score));
        return score;
      }
      return current;
    },
  };
}
