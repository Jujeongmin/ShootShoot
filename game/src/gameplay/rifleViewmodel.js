import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = '/models/rifle.glb';
const SCALE = 0.08;
const BASE_POSITION = { x: 0.4, y: -0.3, z: -0.7 };
const IDLE_SWAY_Y_AMPLITUDE = 0.01;
const IDLE_SWAY_X_AMPLITUDE = 0.005;
const RECOIL_DURATION = 0.15;
const RECOIL_KICK_DISTANCE = 0.08;
const RECOIL_KICK_ANGLE = 0.15;

export function loadRifleViewmodel(camera) {
  const loader = new GLTFLoader();
  return loader.loadAsync(MODEL_URL).then((gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);
    group.scale.setScalar(SCALE);
    group.position.set(BASE_POSITION.x, BASE_POSITION.y, BASE_POSITION.z);
    camera.add(group);

    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;

    function updateIdleSway(dt) {
      elapsed += dt;
      group.position.y = BASE_POSITION.y + Math.sin(elapsed * 1.5) * IDLE_SWAY_Y_AMPLITUDE;
      group.position.x = BASE_POSITION.x + Math.sin(elapsed * 0.8) * IDLE_SWAY_X_AMPLITUDE;
    }

    function updateRecoil(dt) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      group.position.z = BASE_POSITION.z + kick * RECOIL_KICK_DISTANCE;
      group.rotation.x = -kick * RECOIL_KICK_ANGLE;
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
    };
  });
}
