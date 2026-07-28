import { describe, it, expect } from 'vitest';
import { createReloadState } from '../game/src/gameplay/reloadState.js';

describe('createReloadState', () => {
  it('starts idle', () => {
    const reload = createReloadState(0.8);
    expect(reload.isReloading()).toBe(false);
    expect(reload.remaining()).toBe(0);
  });

  it('is reloading for the full duration after start', () => {
    const reload = createReloadState(0.8);
    reload.start();
    expect(reload.isReloading()).toBe(true);
    expect(reload.remaining()).toBeCloseTo(0.8);
  });

  it('counts down by the frame delta', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(0.3);
    expect(reload.remaining()).toBeCloseTo(0.5);
    expect(reload.isReloading()).toBe(true);
  });

  it('finishes exactly at zero rather than going negative on a long frame', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(5);
    expect(reload.remaining()).toBe(0);
    expect(reload.isReloading()).toBe(false);
  });

  it('stays finished when ticked again', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(1);
    reload.tick(1);
    expect(reload.remaining()).toBe(0);
  });

  it('restarts from the full duration', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(0.6);
    reload.start();
    expect(reload.remaining()).toBeCloseTo(0.8);
  });

  it('reset clears an in-progress reload', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.reset();
    expect(reload.isReloading()).toBe(false);
    expect(reload.remaining()).toBe(0);
  });
});
