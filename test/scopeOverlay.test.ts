import { describe, it, expect } from 'vitest';
import { bazookaReticleHtml } from '../game/src/ui/scopeOverlay';

// 바주카 조준선의 네 모서리 브래킷은 장식이 아니라 판정 사각형의 경계다.
// 여기 수치가 바뀌면 플레이어가 보는 상자와 실제로 죽는 범위가 어긋난다.
describe('bazookaReticleHtml', () => {
  it('keeps each corner arm at 0.42 of the blast radius', () => {
    expect(bazookaReticleHtml(100)).toContain('width:42px');
  });

  it('keeps the core centred on the radius, so the box stays 2r across', () => {
    expect(bazookaReticleHtml(100)).toContain('left:84px');
  });
});
