import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBazookaProjectiles } from '../game/src/gameplay/bazookaProjectile';

// THREE.Scene 전체(isScene, fog 등 80여 개 필드)를 흉내 낼 필요는 없다 —
// createBazookaProjectiles가 실제로 쓰는 건 add/remove 뿐이다. 그래서 그 둘만
// 갖춘 가짜를 만들고, 테스트에서 scene.add.mock 처럼 목(mock)으로도 계속 쓸 수
// 있도록 fakeScene() 자체는 캐스팅하지 않은 채로 두고, 실제 함수에 넘기는
// 지점에서만 asScene()으로 타입을 맞춘다.
function fakeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

function asScene(scene: ReturnType<typeof fakeScene>): THREE.Scene {
  return scene as unknown as THREE.Scene;
}

const FROM = new THREE.Vector3(0, 0, 0);
const TO = new THREE.Vector3(0, 0, -80);

describe('createBazookaProjectiles', () => {
  it('has nothing pending before anything is spawned', () => {
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    expect(projectiles.hasPending()).toBe(false);
  });

  it('adds a mesh to the scene on spawn and reports it as pending', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(asScene(scene));
    projectiles.spawn(FROM, TO, 0.3, () => {});
    expect(scene.add).toHaveBeenCalledTimes(1);
    expect(projectiles.hasPending()).toBe(true);
  });

  it('does not call onImpact before the flight time has elapsed', () => {
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.1);
    projectiles.update(0.1);
    expect(onImpact).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);
  });

  it('calls onImpact with the impact point once the flight time elapses', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(asScene(scene));
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.3);
    expect(onImpact).toHaveBeenCalledTimes(1);
    expect(onImpact.mock.calls[0][0].z).toBeCloseTo(-80, 6);
    expect(projectiles.hasPending()).toBe(false);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('calls onImpact exactly once even if update keeps being called', () => {
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.5);
    projectiles.update(0.5);
    projectiles.update(0.5);
    expect(onImpact).toHaveBeenCalledTimes(1);
  });

  it('moves the mesh partway along the path while in flight', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(asScene(scene));
    projectiles.spawn(FROM, TO, 0.4, () => {});
    projectiles.update(0.2);
    const mesh = scene.add.mock.calls[0][0];
    expect(mesh.position.z).toBeCloseTo(-40, 6);
  });

  it('tracks several projectiles independently', () => {
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    const first = vi.fn();
    const second = vi.fn();
    projectiles.spawn(FROM, TO, 0.2, first);
    projectiles.spawn(FROM, TO, 0.6, second);

    projectiles.update(0.2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);

    projectiles.update(0.4);
    expect(second).toHaveBeenCalledTimes(1);
    expect(projectiles.hasPending()).toBe(false);
  });

  it('discards pending projectiles on clear without firing their callbacks', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(asScene(scene));
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.clear();

    expect(projectiles.hasPending()).toBe(false);
    expect(scene.remove).toHaveBeenCalledTimes(1);

    projectiles.update(1.0);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('survives a callback clearing the array mid-pass when two projectiles impact on the same update()', () => {
    // update()는 배열을 뒤(높은 인덱스)에서부터 훑는다. 나중에 spawn한 포탄이 더
    // 높은 인덱스를 가지므로 먼저 처리된다. 그 착탄 콜백이 endGame() 흐름을 타고
    // clear()를 호출하면, 아직 처리하지 않은 낮은 인덱스 포탄이 배열에서 이미
    // 사라진 뒤라 다음 반복이 undefined를 읽는다. 가드가 없으면 "Cannot read
    // properties of undefined"로 던지고 렌더 루프가 영구히 멈춘다.
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    const first = vi.fn();
    projectiles.spawn(FROM, TO, 0.2, first);
    projectiles.spawn(FROM, TO, 0.2, () => {
      projectiles.clear();
    });

    expect(() => projectiles.update(0.2)).not.toThrow();
    expect(projectiles.hasPending()).toBe(false);
  });

  it('lets a callback spawn another projectile without disturbing the update pass', () => {
    const projectiles = createBazookaProjectiles(asScene(fakeScene()));
    const second = vi.fn();
    projectiles.spawn(FROM, TO, 0.2, () => {
      projectiles.spawn(FROM, TO, 0.2, second);
    });

    projectiles.update(0.2);
    expect(second).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);

    projectiles.update(0.2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
