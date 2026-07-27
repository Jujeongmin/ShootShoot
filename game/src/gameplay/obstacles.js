import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CRATE_URL = '/models/crate.glb';
const SACK_TRENCH_URL = '/models/sack-trench.glb';
const CRATE_SCALE = 6;
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
const COLLAPSE_DURATION = 0.3;
const COLLAPSE_TILT = Math.PI / 2;
const COLLAPSE_DROP = 0.6;
// tools/measure-props.mjs 실측. 자루 참호는 로컬 y -0.0112 ~ 1.1829(높이 1.1941)라
// 중심은 원점보다 0.586 위다. 타워는 상자 2단 + 발판이 월드 y -1.0 ~ 1.229라 중심이 0.11.
// 그룹 원점이 아니라 이 중심으로 판정해야 "네모 안에 보이는데 안 부서지는" 문제가 없다.
const TRENCH_CENTER_Y = 0.586;
const TOWER_CENTER_Y = 0.11;

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
        const materials = [];
        instance.traverse((object) => {
          if (object.isMesh) {
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
            meshes.push(object);
            collectMaterials(object, materials);
          }
        });

        trenches.push({
          group,
          meshes,
          materials,
          baseY: GROUND_Y,
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_Y, placement.z),
        });
      });

      TOWER_PLACEMENTS.forEach((placement, towerIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, 0, placement.z);
        scene.add(group);

        const pillarMeshes = [];
        const materials = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
          for (let level = 0; level < 2; level++) {
            const crateInstance = crateGltf.scene.clone();
            crateInstance.scale.setScalar(CRATE_SCALE);
            crateInstance.position.set(
              offsetX,
              GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + level * CRATE_UNIT_HEIGHT,
              0
            );
            group.add(crateInstance);
            crateInstance.traverse((object) => {
              if (object.isMesh) {
                object.material = Array.isArray(object.material)
                  ? object.material.map((material) => material.clone())
                  : object.material.clone();
                object.castShadow = true;
                object.receiveShadow = true;
                object.userData = { towerIndex };
                pillarMeshes.push(object);
                collectMaterials(object, materials);
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
            collectMaterials(object, materials);
          }
        });

        towers.push({
          towerIndex,
          group,
          pillarMeshes,
          materials,
          baseY: 0,
          center: new THREE.Vector3(placement.x, TOWER_CENTER_Y, placement.z),
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
      });

      function advanceCollapse(structure, dt) {
        if (!structure.collapsing || structure.collapsed) return;
        structure.collapseElapsed += dt;
        const t = Math.min(structure.collapseElapsed / COLLAPSE_DURATION, 1);
        structure.group.rotation.z = t * COLLAPSE_TILT;
        // 타워는 y=0, 참호는 y=GROUND_Y에 있다. 각자의 기준 높이에서 떨어뜨려야
        // 참호가 순간이동하지 않는다.
        structure.group.position.y = structure.baseY - t * COLLAPSE_DROP;
        for (const material of structure.materials) {
          material.transparent = true;
          material.opacity = 1 - t;
        }
        if (t >= 1) {
          structure.collapsed = true;
          structure.group.visible = false;
        }
      }

      function update(dt) {
        for (const tower of towers) advanceCollapse(tower, dt);
        for (const trench of trenches) advanceCollapse(trench, dt);
      }

      function resetStructure(structure) {
        structure.collapsing = false;
        structure.collapsed = false;
        structure.collapseElapsed = 0;
        structure.group.visible = true;
        structure.group.rotation.z = 0;
        structure.group.position.y = structure.baseY;
        for (const material of structure.materials) {
          material.opacity = 1;
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
          towers.forEach((tower, index) => {
            if (!tower.collapsing && isInBox(tower.center)) {
              found.push({ kind: 'tower', index });
            }
          });
          trenches.forEach((trench, index) => {
            if (!trench.collapsing && isInBox(trench.center)) {
              found.push({ kind: 'trench', index });
            }
          });
          return found;
        },
        collapseStructure({ kind, index }) {
          const structure = listOf(kind)[index];
          if (!structure || structure.collapsing) return;
          structure.collapsing = true;
        },
        update,
        reset,
      };
    }
  );
}
