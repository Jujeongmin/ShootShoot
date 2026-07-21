import * as THREE from 'three';

export function createWorld(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 15, 40);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 14), platformMaterial);
  platform.position.set(0, -1.5, -13);
  scene.add(platform);
  const platforms = [platform];

  return { platforms };
}
