import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const IDLE_SWAY_Y_AMPLITUDE = 0.01;
const IDLE_SWAY_X_AMPLITUDE = 0.005;
const RECOIL_DURATION = 0.15;
const RECOIL_KICK_DISTANCE = 0.08;
const RECOIL_KICK_ANGLE = 0.15;

function loadModel(weapon) {
  if (weapon.format === 'fbx') {
    return new FBXLoader().loadAsync(weapon.model);
  }
  return new GLTFLoader().loadAsync(weapon.model).then((gltf) => gltf.scene);
}

export function loadWeaponViewmodel(camera, weapon) {
  return loadModel(weapon).then((model) => {
    const basePosition = weapon.position;
    const baseRotation = weapon.rotation ?? { x: 0, y: 0, z: 0 };
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(weapon.scale);
    group.position.set(basePosition.x, basePosition.y, basePosition.z);
    group.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
    camera.add(group);

    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;

    function updateIdleSway(dt) {
      elapsed += dt;
      group.position.y = basePosition.y + Math.sin(elapsed * 1.5) * IDLE_SWAY_Y_AMPLITUDE;
      group.position.x = basePosition.x + Math.sin(elapsed * 0.8) * IDLE_SWAY_X_AMPLITUDE;
    }

    function updateRecoil(dt) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      group.position.z = basePosition.z + kick * RECOIL_KICK_DISTANCE;
      group.rotation.x = baseRotation.x - kick * RECOIL_KICK_ANGLE;
      if (t >= 1) {
        isRecoiling = false;
      }
    }

    return {
      setVisible(visible) {
        group.visible = visible;
      },
      triggerRecoil() {
        recoilElapsed = 0;
        isRecoiling = true;
      },
      update(dt) {
        updateIdleSway(dt);
        if (isRecoiling) {
          updateRecoil(dt);
        }
      },
      dispose() {
        camera.remove(group);
        group.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of mats) material.dispose();
        });
      },
    };
  });
}
