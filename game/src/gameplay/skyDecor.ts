import * as THREE from 'three';
import { driftWrapped, flightProgress, createSeededRandom } from './skyMotion';

// 섬이 z = -80 이다. 구름을 항상 그보다 뒤에 두면 조준해서 화각이 좁아져도
// 표적을 가리지 않는다. 앵커가 -400 이고 구름 내부의 구는 반지름(최대 43)과
// 지역 오프셋(최대 ~13)만큼 앞으로 나오므로 가장 앞선 표면이 -344 근처다.
// world.ts 의 fog far 가 900 이라 뒤쪽 끝(-560)도 형태가 남는다.
const CLOUD_Z_NEAR = -400;
const CLOUD_Z_FAR = -560;
const CLOUD_COUNT = 14;
// 배치 반경과 랩(감아넘기기) 반경을 다르게 둔다. 16:9 화면에서 가장 가까운
// 구름의 z(-400) 기준 보이는 폭의 절반이 ~410 인데 구름 뭉치는 앵커에서 최대
// ~56 까지 튀어나온다. 배치 한계를 랩 한계로 그대로 쓰면 화면 안에서 구름이
// 갑자기 사라지는 게 보이고, 21:9 처럼 더 넓은 화면에서는 화면 중앙 근처에서
// 그 일이 벌어진다. 배치는 좁게(420), 랩은 넓게(620) 두어 랩이 항상
// 프러스텀 밖에서 일어나게 한다.
const CLOUD_X_PLACEMENT_LIMIT = 420;
const CLOUD_X_WRAP_LIMIT = 620;
const CLOUD_Y_MIN = -75;
const CLOUD_Y_MAX = 100;
const CLOUD_DRIFT_SPEED = 0.6;
const CLOUD_PUFF_MIN = 4;
const CLOUD_PUFF_MAX = 6;
const CLOUD_SCALE_MIN = 19;
const CLOUD_SCALE_MAX = 43;

// scene.fog 의 색이 scene.background 와 똑같은 0x87ceeb 이다. 즉 fog 는
// '안개를 낀 것처럼' 보이게 하는 장치가 아니라 거리에 따라 배경색과 섞는
// 장치이고, far(320) 를 넘어서면 100% 배경색이 되어 통째로 사라진다.
// 실루엣으로 남으려면 fog 그라디언트(80~900) 안에서 '부분적으로만' 섞여야
// 한다. far 를 넘어가면 순수 하늘색이 되어 드로우콜만 낭비하고, 너무 가까우면
// 거의 안 섞여 실루엣이 아니라 그냥 또 하나의 섬으로 보인다. 570~680 이면
// 65~85% 섞여 형태만 흐리게 남는다. 구름을 밀 때마다 fog far 가 따라 늘어나므로
// 이 범위도 같이 밀어야 한다 — 안 밀면 진하게 나와 섬처럼 보인다.
const DISTANT_ISLAND_COUNT = 5;
const DISTANT_ISLAND_Z_NEAR = -570;
const DISTANT_ISLAND_Z_FAR = -680;
const DISTANT_ISLAND_X_LIMIT = 620;
const DISTANT_ISLAND_Y_MIN = -75;
const DISTANT_ISLAND_Y_MAX = 25;
const DISTANT_ISLAND_ROTATION_LIMIT = 0.6;
// 더 멀어진 만큼 키운다. 거리 배율이 약 1.5배다.
const DISTANT_ISLAND_WIDTH_MIN = 90;
const DISTANT_ISLAND_WIDTH_MAX = 200;

const BIRD_COUNT = 5;
const BIRD_FLIGHT_SECONDS = 24;
const BIRD_X_SPAN = 180;
const BIRD_Z = -150;
const BIRD_Y_MIN = 22;
const BIRD_Y_MAX = 38;
// 대형 안에서 새 한 마리가 이웃보다 얼마나 뒤로, 얼마나 처지는지를 정한다.
// 뒤로 물러나는 거리(화면 가로/깊이 방향)와 처지는 높이(화면 세로 방향)를
// 같은 상수로 겸용하면 안 된다 — 150 유닛 밖에서는 깊이 차이가 화면에
// 거의 안 보이지만 세로 차이는 잘 보인다.
const BIRD_TRAIL_SPACING = 2.5;
const BIRD_V_SPREAD = 1.6;
// 새마다 살짝 다른 높이를 줘야 대형이 판박이처럼 안 보이되, 대형 간격보다
// 훨씬 작아야 V 모양 자체가 흐트러지지 않는다.
const BIRD_Y_JITTER = 0.3;
const BIRD_WING_SPAN = 1.2;
const BIRD_WING_CHORD = 0.6;
const BIRD_FLAP_HZ = 3;
const BIRD_FLAP_ANGLE = 0.5;

// 배치가 판마다 바뀌면 육안 확인이 무의미해진다.
const SKY_SEED = 20260729;

function randomBetween(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

// 구 몇 개를 겹쳐 한 덩이로 만든다. 가로로 늘어놓고 서로 반쯤 파묻어야
// 낱개 구로 안 보인다. 지오메트리는 단위 구 하나를 공유하고 반지름은
// 메시 스케일로 표현한다 — 퍼프마다 지오메트리를 새로 만들면 겹치는
// 이 함수 호출 수만큼(구름 14개 x 퍼프 4~6개) GPU 리소스가 낭비된다.
function buildCloud(random: () => number, material: THREE.Material, puffGeometry: THREE.BufferGeometry) {
  const cloud = new THREE.Group();
  const puffCount = Math.round(randomBetween(random, CLOUD_PUFF_MIN, CLOUD_PUFF_MAX));
  // 구름을 뒤로 밀면 그만큼 작아 보인다. 화면에서 차지하는 크기를 유지하려고
  // 거리 배율(약 1.75배)만큼 키운다.
  const scale = randomBetween(random, CLOUD_SCALE_MIN, CLOUD_SCALE_MAX);
  for (let i = 0; i < puffCount; i += 1) {
    const radius = scale * randomBetween(random, 0.5, 1);
    const puff = new THREE.Mesh(puffGeometry, material);
    puff.scale.setScalar(radius);
    puff.position.set(
      (i - (puffCount - 1) / 2) * scale * 0.7,
      randomBetween(random, -0.2, 0.2) * scale,
      randomBetween(random, -0.3, 0.3) * scale
    );
    cloud.add(puff);
  }
  return cloud;
}

// 지금 섬과 같은 모양(윗면 + 아래로 뻗은 용골)이되 훨씬 크게 잡는다. 같은
// 크기로 두면 그 거리에서 점으로 사라진다.
function buildDistantIsland(random: () => number, topMaterial: THREE.Material, keelMaterial: THREE.Material) {
  const island = new THREE.Group();
  const width = randomBetween(random, DISTANT_ISLAND_WIDTH_MIN, DISTANT_ISLAND_WIDTH_MAX);
  const depth = width * randomBetween(random, 0.5, 0.9);
  const thickness = width * randomBetween(random, 0.1, 0.15);
  const keelHeight = width * 0.8;

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), topMaterial);
  island.add(top);

  const keel = new THREE.Mesh(new THREE.ConeGeometry(width * 0.45, keelHeight, 6), keelMaterial);
  keel.rotation.x = Math.PI;
  keel.position.y = -thickness / 2 - keelHeight / 2;
  island.add(keel);

  return island;
}

// 삼각형 한 장이 날개 하나다. 뿌리를 원점에 두어야 rotation.z 로 접었다 펼 수
// 있으므로 정점을 그렇게 잡는다. 좌우 두 모양뿐이므로 새마다 다시 만들지
// 않고 새 5마리가 지오메트리 2개를 공유한다.
function buildWingGeometry(mirrored: boolean) {
  const tipX = mirrored ? -BIRD_WING_SPAN : BIRD_WING_SPAN;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0, -BIRD_WING_CHORD / 2, 0, 0, BIRD_WING_CHORD / 2, tipX, 0, 0],
      3
    )
  );
  return geometry;
}

function buildBird(material: THREE.Material, wingGeometryLeft: THREE.BufferGeometry, wingGeometryRight: THREE.BufferGeometry) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(wingGeometryLeft, material);
  const right = new THREE.Mesh(wingGeometryRight, material);
  group.add(left);
  group.add(right);
  // offsetX/offsetY/flapPhase는 createSkyDecor의 대형 배치 루프가 곧바로 채운다.
  // 그 전까지는 아무 데도 읽히지 않는 자리표시 값이다.
  return { group, left, right, offsetX: 0, offsetY: 0, flapPhase: 0 };
}

export function createSkyDecor(scene: THREE.Scene) {
  const random = createSeededRandom(SKY_SEED);
  const root = new THREE.Group();
  scene.add(root);

  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f6fa });
  const islandTopMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4f3a });
  const islandKeelMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4230 });

  // 퍼프와 날개는 모양이 하나뿐이라(퍼프는 스케일로, 날개는 좌/우 두 종류로
  // 크기·형태를 표현) 지오메트리를 공유한다. dispose() 에서도 각각 한 번씩만
  // 해제해야 한다.
  const puffGeometry = new THREE.SphereGeometry(1, 7, 5);
  const wingGeometryLeft = buildWingGeometry(false);
  const wingGeometryRight = buildWingGeometry(true);

  const clouds: THREE.Group[] = [];
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const cloud = buildCloud(random, cloudMaterial, puffGeometry);
    cloud.position.set(
      randomBetween(random, -CLOUD_X_PLACEMENT_LIMIT, CLOUD_X_PLACEMENT_LIMIT),
      randomBetween(random, CLOUD_Y_MIN, CLOUD_Y_MAX),
      randomBetween(random, CLOUD_Z_FAR, CLOUD_Z_NEAR)
    );
    root.add(cloud);
    clouds.push(cloud);
  }

  for (let i = 0; i < DISTANT_ISLAND_COUNT; i += 1) {
    const island = buildDistantIsland(random, islandTopMaterial, islandKeelMaterial);
    island.position.set(
      randomBetween(random, -DISTANT_ISLAND_X_LIMIT, DISTANT_ISLAND_X_LIMIT),
      randomBetween(random, DISTANT_ISLAND_Y_MIN, DISTANT_ISLAND_Y_MAX),
      randomBetween(random, DISTANT_ISLAND_Z_FAR, DISTANT_ISLAND_Z_NEAR)
    );
    island.rotation.y = randomBetween(random, -DISTANT_ISLAND_ROTATION_LIMIT, DISTANT_ISLAND_ROTATION_LIMIT);
    root.add(island);
  }

  // 조명 계산 없이 어두운 실루엣이면 된다. 양면으로 두지 않으면 지나가는
  // 방향에 따라 날개 한쪽이 사라진다.
  const birdMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b4451,
    side: THREE.DoubleSide,
  });

  // 대형 전체가 고도 하나를 공유해야 V 자로 보인다. 새마다 따로 고도를
  // 뽑으면(이전 버그) 화면 세로축 산포가 대형 간격(BIRD_V_SPREAD)보다
  // 훨씬 커져서 무작위로 흩어진 다섯 마리로 보인다.
  const flockAltitude = randomBetween(random, BIRD_Y_MIN, BIRD_Y_MAX);

  const birds: ReturnType<typeof buildBird>[] = [];
  for (let i = 0; i < BIRD_COUNT; i += 1) {
    const bird = buildBird(birdMaterial, wingGeometryLeft, wingGeometryRight);
    // 가운데를 0 으로 두고 양옆으로 벌어진다. 화면 세로축(y)은 lateral 에
    // 비례해 처지게 하고, 화면 가로/깊이축(x)은 뒤로 물러나게 해야 V 대형이
    // 눈에 보인다 — 이 거리에서 z 축 오프셋만으로는 화면상 폭 차이가
    // 거의 나지 않는다.
    const lateral = i - (BIRD_COUNT - 1) / 2;
    const jitter = randomBetween(random, -BIRD_Y_JITTER, BIRD_Y_JITTER);
    bird.offsetX = -Math.abs(lateral) * BIRD_TRAIL_SPACING;
    bird.offsetY = flockAltitude - Math.abs(lateral) * BIRD_V_SPREAD + jitter;
    // 날갯짓을 조금씩 어긋나게 해야 한 몸처럼 안 보인다.
    bird.flapPhase = randomBetween(random, 0, Math.PI * 2);
    bird.group.position.set(0, bird.offsetY, BIRD_Z);
    root.add(bird.group);
    birds.push(bird);
  }

  let flightT = 0;
  let flapPhase = 0;

  return {
    update(dt: number) {
      for (const cloud of clouds) {
        cloud.position.x = driftWrapped(
          cloud.position.x,
          CLOUD_DRIFT_SPEED * dt,
          -CLOUD_X_WRAP_LIMIT,
          CLOUD_X_WRAP_LIMIT
        );
      }

      flightT = flightProgress(flightT, dt, BIRD_FLIGHT_SECONDS);
      flapPhase += dt * BIRD_FLAP_HZ * Math.PI * 2;
      const leadX = -BIRD_X_SPAN + flightT * BIRD_X_SPAN * 2;
      for (const bird of birds) {
        bird.group.position.x = leadX + bird.offsetX;
        const flap = Math.sin(flapPhase + bird.flapPhase) * BIRD_FLAP_ANGLE;
        bird.left.rotation.z = flap;
        bird.right.rotation.z = -flap;
      }
    },
    dispose() {
      scene.remove(root);
      // 퍼프/날개 지오메트리는 여러 메시가 공유하므로 traverse 도중 반복
      // 해제하지 않도록 걸러내고, 아래에서 한 번씩만 해제한다.
      root.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry !== puffGeometry &&
          child.geometry !== wingGeometryLeft &&
          child.geometry !== wingGeometryRight
        ) {
          child.geometry.dispose();
        }
      });
      puffGeometry.dispose();
      wingGeometryLeft.dispose();
      wingGeometryRight.dispose();
      cloudMaterial.dispose();
      islandTopMaterial.dispose();
      islandKeelMaterial.dispose();
      birdMaterial.dispose();
    },
  };
}
