import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeBlastRadiusPx,
  findMonkeysInScreenBox,
} from '../game/src/gameplay/screenTargeting.js';

const RECT = { left: 0, top: 0, width: 800, height: 600 };

function makeCamera() {
  // 게임의 조준 상태와 같은 좁은 FOV. 카메라는 원점에서 -z를 본다.
  const camera = new THREE.PerspectiveCamera(9, RECT.width / RECT.height, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function fakeMonkey(x, y, z, { dying = false } = {}) {
  // screenTargeting은 이제 getCenterWorldPosition()만 사용한다. 기존 테스트들은
  // (x, y, z)를 "테스트 대상 지점"으로 다뤄왔으므로, 그 지점을 그대로 중심 좌표로
  // 노출해 기대값을 바꾸지 않고도 계속 통과하게 한다.
  return {
    isDying: () => dying,
    getWorldPosition: () => new THREE.Vector3(x, y, z),
    getCenterWorldPosition: () => new THREE.Vector3(x, y, z),
  };
}

describe('computeBlastRadiusPx', () => {
  it('scales the container height by the ratio', () => {
    expect(computeBlastRadiusPx(600, 0.25)).toBe(150);
  });

  it('returns 0 for a zero-height container', () => {
    expect(computeBlastRadiusPx(0, 0.25)).toBe(0);
  });
});

describe('findMonkeysInScreenBox', () => {
  it('includes a monkey dead centre in the crosshair', () => {
    const monkey = fakeMonkey(0, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([monkey]);
  });

  it('excludes a monkey far outside the box', () => {
    const monkey = fakeMonkey(40, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('includes monkeys at different depths along the same line of sight', () => {
    // 같은 레인의 앞뒤 원숭이. 화면상 같은 위치라 둘 다 잡혀야 한다.
    const near = fakeMonkey(0, 0, -78);
    const far = fakeMonkey(0, 0, -90);
    const found = findMonkeysInScreenBox([near, far], makeCamera(), RECT, 150);
    expect(found).toEqual([near, far]);
  });

  it('uses a square box, not a circle: the diagonal corner is included', () => {
    // 정사각형 모서리 방향. 원 판정이었다면 반경 밖이라 빠졌을 위치.
    const camera = makeCamera();
    const radiusPx = 150;
    // 화면상 (center + 140px, center + 140px) 근처에 놓이는 월드 좌표를 역산한다.
    const halfHeightAt80 = 80 * Math.tan(THREE.MathUtils.degToRad(9) / 2);
    const unitPerPx = halfHeightAt80 / (RECT.height / 2);
    const monkey = fakeMonkey(140 * unitPerPx, 140 * unitPerPx, -80);
    const found = findMonkeysInScreenBox([monkey], camera, RECT, radiusPx);
    expect(found).toEqual([monkey]);
  });

  it('excludes monkeys that are already dying', () => {
    const monkey = fakeMonkey(0, 0, -80, { dying: true });
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('excludes monkeys behind the camera', () => {
    // +z는 카메라 뒤. 투영하면 화면 중앙에 겹쳐 보이지만 맞으면 안 된다.
    const monkey = fakeMonkey(0, 0, 80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('respects a rect that is offset from the viewport origin', () => {
    const offsetRect = { left: 100, top: 50, width: 800, height: 600 };
    const monkey = fakeMonkey(0, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), offsetRect, 150);
    expect(found).toEqual([monkey]);
  });

  it('returns an empty array when given no monkeys', () => {
    expect(findMonkeysInScreenBox([], makeCamera(), RECT, 150)).toEqual([]);
  });

  it('includes a front-row monkey by its visual centre even though its ground-level feet would fall outside the box', () => {
    // 카메라는 y=1.6에 있고 원숭이 그룹 원점(발밑)은 y=-1.0(GROUND_Y)에 있다.
    // 이 2.6 높이 차이 때문에, 살짝 위로 조준하면 "발" 좌표는 박스 밖으로
    // 밀려나지만 몸통 중심은 여전히 안쪽에 남는다. 브라켓과 실제 판정이
    // 같은 지점을 봐야 한다는 설계 전제를 지키는 회귀 테스트.
    const camera = new THREE.PerspectiveCamera(9, 800 / 600, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    camera.rotation.x = 0.0122; // 약 0.7도 위로 피치업, lookLimitY(0.2rad) 이내
    camera.updateMatrixWorld(true);

    const groupOrigin = new THREE.Vector3(0, -1.0, -78);
    const centerLocalY = 1.05;
    const monkey = {
      isDying: () => false,
      getWorldPosition: () => groupOrigin.clone(),
      getCenterWorldPosition: () =>
        groupOrigin.clone().add(new THREE.Vector3(0, centerLocalY, 0)),
    };

    const found = findMonkeysInScreenBox([monkey], camera, RECT, 150);
    expect(found).toEqual([monkey]);
  });
});
