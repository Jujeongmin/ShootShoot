import * as THREE from 'three';

// 표적들이 올라앉는 섬. 카메라(z=0)에서 멀찍이 떨어져 허공에 떠 있는 한 덩어리로,
// 사대와 섬 사이는 의도적으로 비워 둔다.
const ISLAND_CENTER_Z = -80;
const ISLAND_WIDTH = 26;
// 뒷줄 원숭이 머리가 섬의 먼 가장자리보다 아래에 오도록 깊이를 잡는다. 가장자리가
// 더 가까우면 머리가 하늘을 배경으로 삐져나와 다시 떠 보인다.
const ISLAND_DEPTH = 40;
const ISLAND_THICKNESS = 4;
const GROUND_Y = -1.0;
// 섬 아래로 이어지는 바위. 밑면이 평평하면 잘린 판처럼 보인다.
const KEEL_TOP_RADIUS = 12;
const KEEL_HEIGHT = 14;

export function createWorld(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x87ceeb);
  // fog 색이 배경색과 같아서 far 를 넘긴 것은 흐려지는 게 아니라 통째로 사라진다.
  // 하늘 장식(skyDecor.ts)이 그 far 안쪽에 다 들어가야 한다.
  scene.fog = new THREE.Fog(0x87ceeb, 80, 900);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.9);
  scene.add(hemiLight);

  // 섬 위를 비추도록 광원을 표적 쪽으로 옮긴다. 원점 근처에 두면 그림자 카메라가
  // 섬을 덮지 못해 접지 그림자가 사라진다.
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight.position.set(24, 40, ISLAND_CENTER_Z + 30);
  dirLight.target.position.set(0, GROUND_Y, ISLAND_CENTER_Z);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const shadowCamera = dirLight.shadow.camera;
  shadowCamera.left = -36;
  shadowCamera.right = 36;
  shadowCamera.top = 36;
  shadowCamera.bottom = -36;
  shadowCamera.near = 1;
  shadowCamera.far = 160;
  shadowCamera.updateProjectionMatrix();
  scene.add(dirLight);
  scene.add(dirLight.target);

  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(ISLAND_WIDTH, ISLAND_THICKNESS, ISLAND_DEPTH),
    platformMaterial
  );
  platform.position.set(0, GROUND_Y - ISLAND_THICKNESS / 2, ISLAND_CENTER_Z);
  platform.receiveShadow = true;
  scene.add(platform);

  const keelMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4230 });
  const keel = new THREE.Mesh(
    new THREE.ConeGeometry(KEEL_TOP_RADIUS, KEEL_HEIGHT, 6),
    keelMaterial
  );
  keel.rotation.x = Math.PI;
  keel.position.set(0, GROUND_Y - ISLAND_THICKNESS - KEEL_HEIGHT / 2, ISLAND_CENTER_Z);
  scene.add(keel);

  return { platforms: [platform] };
}
