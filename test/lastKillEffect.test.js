import { describe, it, expect } from 'vitest';
import { createLastKillEffect } from '../game/src/gameplay/lastKillEffect.js';

describe('createLastKillEffect', () => {
  it('is inactive before any trigger', () => {
    const effect = createLastKillEffect();
    expect(effect.getTimeScale()).toBe(1);
    expect(effect.getFovDelta()).toBe(0);
  });

  it('activates immediately on trigger with full FOV delta and slow time scale', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBe(10);
  });

  it('eases the FOV delta back toward 0 as real time passes, while still active', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.3);
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBeCloseTo(5, 5);
  });

  it('deactivates once the effect duration has fully elapsed', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.6);
    expect(effect.getTimeScale()).toBe(1);
    expect(effect.getFovDelta()).toBe(0);
  });

  it('can be retriggered after deactivating', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.6);
    effect.trigger();
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBe(10);
  });
});
