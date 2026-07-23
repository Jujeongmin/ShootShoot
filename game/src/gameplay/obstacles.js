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
      const blockingMeshes = [];
      const towers = [];

      for (const placement of GROUND_PLACEMENTS) {
        const instance = sackTrenchGltf.scene.clone();
        instance.scale.setScalar(SACK_TRENCH_SCALE);
        instance.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(instance);
        instance.traverse((object) => {
          if (object.isMesh) {
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
            blockingMeshes.push(object);
          }
        });
      }

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
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
      });

      function update(dt) {
        for (const tower of towers) {
          if (!tower.collapsing || tower.collapsed) continue;
          tower.collapseElapsed += dt;
          const t = Math.min(tower.collapseElapsed / COLLAPSE_DURATION, 1);
          tower.group.rotation.z = t * COLLAPSE_TILT;
          tower.group.position.y = -t * COLLAPSE_DROP;
          for (const material of tower.materials) {
            material.transparent = true;
            material.opacity = 1 - t;
          }
          if (t >= 1) {
            tower.collapsed = true;
            tower.group.visible = false;
          }
        }
      }

      function reset() {
        for (const tower of towers) {
          tower.collapsing = false;
          tower.collapsed = false;
          tower.collapseElapsed = 0;
          tower.group.visible = true;
          tower.group.rotation.z = 0;
          tower.group.position.y = 0;
          for (const material of tower.materials) {
            material.opacity = 1;
          }
        }
      }

      return {
        getBlockingMeshes() {
          return blockingMeshes;
        },
        getPillarMeshes() {
          return towers.filter((tower) => !tower.collapsing).flatMap((tower) => tower.pillarMeshes);
        },
        getTowerSlots() {
          return towers.map((tower) => tower.monkeySlot);
        },
        collapseTower(towerIndex) {
          const tower = towers.find((t) => t.towerIndex === towerIndex);
          if (!tower || tower.collapsing) return;
          tower.collapsing = true;
        },
        update,
        reset,
      };
    }
  );
}
