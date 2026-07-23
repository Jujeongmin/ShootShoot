import * as THREE from 'three';

// 표적들이 올라앉는 섬. 카메라(z=0)에서 멀찍이 떨어져 허공에 떠 있는 한 덩어리로,
// 사대와 섬 사이는 의도적으로 비워 둔다.
const ISLAND_CENTER_Z = -80;
const ISLAND_WIDTH = 26;
const ISLAND_DEPTH = 32;
const ISLAND_THICKNESS = 4;
const GROUND_Y = -1.0;
// 섬 아래로 이어지는 바위. 밑면이 평평하면 잘린 판처럼 보인다.
const KEEL_TOP_RADIUS = 12;
const KEEL_HEIGHT = 14;

export function createWorld(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 80, 320);

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
  shadowCamera.left = -30;
  shadowCamera.right = 30;
  shadowCamera.top = 30;
  shadowCamera.bottom = -30;
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
