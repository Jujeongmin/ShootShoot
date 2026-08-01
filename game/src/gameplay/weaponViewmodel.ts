import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { WeaponModel } from '../config';

const IDLE_SWAY_Y_AMPLITUDE = 0.01;
const IDLE_SWAY_X_AMPLITUDE = 0.005;
const RECOIL_DURATION = 0.15;
const RECOIL_KICK_DISTANCE = 0.08;
const RECOIL_KICK_ANGLE = 0.15;
const RELOAD_DIP_DISTANCE = 0.12;
const RELOAD_TILT_ANGLE = 0.5;

function loadModel(weapon: WeaponModel) {
  if (weapon.format === 'fbx') {
    return new FBXLoader().loadAsync(weapon.model);
  }
  return new GLTFLoader().loadAsync(weapon.model).then((gltf) => gltf.scene);
}

export function loadWeaponViewmodel(camera: THREE.Camera, weapon: WeaponModel) {
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
    let reloadElapsed = 0;
    let reloadDuration = 0;
    let isReloading = false;

    function updateIdleSway(dt: number) {
      elapsed += dt;
      group.position.y = basePosition.y + Math.sin(elapsed * 1.5) * IDLE_SWAY_Y_AMPLITUDE;
      group.position.x = basePosition.x + Math.sin(elapsed * 0.8) * IDLE_SWAY_X_AMPLITUDE;
    }

    // 절대값을 대입하는 대신 오프셋을 낸다. 장전도 rotation.x 를 건드리므로
    // 둘이 서로 덮어쓰지 않으려면 마지막에 한 번만 적용해야 한다.
    function recoilOffset(dt: number) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      if (t >= 1) {
        isRecoiling = false;
      }
      return { z: kick * RECOIL_KICK_DISTANCE, rotX: -kick * RECOIL_KICK_ANGLE };
    }

    // 0 ~ 0.25 내리기, 0.25 ~ 0.7 유지, 0.7 ~ 1 올리기.
    function reloadAmount(t: number) {
      if (t < 0.25) return t / 0.25;
      if (t < 0.7) return 1;
      return 1 - (t - 0.7) / 0.3;
    }

    function reloadOffset(dt: number) {
      reloadElapsed += dt;
      const t = reloadDuration > 0 ? Math.min(reloadElapsed / reloadDuration, 1) : 1;
      const amount = reloadAmount(t);
      if (t >= 1) {
        isReloading = false;
      }
      return { y: -amount * RELOAD_DIP_DISTANCE, rotX: -amount * RELOAD_TILT_ANGLE };
    }

    return {
      setVisible(visible: boolean) {
        group.visible = visible;
      },
      triggerRecoil() {
        recoilElapsed = 0;
        isRecoiling = true;
      },
      // seconds 를 받는 이유: 무기를 바꾸면 뷰모델이 새로 만들어지는데, 그때
      // 남은 시간으로 다시 걸어야 총이 혼자 멀쩡히 서 있지 않는다.
      triggerReload(seconds: number) {
        reloadElapsed = 0;
        reloadDuration = seconds;
        isReloading = seconds > 0;
      },
      update(dt: number) {
        updateIdleSway(dt);
        let yOffset = 0;
        let zOffset = 0;
        let rotXOffset = 0;
        if (isRecoiling) {
          const recoil = recoilOffset(dt);
          zOffset += recoil.z;
          rotXOffset += recoil.rotX;
        }
        if (isReloading) {
          const reload = reloadOffset(dt);
          yOffset += reload.y;
          rotXOffset += reload.rotX;
        }
        group.position.y += yOffset;
        group.position.z = basePosition.z + zOffset;
        group.rotation.x = baseRotation.x + rotXOffset;
      },
      dispose() {
        camera.remove(group);
        group.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of mats) material.dispose();
        });
      },
    };
  });
}
