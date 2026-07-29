import * as THREE from 'three';
import { driftWrapped, flightProgress, createSeededRandom } from './skyMotion.js';

// 섬이 z = -80 이다. 구름을 항상 그보다 뒤에 두면 조준해서 화각이 좁아져도
// 표적을 가리지 않는다. 앵커 위치는 z = -160 이어야 한다. 각 구름 내부의
// 구들은 반지름 ~14 에 지역 오프셋 ~4.2 까지 더해져 앞으로 나갈 수 있기
// 때문에 z = -80 을 안전하게 넘어서야 한다.
const CLOUD_Z_NEAR = -160;
const CLOUD_Z_FAR = -300;
const CLOUD_COUNT = 14;
const CLOUD_X_LIMIT = 170;
const CLOUD_Y_MIN = -25;
const CLOUD_Y_MAX = 35;
const CLOUD_DRIFT_SPEED = 0.6;
const CLOUD_PUFF_MIN = 4;
const CLOUD_PUFF_MAX = 6;

// fog 가 320에서 끝나므로 이보다 멀면 하늘색에 잠겨 실루엣만 남는다.
const DISTANT_ISLAND_COUNT = 5;
const DISTANT_ISLAND_Z_NEAR = -250;
const DISTANT_ISLAND_Z_FAR = -400;

const BIRD_COUNT = 5;
const BIRD_FLIGHT_SECONDS = 24;
const BIRD_X_SPAN = 180;
const BIRD_Z = -150;
const BIRD_Y_MIN = 22;
const BIRD_Y_MAX = 38;
const BIRD_WING_SPAN = 1.2;
const BIRD_WING_CHORD = 0.6;
const BIRD_FLAP_HZ = 3;
const BIRD_FLAP_ANGLE = 0.5;

// 배치가 판마다 바뀌면 육안 확인이 무의미해진다.
const SKY_SEED = 20260729;

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

// 구 몇 개를 겹쳐 한 덩이로 만든다. 가로로 늘어놓고 서로 반쯤 파묻어야
// 낱개 구로 안 보인다.
function buildCloud(random, material) {
  const cloud = new THREE.Group();
  const puffCount = Math.round(randomBetween(random, CLOUD_PUFF_MIN, CLOUD_PUFF_MAX));
  const scale = randomBetween(random, 6, 14);
  for (let i = 0; i < puffCount; i += 1) {
    const radius = scale * randomBetween(random, 0.5, 1);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 7, 5), material);
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
function buildDistantIsland(random, topMaterial, keelMaterial) {
  const island = new THREE.Group();
  const width = randomBetween(random, 40, 90);
  const depth = width * randomBetween(random, 0.5, 0.9);
  const thickness = randomBetween(random, 6, 12);
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
// 있으므로 정점을 그렇게 잡는다.
function buildWingGeometry(mirrored) {
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

function buildBird(material) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(buildWingGeometry(false), material);
  const right = new THREE.Mesh(buildWingGeometry(true), material);
  group.add(left);
  group.add(right);
  return { group, left, right };
}

export function createSkyDecor(scene) {
  const random = createSeededRandom(SKY_SEED);
  const root = new THREE.Group();
  scene.add(root);

  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f6fa });
  const islandTopMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4f3a });
  const islandKeelMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4230 });

  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const cloud = buildCloud(random, cloudMaterial);
    cloud.position.set(
      randomBetween(random, -CLOUD_X_LIMIT, CLOUD_X_LIMIT),
      randomBetween(random, CLOUD_Y_MIN, CLOUD_Y_MAX),
      randomBetween(random, CLOUD_Z_FAR, CLOUD_Z_NEAR)
    );
    root.add(cloud);
    clouds.push(cloud);
  }

  for (let i = 0; i < DISTANT_ISLAND_COUNT; i += 1) {
    const island = buildDistantIsland(random, islandTopMaterial, islandKeelMaterial);
    island.position.set(
      randomBetween(random, -220, 220),
      randomBetween(random, -30, 10),
      randomBetween(random, DISTANT_ISLAND_Z_FAR, DISTANT_ISLAND_Z_NEAR)
    );
    island.rotation.y = randomBetween(random, -0.6, 0.6);
    root.add(island);
  }

  // 조명 계산 없이 어두운 실루엣이면 된다. 양면으로 두지 않으면 지나가는
  // 방향에 따라 날개 한쪽이 사라진다.
  const birdMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b4451,
    side: THREE.DoubleSide,
  });

  const birds = [];
  for (let i = 0; i < BIRD_COUNT; i += 1) {
    const bird = buildBird(birdMaterial);
    // 가운데를 0 으로 두고 양옆으로 벌어진다. 뒤로 물러난 거리를 좌우 거리에
    // 비례시키면 V 대형이 된다.
    const lateral = i - (BIRD_COUNT - 1) / 2;
    bird.offsetX = -Math.abs(lateral) * 2.5;
    bird.offsetY = randomBetween(random, BIRD_Y_MIN, BIRD_Y_MAX);
    bird.offsetZ = lateral * 2.5;
    // 날갯짓을 조금씩 어긋나게 해야 한 몸처럼 안 보인다.
    bird.flapPhase = randomBetween(random, 0, Math.PI * 2);
    bird.group.position.set(0, bird.offsetY, BIRD_Z + bird.offsetZ);
    root.add(bird.group);
    birds.push(bird);
  }

  let flightT = 0;
  let flapPhase = 0;

  return {
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x = driftWrapped(
          cloud.position.x,
          CLOUD_DRIFT_SPEED * dt,
          -CLOUD_X_LIMIT,
          CLOUD_X_LIMIT
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
      root.traverse((child) => {
        if (child.isMesh) child.geometry.dispose();
      });
      cloudMaterial.dispose();
      islandTopMaterial.dispose();
      islandKeelMaterial.dispose();
      birdMaterial.dispose();
    },
  };
}
