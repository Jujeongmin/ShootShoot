import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createEffects } from '../game/src/gameplay/effects.js';

function fakeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

describe('createEffects', () => {
  it('adds a group to the scene for a hit burst', () => {
    const scene = fakeScene();
    createEffects(scene).spawnHitBurst(new THREE.Vector3(0, 0, -10));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('removes a hit burst once its lifetime elapses', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.update(0.6);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('adds a group to the scene for an explosion', () => {
    const scene = fakeScene();
    createEffects(scene).spawnExplosion(new THREE.Vector3(0, 0, -80));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('keeps an explosion alive longer than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    effects.update(0.6);
    expect(scene.remove).not.toHaveBeenCalled();
    effects.update(0.4);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('gives an explosion more particles than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    const [burstGroup] = scene.add.mock.calls[0];
    const [explosionGroup] = scene.add.mock.calls[1];
    expect(explosionGroup.children.length).toBeGreaterThan(burstGroup.children.length);
  });
});
