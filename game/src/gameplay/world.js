import * as THREE from 'three';

export function createWorld(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 120, 460);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // 지면은 카메라 발밑(z=0)에서 시작해 안개 너머까지 이어져야 한다. 사대와 표적
  // 사이가 비어 있으면 표적들이 하늘에 뜬 섬처럼 보인다. 윗면이 GROUND_Y(-1)에
  // 오도록 두께 1의 판을 -1.5에 놓는다.
  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(600, 1, 600), platformMaterial);
  platform.position.set(0, -1.5, -80);
  scene.add(platform);
  const platforms = [platform];

  return { platforms };
}
