export type PopupTone = 'normal' | 'head' | 'combo';

interface ToneInput {
  hits: { part: string }[];
  penetrationCount: number;
}

// 순서가 game.ts의 효과음 분기와 같아야 한다. 관통이 헤드샷을 이긴다 —
// 통로를 무너뜨려 둘을 죽이면 소리가 sfx.combo()로 나므로 화면도 관통으로
// 보여야 한다. 뒤집으면 소리와 그림이 어긋난다.
export function scorePopupTone(outcome: ToneInput): PopupTone {
  if (outcome.penetrationCount > 1) return 'combo';
  // 효과음도 hits[0]만 본다. 같은 규칙을 쓴다.
  if (outcome.hits[0]?.part === 'head') return 'head';
  return 'normal';
}
