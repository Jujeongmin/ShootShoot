import * as THREE from 'three';
import { cloneMonkeyModel } from './monkeyModel.js';

const HIT_ANIMATION_DURATION = 0.6;
const BOB_HEIGHT = 0.06;
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;
// Calibrated against the SkinnedMesh's ANIMATED pose (not rest-pose): live-sampling the
// idle clip's full loop found the reachable local Y range is about -81 to +28 (head/torso/
// arms/legs; the tail is excluded as its bind-relative Y swings wildly and isn't a reliable
// signal), so this sits near the top ~20% of that live range.
const HEAD_CUTOFF_LOCAL_Y = 5;
const FLASH_DURATION = 0.15;
const FLASH_COLOR = 0xff3333;
const FLINCH_DISTANCE = 0.08;
const HP_BAR_CANVAS_WIDTH = 64;
const HP_BAR_CANVAS_HEIGHT = 10;
const HP_BAR_LOCAL_Y = 2.1;
const HP_BAR_SPRITE_SIZE = { x: 0.9, y: 0.14 };
// HP_BAR_LOCAL_Y(2.1)는 몸의 꼭대기를 가리키므로, 그 절반이 시각적 중심이다.
const CENTER_LOCAL_Y = 1.05;

function createHpBar() {
  const canvas = document.createElement('canvas');
  canvas.width = HP_BAR_CANVAS_WIDTH;
  canvas.height = HP_BAR_CANVAS_HEIGHT;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, HP_BAR_LOCAL_Y, 0);
  sprite.scale.set(HP_BAR_SPRITE_SIZE.x, HP_BAR_SPRITE_SIZE.y, 1);
  sprite.visible = false;
  sprite.renderOrder = 999;

  function draw(current, max) {
    const ratio = Math.max(0, current) / max;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0,0,0,0.65)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ratio > 0.5 ? '#5ec85e' : ratio > 0.25 ? '#f0a500' : '#dd3333';
    context.fillRect(1, 1, Math.round((canvas.width - 2) * ratio), canvas.height - 2);
    texture.needsUpdate = true;
  }

  return { sprite, draw, dispose: () => { texture.dispose(); material.dispose(); } };
}

export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip, sway = {}, hp = 1 }) {
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
      child.castShadow = true;
      child.userData = { monkeyId: id };
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      materials.push(...mats);
    }
  });

  const baseColors = materials.map((material) => (material.color ? material.color.clone() : null));

  const hpBar = createHpBar();
  group.add(hpBar.sprite);

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
    hp,
    maxHp: hp,
    isFlashing: false,
    flashElapsed: 0,
  };

  function updateIdle(dt) {
    state.elapsed += dt;

    // 위로만 흔들리게 한다. 대칭으로 흔들면 절반의 시간 동안 발이 지면을 파고들어
    // 땅에 서 있는 게 아니라 떠 있는 것처럼 보인다.
    const bobPhase = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.5 + 0.5;
    group.position.y = position.y + bobPhase * BOB_HEIGHT;

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

  function setFlashColor(active) {
    materials.forEach((material, index) => {
      if (!material.color) return;
      if (active) {
        material.color.setHex(FLASH_COLOR);
      } else if (baseColors[index]) {
        material.color.copy(baseColors[index]);
      }
    });
  }

  function updateFlash(dt) {
    state.flashElapsed += dt;
    const t = Math.min(state.flashElapsed / FLASH_DURATION, 1);
    group.position.z = position.z - (1 - t) * FLINCH_DISTANCE;
    if (t >= 1) {
      state.isFlashing = false;
      group.position.z = position.z;
      setFlashColor(false);
    }
  }

  function startDeath(part) {
    state.hp = 0;
    hpBar.sprite.visible = false;
    state.isFlashing = false;
    setFlashColor(false);
    group.position.z = position.z;
    state.phase = 'hit';
    state.hitElapsed = 0;
    state.lastHitPart = part;
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
        if (state.isFlashing) {
          updateFlash(dt);
        }
      }
    },
    damage(amount, part) {
      if (state.phase === 'hit') return false;
      state.hp -= amount;
      if (state.hp <= 0) {
        startDeath(part);
        return true;
      }
      hpBar.draw(state.hp, state.maxHp);
      hpBar.sprite.visible = true;
      state.isFlashing = true;
      state.flashElapsed = 0;
      setFlashColor(true);
      return false;
    },
    kill() {
      if (state.phase === 'hit') return false;
      startDeath('body');
      return true;
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
    getCenterWorldPosition(target = new THREE.Vector3()) {
      group.getWorldPosition(target);
      target.y += CENTER_LOCAL_Y * group.scale.y;
      return target;
    },
    dispose() {
      hpBar.dispose();
    },
  };
}
