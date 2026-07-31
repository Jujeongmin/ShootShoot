// 구조물 슬롯이 그 라운드의 원숭이 수보다 많을 수 있다. 타워 둘에 통로 둘이면
// 슬롯이 넷인데 1라운드 원숭이는 셋이다. 슬롯을 먼저 다 채우면 레인이 비어서
// 판 전체가 구조물 위에만 서 있게 되므로, 레인에 최소 한 마리는 남긴다.
// 슬롯 배열의 순서가 곧 우선순위다 — 앞에 오는 타워가 먼저 찬다.
export function allocateMonkeys(monkeyCount: number, structureSlotCount: number) {
  const structureCount = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  return { structureCount, laneCount: monkeyCount - structureCount };
}
