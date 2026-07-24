export function getRoundParams(roundNumber, config) {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = c.baseMonkeyScale;
  const monkeyHp = c.baseMonkeyHp + Math.floor(n / c.roundsPerMonkeyHpIncrease);
  return { roundNumber, monkeyCount, monkeySpeed, monkeyScale, monkeyHp };
}
