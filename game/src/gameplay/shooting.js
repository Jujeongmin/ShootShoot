export function resolveShot(sortedHits) {
  if (sortedHits.length === 0) {
    return { isMiss: true, penetrationCount: 0, hits: [] };
  }
  const hits = sortedHits.map((hit, index) => ({ ...hit, penetrationIndex: index }));
  return { isMiss: false, penetrationCount: hits.length, hits };
}

export function computeHitDamage(part, weaponDamage, config) {
  return part === 'head' ? weaponDamage * config.weaponDamage.headshotMultiplier : weaponDamage;
}

export function resolveKillOutcome(shotOutcome, killedHits) {
  if (shotOutcome.isMiss) {
    return { isMiss: true, penetrationCount: 0, hits: [] };
  }
  return { isMiss: false, penetrationCount: killedHits.length, hits: killedHits };
}
