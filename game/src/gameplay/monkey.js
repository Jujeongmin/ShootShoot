import * as THREE from 'three';
import { cloneMonkeyModel } from './monkeyModel.js';

const HIT_ANIMATION_DURATION = 0.6;
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;
// Calibrated against the SkinnedMesh's ANIMATED pose (not rest-pose): live-sampling the
// idle clip's full loop found the reachable local Y range is about -81 to +28 (head/torso/
// arms/legs; the tail is excluded as its bind-relative Y swings wildly and isn't a reliable
// signal), so this sits near the top ~20% of that live range.
const HEAD_CUTOFF_LOCAL_Y = 5;

export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip, sway = {} }) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.scale.setScalar(scale);

  const model = cloneMonkeyModel(template);
  group.add(model);

  let raycastMesh = null;
  const materials = [];
  model.traverse((child) => {
    if (child.isMesh) {
      raycastMesh = child;
      child.userData = { monkeyId: id };
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      materials.push(...mats);
    }
  });

  const mixer = new THREE.AnimationMixer(model);
  if (clip) {
    mixer.clipAction(clip).play();
  }

  const swayAmplitude = sway.amplitude !== undefined ? sway.amplitude : 0.5;
  const swayFrequency = sway.frequency !== undefined ? sway.frequency : speed;
  const swayPhase = sway.phase !== undefined ? sway.phase : Math.random() * Math.PI * 2;

  const state = {
    phase: 'idle',
    phaseOffset: Math.random() * Math.PI * 2,
    elapsed: 0,
    hitElapsed: 0,
    nextTauntAt: TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN),
    tauntElapsed: 0,
    isTaunting: false,
    dead: false,
  };

  function updateIdle(dt) {
    state.elapsed += dt;

    const bob = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.08;
    group.position.y = position.y + bob;

    const swayOffset = Math.sin(state.elapsed * swayFrequency + swayPhase) * swayAmplitude;
    group.position.x = position.x + swayOffset;

    if (state.isTaunting) {
      state.tauntElapsed += dt;
      group.rotation.y = Math.sin(state.tauntElapsed * 10) * 0.6;
      if (state.tauntElapsed > 0.8) {
        state.isTaunting = false;
        state.tauntElapsed = 0;
        state.nextTauntAt = state.elapsed + TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN);
      }
    } else {
      group.rotation.y = 0;
      if (state.elapsed >= state.nextTauntAt) {
        state.isTaunting = true;
      }
    }
  }

  function updateHit(dt) {
    state.hitElapsed += dt;
    const t = Math.min(state.hitElapsed / HIT_ANIMATION_DURATION, 1);
    group.position.y = position.y + t * 1.5;
    group.position.z = position.z - t * 1.2;
    group.rotation.x = t * Math.PI * 2;
    group.rotation.z = t * Math.PI;
    const fade = 1 - t;
    for (const material of materials) {
      material.transparent = true;
      material.opacity = fade;
    }
    if (t >= 1) {
      state.dead = true;
    }
  }

  return {
    id,
    group,
    getRaycastMeshes() {
      return raycastMesh ? [raycastMesh] : [];
    },
    classifyHit(worldPoint) {
      const local = raycastMesh.worldToLocal(worldPoint.clone());
      return local.y > HEAD_CUTOFF_LOCAL_Y ? 'head' : 'body';
    },
    update(dt) {
      mixer.update(dt);
      if (state.phase === 'hit') {
        updateHit(dt);
      } else {
        updateIdle(dt);
      }
    },
    hit(part) {
      if (state.phase === 'hit') return;
      state.phase = 'hit';
      state.hitElapsed = 0;
      state.lastHitPart = part;
    },
    isDead() {
      return state.dead;
    },
    isDying() {
      return state.phase === 'hit';
    },
    getWorldPosition(target = new THREE.Vector3()) {
      return group.getWorldPosition(target);
    },
  };
}
