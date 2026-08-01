import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createEffects } from '../game/src/gameplay/effects';

// THREE.Scene 전체(isScene, fog 등 80여 개 필드)를 흉내 낼 필요는 없다 —
// createEffects가 실제로 쓰는 건 add/remove 뿐이다. 그래서 그 둘만 갖춘 가짜를
// 만들고, 테스트에서 scene.add.mock 처럼 목(mock)으로도 계속 쓸 수 있도록
// fakeScene() 자체는 캐스팅하지 않은 채로 두고, 실제 함수에 넘기는 지점에서만
// asScene()으로 타입을 맞춘다.
function fakeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

function asScene(scene: ReturnType<typeof fakeScene>): THREE.Scene {
  return scene as unknown as THREE.Scene;
}

describe('createEffects', () => {
  it('adds a group to the scene for a hit burst', () => {
    const scene = fakeScene();
    createEffects(asScene(scene)).spawnHitBurst(new THREE.Vector3(0, 0, -10));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('removes a hit burst once its lifetime elapses', () => {
    const scene = fakeScene();
    const effects = createEffects(asScene(scene));
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.update(0.6);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('adds a group to the scene for an explosion', () => {
    const scene = fakeScene();
    createEffects(asScene(scene)).spawnExplosion(new THREE.Vector3(0, 0, -80));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('keeps an explosion alive longer than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(asScene(scene));
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    effects.update(0.6);
    expect(scene.remove).not.toHaveBeenCalled();
    effects.update(0.4);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('gives an explosion more particles than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(asScene(scene));
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    const [burstGroup] = scene.add.mock.calls[0];
    const [explosionGroup] = scene.add.mock.calls[1];
    expect(explosionGroup.children.length).toBeGreaterThan(burstGroup.children.length);
  });
});
