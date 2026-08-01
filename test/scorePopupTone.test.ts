import { describe, it, expect } from 'vitest';
import { scorePopupTone } from '../game/src/ui/scorePopupTone';

describe('scorePopupTone', () => {
  it('calls a plain body hit normal', () => {
    expect(scorePopupTone({ hits: [{ part: 'body' }], penetrationCount: 1 })).toBe('normal');
  });

  it('calls a single head hit a headshot', () => {
    expect(scorePopupTone({ hits: [{ part: 'head' }], penetrationCount: 1 })).toBe('head');
  });

  it('calls a multi-kill a combo', () => {
    expect(
      scorePopupTone({ hits: [{ part: 'body' }, { part: 'body' }], penetrationCount: 2 })
    ).toBe('combo');
  });

  // 회귀 방어. game.ts는 효과음을 고를 때 penetrationCount를 part보다 먼저 본다.
  // 화면만 head로 뜨면 소리는 콤보인데 그림은 헤드샷인 불일치가 난다.
  it('lets a combo outrank a headshot, matching the sfx ordering', () => {
    expect(scorePopupTone({ hits: [{ part: 'head' }], penetrationCount: 3 })).toBe('combo');
  });

  it('falls back to normal when no hit was recorded', () => {
    expect(scorePopupTone({ hits: [], penetrationCount: 1 })).toBe('normal');
  });

  it('treats a zero penetration count as normal rather than combo', () => {
    expect(scorePopupTone({ hits: [{ part: 'body' }], penetrationCount: 0 })).toBe('normal');
  });
});
