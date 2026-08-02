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
  // 배율을 100분율 정수로 다룬다. 0.15 같은 값은 2진 부동소수로 정확히 표현되지
  // 않아서, 1 + 7 x 0.15 이 2.0499999999999998 이 되고 8라운드 2000점이 410이
  // 아니라 409로 떨어진다. 곱하고 나누는 순서를 바꾸면 그 케이스는 넘어가지만
  // 오차 자체는 남는다 - 유리수 정확값과 대조하면 12.8만 케이스 중 292개가 여전히
  // 어긋났다. 정수로 계산하면 어긋나는 케이스가 0이다.
  // Math.round(...* 100) 이 config 값을 소수 둘째 자리로 고정한다 - 나중에
  // goldRoundMultiplierPerRound 를 0.125 같은 값으로 바꾸면 조용히 0.13이 된다.
  const multiplierHundredths = 100 + (roundNumber - 1) * Math.round(config.goldRoundMultiplierPerRound * 100);
  return Math.floor((pendingScore * multiplierHundredths) / (config.scorePerGold * 100));
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
