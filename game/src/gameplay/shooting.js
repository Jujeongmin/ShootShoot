export function resolveShot(sortedHits) {
  if (sortedHits.length === 0) {
    return { isMiss: true, penetrationCount: 0, hits: [] };
  }
  const hits = sortedHits.map((hit, index) => ({ ...hit, penetrationIndex: index }));
  return { isMiss: false, penetrationCount: hits.length, hits };
}
