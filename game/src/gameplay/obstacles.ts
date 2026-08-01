import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createDebrisBody, impactImpulse } from './debris';
import type { HitUserData } from './hitUserData';

// 원숭이가 올라설 수 있는 자리 하나. targetManager가 이 슬롯 배열을 받아
// 타워/통로 위에 원숭이를 앉힌다.
export interface StructureSlot {
  x: number;
  y: number;
  z: number;
  towerIndex: number;
  sway: { amplitude: number; frequencyPerSpeed: number; phase: number };
}

type StructureKind = 'tower' | 'trench';

// 붕괴 애니메이션이 굴리는 조각 하나. makePiece가 만들고 startCollapse/
// advanceCollapse/resetStructure가 같이 다룬다.
interface Piece {
  object: THREE.Object3D;
  materials: THREE.Material[];
  homeParent: THREE.Object3D | null;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
  restOffset: number;
  centerOffsetY: number;
  body: ReturnType<typeof createDebrisBody> | null;
  restedFor: number;
  settled: boolean;
}

// 타워와 통로(참호 포함)가 붕괴 로직에서 공유하는 필드. 타워/통로에는
// pillarMeshes·monkeySlots가, 참호에는 meshes가 따로 붙는다.
interface Structure {
  index: number;
  group: THREE.Group;
  pieces: Piece[];
  impactScale: number;
  sinkDepth: number;
  center: THREE.Vector3;
  collapsing: boolean;
  collapsed: boolean;
}

interface Tower extends Structure {
  pillarMeshes: THREE.Object3D[];
  monkeySlots: StructureSlot[];
}

interface Trench extends Structure {
  meshes: THREE.Object3D[];
}

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
// 기둥 한 개가 쌓는 상자 단수. addCratePillar의 반복 횟수와 pillarTopY 계산이
// 서로 다른 곳에서 이 숫자를 따로 하드코딩하면, 단수를 바꿀 때 한쪽만 고쳐서
// 발판과 원숭이가 상자보다 위나 아래에 떠 버릴 수 있다.
const PILLAR_LEVELS = 2;
const FLOOR_ROTATION_X = -Math.PI / 2;
// tools/measure-tower-floor.mjs 실측값. 이전 값(0.7751)은 회전 전 z깊이를 그대로
// "두께"로 썼는데, 실제로 눕히면 원점이 두께 중간이 아니라 걸쳐 있어서
// floor.position.y(=pillarTopY) 기준 바닥면은 -0.4808, 윗면은 +0.2943에 있다.
// 즉 원숭이 슬롯이 실제 윗면보다 0.4808만큼 위에 떠 있었다.
const FLOOR_THICKNESS = 0.2943;
// 조각을 밀어내는 세기. 거리로 나눠 쓰므로 가까운 조각이 이 값에 가깝게 튄다.
const DEBRIS_IMPACT_STRENGTH = 26;
// 조각이 멀리 날아가면 부서진 게 아니라 튕겨 나간 것처럼 보인다. 미는 세기는
// 명중 방향으로 기울 만큼만 남기고 나머지는 중력에 맡겨 제자리에서 무너뜨린다.
// 상자가 참호보다 조금 센 이유: 타워는 조각이 다섯, 통로는 아홉(그마저도 9.5
// 폭에 흩어져 있다)이라 아예 안 밀면 같은 자리에 겹쳐 쌓여 한 덩이로 뭉개진다
// (조각끼리 충돌을 안 하므로). 둘 다 이 값을 그대로 같이 쓴다.
const TOWER_IMPACT_SCALE = 0.25;
const TRENCH_IMPACT_SCALE = 0.12;
// 멈출 때 바닥보다 이만큼 아래로 가라앉는다. 지면에 얹힌 게 아니라 파묻힌 잔해로
// 보인다. 참호가 더 깊은 건 자루벽이 메시 하나라 형태를 그만큼 더 지워야 하기 때문.
const TOWER_SINK_DEPTH = 0.3;
const TRENCH_SINK_DEPTH = 0.45;
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

// tools/measure-props.mjs 실측: 자루 포대의 가로가 3.1619다. 판을 이 폭만큼씩
// 밀어 이어 붙이면 틈 없이 하나의 통로가 된다.
// 원점이 판 한가운데가 아니다 (로컬 x -1.5247 ~ +1.6372, 중심 +0.0562). 간격을
// 폭으로 주면 이어 붙는 것은 그대로고 통로 전체가 그룹 원점보다 0.056 오른쪽으로
// 쏠릴 뿐이라 보정하지 않는다. 이 값을 "버그"로 보고 고치려 하지 말 것.
const WALKWAY_PANEL_WIDTH = 3.1619;
const WALKWAY_PANELS = 3;
// 원숭이 두 마리가 각자 자기 반쪽만 걷는다. 슬롯 간격 4.74가 진폭 두 배(3.6)보다
// 넓어 서로 겹치지 않고, 바깥 끝 2.37+1.8=4.17이 통로 반폭 4.74보다 안쪽이라
// 발판에서 떨어지지도 않는다.
const WALKWAY_SLOT_OFFSET_X = 2.37;
const WALKWAY_SWAY_AMPLITUDE = 1.8;
// 레인 원숭이와 같은 값(laneLayout.js의 SWAY_FREQUENCY_PER_SPEED). 통로 위와
// 아래가 같은 박자로 움직여야 한 판으로 읽힌다.
const WALKWAY_SWAY_FREQUENCY_PER_SPEED = 1.8;
// 기존 구조물보다 앞에 세워 앞 겹으로 읽히게 한다. 눈대중 값이다.
const WALKWAY_PLACEMENTS = [{ x: 0, z: -67 }];

function collectMaterials(object: THREE.Mesh, materials: THREE.Material[]) {
  const mats = Array.isArray(object.material) ? object.material : [object.material];
  materials.push(...mats);
}

// 인스턴스마다 머티리얼을 복제해야 한 구조물이 부서질 때 나머지가 같이 투명해지지 않는다.
function prepareInstance(instance: THREE.Object3D, onMesh?: (object: THREE.Mesh) => void) {
  instance.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
    if (onMesh) onMesh(object);
  });
}

// 조각 하나를 기록한다. 붕괴가 시작되면 이 오브젝트가 그룹에서 떨어져 나와 혼자 움직인다.
function makePiece(object: THREE.Object3D): Piece {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);

  const materials: THREE.Material[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) collectMaterials(child, materials);
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
    // 착지 자세 보정(advanceCollapse)을 딱 한 번만 하기 위한 플래그.
    settled: false,
  };
}

export function loadObstacles(scene: THREE.Scene) {
  const loader = new GLTFLoader();
  return Promise.all([loader.loadAsync(CRATE_URL), loader.loadAsync(SACK_TRENCH_URL)]).then(
    ([crateGltf, sackTrenchGltf]) => {
      const towers: Tower[] = [];

      const trenches: Trench[] = [];

      // 상자 2단짜리 기둥 하나. 타워와 통로가 같은 높이여야 한 층으로 읽히므로
      // 두 곳이 이 함수를 같이 쓴다.
      function addCratePillar({
        group,
        offsetX,
        towerIndex,
        crateInstances,
        pillarMeshes,
      }: {
        group: THREE.Group;
        offsetX: number;
        towerIndex: number;
        crateInstances: THREE.Object3D[];
        pillarMeshes: THREE.Object3D[];
      }) {
        for (let level = 0; level < PILLAR_LEVELS; level++) {
          const crateInstance = crateGltf.scene.clone();
          crateInstance.scale.set(CRATE_SCALE, CRATE_SCALE, CRATE_SCALE * CRATE_DEPTH_RATIO);
          crateInstance.position.set(
            offsetX,
            GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + level * CRATE_UNIT_HEIGHT,
            0
          );
          group.add(crateInstance);
          crateInstances.push(crateInstance);
          prepareInstance(crateInstance, (object) => {
            object.userData = { towerIndex } satisfies HitUserData;
            pillarMeshes.push(object);
          });
        }
      }

      // 발판 한 장. 타워는 한 장, 통로는 세 장을 x만 바꿔 가며 이 함수로 만든다.
      function addFloorPanel({
        group,
        offsetX,
        pillarTopY,
      }: {
        group: THREE.Group;
        offsetX: number;
        pillarTopY: number;
      }) {
        const floor = sackTrenchGltf.scene.clone();
        floor.scale.setScalar(SACK_TRENCH_SCALE);
        floor.rotation.x = FLOOR_ROTATION_X;
        floor.position.set(offsetX, pillarTopY, 0);
        group.add(floor);
        prepareInstance(floor);
        return floor;
      }

      GROUND_PLACEMENTS.forEach((placement, trenchIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(group);

        const instance = sackTrenchGltf.scene.clone();
        instance.scale.setScalar(SACK_TRENCH_SCALE);
        group.add(instance);

        const meshes: THREE.Object3D[] = [];
        prepareInstance(instance, (object) => meshes.push(object));

        trenches.push({
          index: trenchIndex,
          group,
          meshes,
          // 자루벽 모델은 메시가 하나라 조각도 하나다. 날려 보내지 않고 주저앉힌다.
          pieces: [makePiece(instance)],
          impactScale: TRENCH_IMPACT_SCALE,
          sinkDepth: TRENCH_SINK_DEPTH,
          collapsing: false,
          collapsed: false,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_LOCAL_Y, placement.z),
        });
      });

      TOWER_PLACEMENTS.forEach((placement, towerIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, 0, placement.z);
        scene.add(group);

        const pillarMeshes: THREE.Object3D[] = [];
        const crateInstances: THREE.Object3D[] = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
          addCratePillar({ group, offsetX, towerIndex, crateInstances, pillarMeshes });
        }

        const pillarTopY = GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + PILLAR_LEVELS * CRATE_UNIT_HEIGHT;
        const floor = addFloorPanel({ group, offsetX: 0, pillarTopY });

        towers.push({
          index: towerIndex,
          group,
          pillarMeshes,
          // 상자 4개와 발판 1개. 모델이 전부 메시 하나라 이 이상 못 쪼갠다.
          pieces: [...crateInstances, floor].map(makePiece),
          impactScale: TOWER_IMPACT_SCALE,
          sinkDepth: TOWER_SINK_DEPTH,
          center: new THREE.Vector3(placement.x, 0 + TOWER_CENTER_LOCAL_Y, placement.z),
          collapsing: false,
          collapsed: false,
          monkeySlots: [
            {
              x: placement.x,
              y: pillarTopY + FLOOR_THICKNESS,
              z: placement.z,
              towerIndex,
              // 발판이 한 장뿐이라 제자리에 선다. frequencyPerSpeed 1은 예전에
              // targetManager가 하드코딩하던 frequency: monkeySpeed 와 같은 값이다.
              sway: { amplitude: 0, frequencyPerSpeed: 1, phase: 0 },
            },
          ],
        });
      });

      // 통로는 "조각이 더 많고 원숭이 슬롯이 둘인 타워"다. towers 배열에 같이 넣으면
      // 기둥 쏘면 무너지는 경로(userData.towerIndex → collapseStructure)가 그대로 붙는다.
      WALKWAY_PLACEMENTS.forEach((placement, walkwayIndex) => {
        const towerIndex = TOWER_PLACEMENTS.length + walkwayIndex;
        const group = new THREE.Group();
        group.position.set(placement.x, 0, placement.z);
        scene.add(group);

        const pillarMeshes: THREE.Object3D[] = [];
        const crateInstances: THREE.Object3D[] = [];
        const floorInstances: THREE.Object3D[] = [];
        const pillarTopY = GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + PILLAR_LEVELS * CRATE_UNIT_HEIGHT;

        for (let panel = 0; panel < WALKWAY_PANELS; panel++) {
          // 가운데를 0으로 두고 판 폭만큼씩 좌우로 민다.
          const offsetX = (panel - (WALKWAY_PANELS - 1) / 2) * WALKWAY_PANEL_WIDTH;
          addCratePillar({ group, offsetX, towerIndex, crateInstances, pillarMeshes });
          floorInstances.push(addFloorPanel({ group, offsetX, pillarTopY }));
        }

        towers.push({
          index: towerIndex,
          group,
          pillarMeshes,
          // 상자 6개와 발판 3장. 지금 타워(5개)의 두 배 가까운 조각이다.
          pieces: [...crateInstances, ...floorInstances].map(makePiece),
          impactScale: TOWER_IMPACT_SCALE,
          sinkDepth: TOWER_SINK_DEPTH,
          center: new THREE.Vector3(placement.x, 0 + TOWER_CENTER_LOCAL_Y, placement.z),
          collapsing: false,
          collapsed: false,
          monkeySlots: [-WALKWAY_SLOT_OFFSET_X, WALKWAY_SLOT_OFFSET_X].map((slotOffsetX, slotIndex) => ({
            x: placement.x + slotOffsetX,
            y: pillarTopY + FLOOR_THICKNESS,
            z: placement.z,
            towerIndex,
            sway: {
              amplitude: WALKWAY_SWAY_AMPLITUDE,
              frequencyPerSpeed: WALKWAY_SWAY_FREQUENCY_PER_SPEED,
              // 위상을 반대로 줘서 둘이 엇갈려 걷는다. 같은 위상이면 나란히
              // 붙어 다녀 한 마리처럼 보인다.
              phase: slotIndex * Math.PI,
            },
          })),
        });
      });

      // 명중점을 못 받은 경우. 구조물 중심보다 카메라 쪽을 때린 걸로 쳐서 조각이
      // 카메라 반대편으로 밀리게 한다.
      function defaultImpactPoint(structure: Structure) {
        return new THREE.Vector3(
          structure.center.x,
          structure.center.y,
          structure.center.z + DEFAULT_IMPACT_OFFSET_Z
        );
      }

      function startCollapse(structure: Structure, impactPoint?: THREE.Vector3) {
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
          const { velocity, spin } = impactImpulse(
            center,
            impact,
            DEBRIS_IMPACT_STRENGTH * structure.impactScale
          );
          piece.body = createDebrisBody({
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
            velocity,
            spin,
            restY: GROUND_Y + piece.restOffset - structure.sinkDepth,
          });
          piece.restedFor = 0;
          piece.settled = false;
        }
      }

      function advanceCollapse(structure: Structure, dt: number) {
        if (!structure.collapsing || structure.collapsed) return;

        let allGone = true;
        for (const piece of structure.pieces) {
          if (!piece.body) continue;
          const wasResting = piece.body.isResting();
          piece.body.step(dt);
          const isResting = piece.body.isResting();

          // 몸체가 멈춘 뒤에는 getPosition/getRotation이 착지 순간 값에 얼어붙는다.
          // 여기서 계속 덮어쓰면 아래 착지 보정으로 옮겨 둔 y가 다음 프레임에 바로
          // 원래 restY로 되돌아가 버리므로, 보정이 끝난(piece.settled) 조각은 더 이상
          // 몸체 값을 오브젝트에 복사하지 않는다 — 몸체가 멈췄으니 안 덮어써도 된다.
          if (!piece.settled) {
            const position = piece.body.getPosition();
            const rotation = piece.body.getRotation();
            piece.object.position.set(position.x, position.y, position.z);
            piece.object.rotation.set(rotation.x, rotation.y, rotation.z);
          }

          if (isResting && !wasResting && !piece.settled) {
            // restY는 붕괴 시작 시점의 "눕지 않은" 자세를 기준으로 잰 값이라, 구르다가
            // 옆으로 눕거나 기울어진 채로 멈추면 실제 밑면과 어긋난다(상자는 세운
            // 상태 0.96 높이와 누운 상태 0.21 두께가 크게 다르다). 몸체가 멈춘 이
            // 프레임에 한해, 지금 자세 그대로의 실제 월드 바운딩 박스로 다시 한 번
            // 보정한다. 몸체는 멈춘 뒤로 다시는 위치를 바꾸지 않으므로(위 if에서 더는
            // 복사하지 않으므로) 몸체 내부 y와 오브젝트 y가 이 순간부터 어긋나도
            // 이후 프레임에 영향이 없다.
            const box = new THREE.Box3().setFromObject(piece.object);
            piece.object.position.y += GROUND_Y - structure.sinkDepth - box.min.y;
            piece.settled = true;
          }

          if (!isResting) {
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

      function update(dt: number) {
        for (const tower of towers) advanceCollapse(tower, dt);
        for (const trench of trenches) advanceCollapse(trench, dt);
      }

      function resetStructure(structure: Structure) {
        structure.collapsing = false;
        structure.collapsed = false;
        structure.group.visible = true;
        structure.group.rotation.z = 0;

        for (const piece of structure.pieces) {
          piece.body = null;
          piece.restedFor = 0;
          piece.settled = false;
          // 조각이 scene 밑으로 나가 있다. 원래 부모로 돌려놓고 저장해 둔 로컬
          // 변환을 그대로 씌운다 — attach 가 월드를 보존하려 들기 때문에 덮어야 한다.
          // homeParent는 makePiece가 부를 당시의 부모를 그대로 기록한 값이라 null일 수 없다.
          piece.homeParent!.attach(piece.object);
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

      function listOf(kind: StructureKind): Structure[] {
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
          return towers.flatMap((tower) => tower.monkeySlots);
        },
        findStructuresInBox(isInBox: (point: THREE.Vector3) => boolean) {
          const found: Array<{ kind: StructureKind; index: number }> = [];
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
        collapseStructure({
          kind,
          index,
          impactPoint,
        }: {
          kind: StructureKind;
          index: number;
          impactPoint?: THREE.Vector3;
        }) {
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
