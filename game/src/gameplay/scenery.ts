import * as THREE from 'three';
import { createSeededRandom } from './skyMotion';

// 이 파일은 순수 장식이다. game.ts 의 레이캐스트 대상은 targetManager 와 obstacles 가
// 내주는 명시적 목록뿐이라(handleShot 참고) 여기서 만든 것은 총알을 절대 막지 않는다.
// 그래서 사격선 근처에 둬도 판정이 안 바뀐다 — 시야만 신경 쓰면 된다.

// world.ts 의 것과 같은 값이다. 저기가 원본이고 여기는 높이를 맞추려고 다시 적는다.
const GROUND_Y = -1.0;

// 카메라가 (0, 1.6, 0) 인데 그 밑에 아무것도 없어서 플레이어가 허공에 떠 있었다.
// 발판을 깔아 어디에 서 있는지 보이게 한다.
//
// 앞 가장자리 z 를 정하는 게 이 블록의 전부다. 카메라에서 발판 윗면까지 2.6 아래고,
// 세로 화각 60° 의 절반이 30° 다. 앞 가장자리가 z = -6 이면 내려다보는 각이
// atan(2.6 / 6) = 23.4° 라 화면 아래쪽에 띠로 걸린다. -4 면 33° 라 화각 밖으로
// 나가서 조준을 내릴 때만 보이고, -12 면 화면 아래 3분의 1을 흙으로 덮는다.
const LEDGE_FRONT_Z = -6;
const LEDGE_BACK_Z = 8;
const LEDGE_WIDTH = 13;
const LEDGE_THICKNESS = 3;
const LEDGE_KEEL_RADIUS = 5.5;
const LEDGE_KEEL_HEIGHT = 9;

// 새(z=-150)와 구름(z=-400) 사이가 통째로 비어 있어서 섬 뒤가 갑자기 하늘이다.
// 그 사이를 메우는 중간 거리 섬들.
//
// x 를 정하는 방식이 이 블록에서 제일 중요하다. 조준하면 화각이 9° 로 좁아지고,
// 21:9 화면 기준 z=-380 에서 그 절반이 화면 가로로 약 70 유닛이다.
//
// **중심 거리가 아니라 가장자리 거리로 잡아야 한다.** 처음에 중심을 |x|>=70 으로
// 뒀다가 폭 96 짜리 섬의 안쪽 끝이 x=-25 에 와서 조준경 한복판에 걸렸다.
// test/scenery.test.ts 가 그걸 잡았다. 그래서 중심은 (여유 + 폭/2) 에서 시작한다.
const MID_ISLAND_COUNT = 5;
const MID_ISLAND_Z_NEAR = -220;
const MID_ISLAND_Z_FAR = -380;
const MID_ISLAND_EDGE_CLEARANCE = 88;
const MID_ISLAND_EXTRA_SPREAD = 150;
const MID_ISLAND_Y_MIN = -46;
const MID_ISLAND_Y_MAX = 20;
// fog 가 80~900 이라 이 거리에서 17~37% 만 섞인다. 즉 실루엣이 아니라 형태와 색이
// 남는 진짜 섬으로 보인다 — skyDecor 의 -570 짜리들과 역할이 다르다.
const MID_ISLAND_WIDTH_MIN = 34;
const MID_ISLAND_WIDTH_MAX = 96;
const MID_ISLAND_ROTATION_LIMIT = 0.7;

// 가까이 떠다니는 잔바위. 시차가 크게 나서 깊이감을 만드는 게 목적이다.
//
// |x| 하한 18 은 섬 폭(26, 즉 ±13)과 사격선을 피하려는 값이다. 여기에 뭘 두면
// 화면 한가운데 걸린다. z 도 섬(-60~-100)을 피해 앞쪽에만 둔다.
const ROCK_COUNT = 7;
const ROCK_X_MIN = 18;
const ROCK_X_MAX = 46;
const ROCK_Z_NEAR = -18;
const ROCK_Z_FAR = -68;
const ROCK_Y_MIN = -22;
const ROCK_Y_MAX = 14;
const ROCK_RADIUS_MIN = 0.9;
const ROCK_RADIUS_MAX = 3.4;
// 아주 느리게 위아래로 흔든다. 완전히 굳어 있으면 배경이 사진처럼 죽는다.
// 진폭을 반지름보다 작게 둬야 '떠 있다'로 읽히지 '날아다닌다'로 안 읽힌다.
const ROCK_BOB_AMPLITUDE = 0.55;
const ROCK_BOB_SECONDS = 7;

// 방향광이 (24, 40, -50) 에서 온다. 빛이 오는 쪽에 해가 없으면 그림자 방향이
// 설명되지 않는다. 고도를 25° 로 잡아 정면을 볼 때 화면 위쪽에 걸치게 한다 —
// 광원 방향 그대로 두면 고도 39° 라 화각(30°) 위로 벗어나 안 보인다.
const SUN_DISTANCE = 780;
const SUN_ELEVATION_DEG = 25;
const SUN_AZIMUTH_DEG = 28;
const SUN_RADIUS = 26;

// 판마다 배치가 바뀌면 육안 확인이 무의미해진다. skyDecor 와 다른 씨앗을 써서
// 두 장식이 같은 난수열을 밟지 않게 한다.
const SCENERY_SEED = 20260802;

function randomBetween(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

// 부호를 따로 뽑는다. -max..max 로 한 번에 뽑으면 0 근처가 나와서 화면 한가운데
// 걸리는데, 여기 있는 것들은 전부 가운데를 비워야 하는 장식이다.
function randomSigned(random: () => number, min: number, max: number) {
  const magnitude = randomBetween(random, min, max);
  return random() < 0.5 ? -magnitude : magnitude;
}

// 섬 하나. world.ts 의 플레이 섬과 같은 문법(윗면 상자 + 아래로 뻗은 용골)이라
// 같은 세계의 물건으로 읽힌다.
function buildFloatingIsland(
  random: () => number,
  width: number,
  topMaterial: THREE.Material,
  keelMaterial: THREE.Material
) {
  const island = new THREE.Group();
  const depth = width * randomBetween(random, 0.55, 0.95);
  const thickness = width * randomBetween(random, 0.12, 0.2);
  const keelHeight = width * randomBetween(random, 0.7, 1.1);

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), topMaterial);
  island.add(top);

  const keel = new THREE.Mesh(new THREE.ConeGeometry(width * 0.45, keelHeight, 6), keelMaterial);
  keel.rotation.x = Math.PI;
  keel.position.y = -thickness / 2 - keelHeight / 2;
  island.add(keel);

  return island;
}

export function createScenery(scene: THREE.Scene) {
  const random = createSeededRandom(SCENERY_SEED);
  const root = new THREE.Group();
  scene.add(root);

  // 플레이 섬과 같은 색을 쓴다. 여기서 색을 새로 만들면 배경이 딴 세계가 된다.
  const topMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4f3a });
  const keelMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4230 });
  // 발판만 Standard 를 쓴다. 카메라 코앞이라 Lambert 로 두면 옆의 섬(Standard)과
  // 재질 느낌이 달라 보인다.
  const ledgeMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
  const ledgeKeelMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4230 });

  // 잔바위는 전부 같은 단위 구를 스케일해서 쓴다. 바위마다 지오메트리를 만들면
  // 같은 모양을 일곱 벌 들고 있게 된다.
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);

  const ledgeDepth = LEDGE_BACK_Z - LEDGE_FRONT_Z;
  const ledgeCenterZ = (LEDGE_BACK_Z + LEDGE_FRONT_Z) / 2;
  const ledge = new THREE.Mesh(
    new THREE.BoxGeometry(LEDGE_WIDTH, LEDGE_THICKNESS, ledgeDepth),
    ledgeMaterial
  );
  ledge.position.set(0, GROUND_Y - LEDGE_THICKNESS / 2, ledgeCenterZ);
  ledge.receiveShadow = true;
  root.add(ledge);

  const ledgeKeel = new THREE.Mesh(
    new THREE.ConeGeometry(LEDGE_KEEL_RADIUS, LEDGE_KEEL_HEIGHT, 6),
    ledgeKeelMaterial
  );
  ledgeKeel.rotation.x = Math.PI;
  ledgeKeel.position.set(0, GROUND_Y - LEDGE_THICKNESS - LEDGE_KEEL_HEIGHT / 2, ledgeCenterZ);
  root.add(ledgeKeel);

  for (let i = 0; i < MID_ISLAND_COUNT; i += 1) {
    const width = randomBetween(random, MID_ISLAND_WIDTH_MIN, MID_ISLAND_WIDTH_MAX);
    const island = buildFloatingIsland(random, width, topMaterial, keelMaterial);
    // 폭의 절반을 더해야 '가장자리'가 여유만큼 떨어진다. 중심으로 재면 큰 섬일수록
    // 안쪽으로 더 들어온다.
    const centerX = MID_ISLAND_EDGE_CLEARANCE + width / 2 + randomBetween(random, 0, MID_ISLAND_EXTRA_SPREAD);
    island.position.set(
      random() < 0.5 ? -centerX : centerX,
      randomBetween(random, MID_ISLAND_Y_MIN, MID_ISLAND_Y_MAX),
      randomBetween(random, MID_ISLAND_Z_FAR, MID_ISLAND_Z_NEAR)
    );
    island.rotation.y = randomBetween(random, -MID_ISLAND_ROTATION_LIMIT, MID_ISLAND_ROTATION_LIMIT);
    root.add(island);
  }

  const rocks: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  for (let i = 0; i < ROCK_COUNT; i += 1) {
    const rock = new THREE.Mesh(rockGeometry, keelMaterial);
    const radius = randomBetween(random, ROCK_RADIUS_MIN, ROCK_RADIUS_MAX);
    // 축마다 다르게 눌러야 정이십면체 티가 안 난다.
    rock.scale.set(
      radius * randomBetween(random, 0.7, 1.3),
      radius * randomBetween(random, 0.5, 1),
      radius * randomBetween(random, 0.7, 1.3)
    );
    rock.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    const baseY = randomBetween(random, ROCK_Y_MIN, ROCK_Y_MAX);
    rock.position.set(
      randomSigned(random, ROCK_X_MIN, ROCK_X_MAX),
      baseY,
      randomBetween(random, ROCK_Z_FAR, ROCK_Z_NEAR)
    );
    root.add(rock);
    rocks.push({ mesh: rock, baseY, phase: random() * Math.PI * 2 });
  }

  // fog: false 로 둬야 해가 안 바랜다. 거리가 780 이라 fog far(900) 안쪽이고,
  // 그대로 두면 87% 섞여서 하늘색 원반이 된다.
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false });
  const sunGeometry = new THREE.CircleGeometry(SUN_RADIUS, 24);
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  const elevation = (SUN_ELEVATION_DEG * Math.PI) / 180;
  const azimuth = (SUN_AZIMUTH_DEG * Math.PI) / 180;
  const horizontal = SUN_DISTANCE * Math.cos(elevation);
  sun.position.set(
    horizontal * Math.sin(azimuth),
    SUN_DISTANCE * Math.sin(elevation),
    -horizontal * Math.cos(azimuth)
  );
  // 원반이라 정면을 안 보면 선으로 보인다. 카메라가 원점에 고정이므로 한 번만 돌리면 된다.
  sun.lookAt(0, 1.6, 0);
  root.add(sun);

  let bobT = 0;

  return {
    update(dt: number) {
      bobT += dt;
      const omega = (Math.PI * 2) / ROCK_BOB_SECONDS;
      for (const rock of rocks) {
        rock.mesh.position.y = rock.baseY + Math.sin(bobT * omega + rock.phase) * ROCK_BOB_AMPLITUDE;
      }
    },
    dispose() {
      scene.remove(root);
      // rockGeometry 는 바위 일곱 개가 공유하므로 traverse 에서 걸러내고 아래에서
      // 한 번만 해제한다. 두 번 해제하면 three 가 이미 지운 버퍼를 다시 지운다.
      root.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry !== rockGeometry) {
          child.geometry.dispose();
        }
      });
      rockGeometry.dispose();
      topMaterial.dispose();
      keelMaterial.dispose();
      ledgeMaterial.dispose();
      ledgeKeelMaterial.dispose();
      sunMaterial.dispose();
    },
  };
}
