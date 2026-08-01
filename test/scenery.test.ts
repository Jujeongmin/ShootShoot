import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createScenery } from '../game/src/gameplay/scenery';

// engine.ts 와 config.ts 의 실제 값이다. 저기가 바뀌면 여기도 바꿔야 한다 —
// 이 테스트가 지키는 계약이 "이 카메라로 봤을 때" 성립하는 것이기 때문이다.
const CAMERA_Y = 1.6;
const NORMAL_FOV = 60;
const AIM_FOV = 9;

// 16:9 부터 21:9 까지. 화면이 넓을수록 조준경이 좌우로 더 많이 담으므로
// 가장 넓은 것이 가장 빡빡한 조건이다.
const ASPECTS = [16 / 9, 16 / 10, 21 / 9];

function cameraAt(fov: number, aspect: number) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1400);
  camera.position.set(0, CAMERA_Y, 0);
  camera.lookAt(0, CAMERA_Y, -1);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function frustumOf(camera: THREE.PerspectiveCamera) {
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  );
}

function sceneryRoot() {
  const scene = new THREE.Scene();
  const scenery = createScenery(scene);
  // createScenery 가 root 그룹 하나만 붙인다.
  const root = scene.children[0];
  return { scenery, root };
}

describe('scenery placement', () => {
  it('keeps every decoration out of the scoped view, so the aim background stays clean', () => {
    const { scenery, root } = sceneryRoot();
    root.updateMatrixWorld(true);

    for (const aspect of ASPECTS) {
      const frustum = frustumOf(cameraAt(AIM_FOV, aspect));
      const intruders: string[] = [];
      for (const child of root.children) {
        const box = new THREE.Box3().setFromObject(child);
        if (frustum.intersectsBox(box)) {
          const c = box.getCenter(new THREE.Vector3());
          intruders.push(`${child.type} at (${c.x.toFixed(0)}, ${c.y.toFixed(0)}, ${c.z.toFixed(0)})`);
        }
      }
      // 조준하면 화각이 9° 로 좁아진다. 여기 뭐가 들어오면 표적 뒤가 지저분해진다.
      expect(intruders, `aspect ${aspect.toFixed(2)}`).toEqual([]);
    }

    scenery.dispose();
  });

  it('puts the shooter ledge inside the normal view, so the player can see what they stand on', () => {
    const { scenery, root } = sceneryRoot();
    root.updateMatrixWorld(true);
    const frustum = frustumOf(cameraAt(NORMAL_FOV, 16 / 9));

    // 발판은 카메라 바로 아래 z 가 양수 쪽까지 걸치는 유일한 물건이다.
    const ledge = root.children.find((child) => {
      const box = new THREE.Box3().setFromObject(child);
      return box.max.z > 0 && box.max.y < CAMERA_Y;
    });
    expect(ledge, '발판을 못 찾았다').toBeDefined();
    expect(frustum.intersectsBox(new THREE.Box3().setFromObject(ledge!))).toBe(true);

    scenery.dispose();
  });

  it('keeps the drifting rocks clear of the firing lane', () => {
    const { scenery, root } = sceneryRoot();
    root.updateMatrixWorld(true);

    // 섬 폭이 26(=±13)이다. 그보다 안쪽에 잔바위를 두면 사격선 한가운데 걸린다.
    // 발판은 일부러 가운데 있으므로 z 가 양수인 것은 뺀다.
    const lane = 13;
    for (const child of root.children) {
      const box = new THREE.Box3().setFromObject(child);
      if (box.max.z > 0) continue;
      const nearestX = Math.max(box.min.x, Math.min(0, box.max.x));
      expect(Math.abs(nearestX), `${child.type} at z=${box.getCenter(new THREE.Vector3()).z.toFixed(0)}`)
        .toBeGreaterThanOrEqual(lane);
    }

    scenery.dispose();
  });

  it('places everything inside the fog range, so nothing is drawn as flat sky', () => {
    const { scenery, root } = sceneryRoot();
    root.updateMatrixWorld(true);

    // world.ts 의 fog 가 80~900 이고 색이 배경색과 같다. 900 을 넘기면 100% 배경색이
    // 되어 드로우콜만 쓰고 안 보인다. 해는 fog: false 로 그 규칙에서 빠지므로 뺀다 —
    // 원반(CircleGeometry)을 쓰는 건 해뿐이라 그걸로 가려낸다.
    const fogFar = 900;
    for (const child of root.children) {
      const isSun = child instanceof THREE.Mesh && child.geometry.type === 'CircleGeometry';
      if (isSun) continue;
      const box = new THREE.Box3().setFromObject(child);
      const nearestCorner = new THREE.Vector3(
        Math.max(box.min.x, Math.min(0, box.max.x)),
        Math.max(box.min.y, Math.min(CAMERA_Y, box.max.y)),
        Math.max(box.min.z, Math.min(0, box.max.z))
      );
      const distance = nearestCorner.distanceTo(new THREE.Vector3(0, CAMERA_Y, 0));
      expect(distance, `${child.type} 가 fog far 밖이다`).toBeLessThan(fogFar);
    }

    scenery.dispose();
  });
});
