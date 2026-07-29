// 거리순 교차를 훑어 총알이 실제로 지나간 것들을 모은다. 원숭이와 나무상자는
// 뚫고 지나가고, 그 밖의 것(모래자루 참호)은 총알을 거기서 멈춘다.
// 같은 원숭이의 메시 여러 개, 한 타워의 상자 여러 개가 걸리므로 각각 한 번만 담는다.
export function partitionShotPath(entries) {
  const monkeyIds = [];
  const towerIndices = [];
  const seenMonkeys = new Set();
  const seenTowers = new Set();

  for (const entry of entries) {
    if (entry.monkeyId) {
      if (!seenMonkeys.has(entry.monkeyId)) {
        seenMonkeys.add(entry.monkeyId);
        monkeyIds.push(entry.monkeyId);
      }
      continue;
    }
    // towerIndex 는 0 일 수 있다. 참/거짓으로 보면 첫 타워가 통째로 사라진다.
    if (entry.towerIndex !== undefined) {
      if (!seenTowers.has(entry.towerIndex)) {
        seenTowers.add(entry.towerIndex);
        towerIndices.push(entry.towerIndex);
      }
      continue;
    }
    break;
  }

  return { monkeyIds, towerIndices };
}

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
