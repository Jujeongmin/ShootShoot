import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createDebrisBody, impactImpulse } from './debris.js';

const CRATE_URL = '/models/crate.glb';
const SACK_TRENCH_URL = '/models/sack-trench.glb';
const CRATE_SCALE = 6;
// 상자를 사격 방향(z)으로만 납작하게 만든다. 총알이 뚫고 지나가는 널빤지로
// 보여야 하는데, x·y 까지 줄이면 단 높이와 그 위 원숭이 발판이 같이 내려간다.
// 0.22는 실측값이 아니라 순전히 눈대중으로 고른 비율이다 — 이 값을 뒷받침하는
// 측정 도구는 없으니 찾으려 하지 말 것.
const CRATE_DEPTH_RATIO = 0.22;
const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;
// tools/measure-props.mjs 실측값. 상자 원점은 바닥보다 0.0119 위에 있어서,
// position.y를 그만큼 올려야 상자 바닥이 지면에 정확히 닿는다.
const CRATE_UNIT_HEIGHT = 0.9614;
const CRATE_ORIGIN_TO_BOTTOM = 0.0119;
const PILLAR_OFFSET_X = 0.8;
const FLOOR_ROTATION_X = -Math.PI / 2;
// tools/measure-tower-floor.mjs 실측값. 이전 값(0.7751)은 회전 전 z깊이를 그대로
// "두께"로 썼는데, 실제로 눕히면 원점이 두께 중간이 아니라 걸쳐 있어서
// floor.position.y(=pillarTopY) 기준 바닥면은 -0.4808, 윗면은 +0.2943에 있다.
// 즉 원숭이 슬롯이 실제 윗면보다 0.4808만큼 위에 떠 있었다.
const FLOOR_THICKNESS = 0.2943;
// 조각을 밀어내는 세기. 거리로 나눠 쓰므로 가까운 조각이 이 값에 가깝게 튄다.
const DEBRIS_IMPACT_STRENGTH = 26;
// 멈춘 조각을 얼마나 두었다가 지울지. 부순 흔적이 잠깐 남아야 타격감이 산다.
const DEBRIS_HOLD_SECONDS = 1.5;
const DEBRIS_FADE_SECONDS = 0.5;
// 명중점을 못 받았을 때 쓸 기본값. 구조물 중심에서 카메라 쪽으로 이만큼 당긴
// 지점을 때린 걸로 치면 조각이 카메라 반대편으로 밀려 예전 붕괴와 방향이 비슷하다.
const DEFAULT_IMPACT_OFFSET_Z = 1.2;
// tools/measure-props.mjs 실측. 자루 참호는 로컬 y -0.0112 ~ 1.1829(높이 1.1941)라
// 중심은 그룹 원점(참호는 GROUND_Y)보다 0.586 위다. 타워는 상자 2단 + 발판이 월드
// y -1.0 ~ 1.229라 중심이 월드 0.11인데, 타워 그룹도 y=0에 있으므로 그룹 원점보다
// 0.11 위다. 둘 다 "그 구조물 그룹 원점 기준 로컬 오프셋"이며, 판정은 baseY + LOCAL로
// 구한 절대 중심으로 해야 "네모 안에 보이는데 안 부서지는" 문제가 없다.
const TRENCH_CENTER_LOCAL_Y = 0.586;
const TOWER_CENTER_LOCAL_Y = 0.11;

const GROUND_PLACEMENTS = [
  { x: -7, z: -70 },
  { x: 6, z: -73 },
];

const TOWER_PLACEMENTS = [
  { x: 1.5, z: -72 },
  { x: -4.5, z: -75 },
];

function collectMaterials(object, materials) {
  const mats = Array.isArray(object.material) ? object.material : [object.material];
  materials.push(...mats);
}

// 조각 하나를 기록한다. 붕괴가 시작되면 이 오브젝트가 그룹에서 떨어져 나와 혼자 움직인다.
function makePiece(object) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);

  const materials = [];
  object.traverse((child) => {
    if (child.isMesh) collectMaterials(child, materials);
  });

  return {
    object,
    materials,
    homeParent: object.parent,
    homePosition: object.position.clone(),
    homeQuaternion: object.quaternion.clone(),
    // 조각 원점에서 가장 아래 면까지의 거리. 이걸 빼먹으면 원점이 바닥에 닿을 때까지
    // 내려가서 조각 절반이 땅에 파묻힌 채로 멈춘다.
    restOffset: worldPosition.y - box.min.y,
    // 원점이 조각 한가운데가 아니다. 지렛대를 원점으로 재면 회전 방향이 틀린다.
    centerOffsetY: box.getCenter(new THREE.Vector3()).y - worldPosition.y,
    body: null,
    restedFor: 0,
  };
}

export function loadObstacles(scene) {
  const loader = new GLTFLoader();
  return Promise.all([loader.loadAsync(CRATE_URL), loader.loadAsync(SACK_TRENCH_URL)]).then(
    ([crateGltf, sackTrenchGltf]) => {
      const towers = [];

      const trenches = [];

      GROUND_PLACEMENTS.forEach((placement, trenchIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(group);

        const instance = sackTrenchGltf.scene.clone();
        instance.scale.setScalar(SACK_TRENCH_SCALE);
        group.add(instance);

        const meshes = [];
        instance.traverse((object) => {
          if (object.isMesh) {
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
            meshes.push(object);
          }
        });

        trenches.push({
          index: trenchIndex,
          group,
          meshes,
          // 자루벽 모델은 메시가 하나라 조각도 하나다. 한 덩이로 굴러간다.
          pieces: [makePiece(instance)],
          collapsing: false,
          collapsed: false,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_LOCAL_Y, placement.z),
        });
      });

      TOWER_PLACEMENTS.forEach((placement, towerIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, 0, placement.z);
        scene.add(group);

        const pillarMeshes = [];
        const crateInstances = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
          for (let level = 0; level < 2; level++) {
            const crateInstance = crateGltf.scene.clone();
            crateInstance.scale.set(CRATE_SCALE, CRATE_SCALE, CRATE_SCALE * CRATE_DEPTH_RATIO);
            crateInstance.position.set(
              offsetX,
              GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + level * CRATE_UNIT_HEIGHT,
              0
            );
            group.add(crateInstance);
            crateInstances.push(crateInstance);
            crateInstance.traverse((object) => {
              if (object.isMesh) {
                object.material = Array.isArray(object.material)
                  ? object.material.map((material) => material.clone())
                  : object.material.clone();
                object.castShadow = true;
                object.receiveShadow = true;
                object.userData = { towerIndex };
                pillarMeshes.push(object);
              }
            });
          }
        }

        const pillarTopY = GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + 2 * CRATE_UNIT_HEIGHT;
        const floor = sackTrenchGltf.scene.clone();
        floor.scale.setScalar(SACK_TRENCH_SCALE);
        floor.rotation.x = FLOOR_ROTATION_X;
        floor.position.set(0, pillarTopY, 0);
        group.add(floor);
        floor.traverse((object) => {
          if (object.isMesh) {
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        towers.push({
          index: towerIndex,
          group,
          pillarMeshes,
          // 상자 4개와 발판 1개. 모델이 전부 메시 하나라 이 이상 못 쪼갠다.
          pieces: [...crateInstances, floor].map(makePiece),
          center: new THREE.Vector3(placement.x, 0 + TOWER_CENTER_LOCAL_Y, placement.z),
          collapsing: false,
          collapsed: false,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
      });

      // 명중점을 못 받은 경우. 구조물 중심보다 카메라 쪽을 때린 걸로 쳐서 조각이
      // 카메라 반대편으로 밀리게 한다.
      function defaultImpactPoint(structure) {
        return new THREE.Vector3(
          structure.center.x,
          structure.center.y,
          structure.center.z + DEFAULT_IMPACT_OFFSET_Z
        );
      }

      function startCollapse(structure, impactPoint) {
        structure.collapsing = true;
        const impact = impactPoint ?? defaultImpactPoint(structure);

        for (const piece of structure.pieces) {
          const object = piece.object;
          // attach 는 월드 변환을 보존하므로 조각이 있던 자리에 그대로 남는다.
          // 붙이고 나면 scene 이 원점에 있으므로 local 좌표가 곧 월드 좌표다.
          scene.attach(object);
          const center = {
            x: object.position.x,
            y: object.position.y + piece.centerOffsetY,
            z: object.position.z,
          };
          const { velocity, spin } = impactImpulse(center, impact, DEBRIS_IMPACT_STRENGTH);
          piece.body = createDebrisBody({
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
            velocity,
            spin,
            restY: GROUND_Y + piece.restOffset,
          });
          piece.restedFor = 0;
        }
      }

      function advanceCollapse(structure, dt) {
        if (!structure.collapsing || structure.collapsed) return;

        let allGone = true;
        for (const piece of structure.pieces) {
          if (!piece.body) continue;
          piece.body.step(dt);
          const position = piece.body.getPosition();
          const rotation = piece.body.getRotation();
          piece.object.position.set(position.x, position.y, position.z);
          piece.object.rotation.set(rotation.x, rotation.y, rotation.z);

          if (!piece.body.isResting()) {
            allGone = false;
            continue;
          }

          piece.restedFor += dt;
          const fadeElapsed = piece.restedFor - DEBRIS_HOLD_SECONDS;
          if (fadeElapsed <= 0) {
            allGone = false;
            continue;
          }

          const opacity = Math.max(0, 1 - fadeElapsed / DEBRIS_FADE_SECONDS);
          for (const material of piece.materials) {
            material.transparent = true;
            material.opacity = opacity;
          }
          if (opacity > 0) {
            allGone = false;
            continue;
          }
          piece.object.visible = false;
        }

        if (allGone) structure.collapsed = true;
      }

      function update(dt) {
        for (const tower of towers) advanceCollapse(tower, dt);
        for (const trench of trenches) advanceCollapse(trench, dt);
      }

      function resetStructure(structure) {
        structure.collapsing = false;
        structure.collapsed = false;
        structure.group.visible = true;
        structure.group.rotation.z = 0;

        for (const piece of structure.pieces) {
          piece.body = null;
          piece.restedFor = 0;
          // 조각이 scene 밑으로 나가 있다. 원래 부모로 돌려놓고 저장해 둔 로컬
          // 변환을 그대로 씌운다 — attach 가 월드를 보존하려 들기 때문에 덮어야 한다.
          piece.homeParent.attach(piece.object);
          piece.object.position.copy(piece.homePosition);
          piece.object.quaternion.copy(piece.homeQuaternion);
          piece.object.visible = true;
          for (const material of piece.materials) {
            material.opacity = 1;
            material.transparent = false;
          }
        }
      }

      function reset() {
        for (const tower of towers) resetStructure(tower);
        for (const trench of trenches) resetStructure(trench);
      }

      function listOf(kind) {
        if (kind === 'tower') return towers;
        if (kind === 'trench') return trenches;
        return [];
      }

      return {
        getBlockingMeshes() {
          return trenches
            .filter((trench) => !trench.collapsing)
            .flatMap((trench) => trench.meshes);
        },
        getPillarMeshes() {
          return towers.filter((tower) => !tower.collapsing).flatMap((tower) => tower.pillarMeshes);
        },
        getTowerSlots() {
          return towers.map((tower) => tower.monkeySlot);
        },
        findStructuresInBox(isInBox) {
          const found = [];
          towers.forEach((tower) => {
            if (!tower.collapsing && isInBox(tower.center)) {
              found.push({ kind: 'tower', index: tower.index });
            }
          });
          trenches.forEach((trench) => {
            if (!trench.collapsing && isInBox(trench.center)) {
              found.push({ kind: 'trench', index: trench.index });
            }
          });
          return found;
        },
        collapseStructure({ kind, index, impactPoint }) {
          const structure = listOf(kind).find((s) => s.index === index);
          if (!structure || structure.collapsing) return;
          startCollapse(structure, impactPoint);
        },
        update,
        reset,
      };
    }
  );
}
