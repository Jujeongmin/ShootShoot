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
  const platforms = [];
  const platformPositions = [
    { x: -4, y: -1.5, z: -14 },
    { x: 0, y: -1.5, z: -18 },
    { x: 4, y: -1.5, z: -14 },
  ];
  for (const pos of platformPositions) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), platformMaterial);
    platform.position.set(pos.x, pos.y, pos.z);
    scene.add(platform);
    platforms.push(platform);
  }

  return { platforms };
}
