export interface RoundParams {
  roundNumber: number;
  monkeyCount: number;
  monkeySpeed: number;
  monkeyScale: number;
  monkeyHp: number;
}

interface RoundConfig {
  baseMonkeyCount: number;
  monkeyCountIncreasePerRound: number;
  maxMonkeyCount: number;
  baseMonkeySpeed: number;
  monkeySpeedIncreasePerRound: number;
  baseMonkeyScale: number;
  baseMonkeyHp: number;
  roundsPerMonkeyHpIncrease: number;
}

export function getRoundParams(roundNumber: number, config: { round: RoundConfig }): RoundParams {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = c.baseMonkeyScale;
  const monkeyHp = c.baseMonkeyHp + Math.floor(n / c.roundsPerMonkeyHpIncrease);
  return { roundNumber, monkeyCount, monkeySpeed, monkeyScale, monkeyHp };
}
