export function getRoundParams(roundNumber, config) {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const timeLimit = Math.max(c.baseTimeLimit - n * c.timeLimitDecreasePerRound, c.minTimeLimit);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = Math.max(c.baseMonkeyScale - n * c.monkeyScaleDecreasePerRound, c.minMonkeyScale);
  const monkeyHp = c.baseMonkeyHp + Math.floor(n / c.roundsPerMonkeyHpIncrease);
  return { roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale, monkeyHp };
}
