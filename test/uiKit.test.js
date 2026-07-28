import { describe, it, expect } from 'vitest';
import { iconUrl, resolveIconSrc, TOKENS } from '../game/src/ui/kit.js';

describe('resolveIconSrc', () => {
  it('passes an explicit path through untouched', () => {
    expect(resolveIconSrc('/ui/arrow-w.png', 'black')).toBe('/ui/arrow-w.png');
  });

  it('resolves a bare name through the tone folder', () => {
    expect(resolveIconSrc('cart', 'white')).toBe('/icons/white/cart.png');
  });
});

describe('iconUrl', () => {
  it('builds a path under the requested tone folder', () => {
    expect(iconUrl('cart', 'white')).toBe('/icons/white/cart.png');
    expect(iconUrl('gear', 'black')).toBe('/icons/black/gear.png');
  });

  it('rejects an unknown tone instead of building a 404 path', () => {
    expect(() => iconUrl('cart', 'yellow')).toThrow(/tone/);
  });

  it('rejects an empty icon name', () => {
    expect(() => iconUrl('', 'white')).toThrow(/name/);
  });
});

describe('TOKENS', () => {
  it('exposes every colour the UI needs', () => {
    expect(Object.keys(TOKENS).sort()).toEqual([
      'danger', 'deep', 'face', 'grey', 'greyShadow', 'hi', 'ink', 'inkSoft', 'shadow', 'white',
    ]);
  });

  it('holds the measured Kenney values as six-digit hex', () => {
    for (const value of Object.values(TOKENS)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(TOKENS.face).toBe('#ffcc00');
    expect(TOKENS.grey).toBe('#dadce7');
    expect(TOKENS.danger).toBe('#e4503a');
  });
});
