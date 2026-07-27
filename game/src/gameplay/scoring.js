export function createScoreState() {
  return { score: 0, streak: 0, misses: 0 };
}

export function calculateShotScore(shotOutcome, streak, config) {
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

export function applyShot(scoreState, shotOutcome, config) {
  // 구조물만 부순 발사처럼 명중도 빗나감도 아닌 경우. 연속 배율을 올리지도,
  // 끊지도, 미스로 세지도 않는다.
  if (shotOutcome.isNeutral) return scoreState;
  if (shotOutcome.isMiss) {
    return { score: scoreState.score, streak: 0, misses: scoreState.misses + 1 };
  }
  const gained = calculateShotScore(shotOutcome, scoreState.streak, config);
  return { score: scoreState.score + gained, streak: scoreState.streak + 1, misses: scoreState.misses };
}

export function createHighScoreStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      const value = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isNaN(value) ? 0 : value;
    },
    submit(score) {
      const current = this.get();
      if (score > current) {
        storage.setItem(key, String(score));
        return score;
      }
      return current;
    },
  };
}
