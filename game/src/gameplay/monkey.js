import * as THREE from 'three';
import { cloneMonkeyModel } from './monkeyModel';
import { createPatrol } from './patrolMotion';

const HIT_ANIMATION_DURATION = 0.6;
const BOB_HEIGHT = 0.06;
// 순찰 끝에서 플레이어를 볼 때 몸을 흔드는 정도와 빠르기. 예전 도발 연출의 값 그대로다.
const TAUNT_SWING = 0.6;
const TAUNT_FREQUENCY = 10;
// 1유닛 나아갈 때 걸음 위상이 도는 양(라디안). 최고속이 진폭 3 × 주기 0.9 ≈ 2.7유닛/초라서
// 2.4면 초당 약 한 걸음 주기가 된다. 화면을 보고 맞출 값이다.
const STRIDE_PER_UNIT = 2.4;
// 다리 스윙 폭(라디안). 화면을 보고 맞출 값이다. 조준(FOV 9)해야 눈에 들어온다.
const LEG_SWING = 0.35;
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

  // 이 FBX에는 애니메이션 클립이 idle 하나뿐이라 걸음은 절차적으로 만든다.
  // 이름이 없으면 다리 갱신을 건너뛴다.
  const leftLeg = model.getObjectByName('b_Left_Leg01');
  const rightLeg = model.getObjectByName('b_Right_Leg01');
  const legs = leftLeg && rightLeg ? { left: leftLeg, right: rightLeg } : null;

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

  const patrol = createPatrol({
    amplitude: swayAmplitude,
    frequency: swayFrequency,
    phase: swayPhase,
  });

  const state = {
    phase: 'idle',
    phaseOffset: Math.random() * Math.PI * 2,
    elapsed: 0,
    hitElapsed: 0,
    gaitPhase: Math.random() * Math.PI * 2,
    stride: 0,
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

    const motion = patrol.sample(state.elapsed, dt);
    group.position.x = position.x + motion.offsetX;

    // 도발은 순찰 끝에서 플레이어를 보는 순간에만 나온다. taunt가 그때 1이라
    // 별도의 타이머 없이 진행 방향 위에 얹기만 하면 된다. phaseOffset을 더해야
    // swayPhase가 같은 원숭이끼리(타워 두 마리 등) 도발이 완전히 겹치지 않는다.
    const wobble = Math.sin(state.elapsed * TAUNT_FREQUENCY + state.phaseOffset) * TAUNT_SWING * motion.taunt;
    group.rotation.y = motion.facing + wobble;

    // 시간이 아니라 나아간 거리로 걸음을 돌린다. 이래야 발이 안 미끄러진다.
    state.gaitPhase += motion.gaitDelta * STRIDE_PER_UNIT;
    state.stride = motion.stride;
  }

  // 믹서가 클립 포즈를 쓴 뒤에 불러야 한다. 앞에서 부르면 클립이 덮어써서 사라진다.
  // '=' 가 아니라 '+=' 라서 idle 클립의 숨쉬기가 살아있고 그 위에 걸음만 얹힌다.
  // stride를 곱해야 한다 — 안 그러면 멈춘 원숭이도 gaitPhase 시드값만큼 다리가
  // 벌어진 채로 굳어버린다(타워 원숭이는 항상, 순찰 원숭이는 양 끝에서 잠깐).
  // stride는 생속도가 아니라 순찰 끝에서만 0으로 떨어지는 곡선이다. 생속도를 쓰면
  // 주기의 3분의 1 동안 스윙이 죽어 걷기 동작이 사라진 것처럼 보인다.
  function applyGait() {
    if (!legs) return;
    const swing = Math.sin(state.gaitPhase) * LEG_SWING * state.stride;
    legs.left.rotation.x += swing;
    legs.right.rotation.x -= swing;
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
    // 순찰 중 도발로 틀어진 y축 회전을 지운다. 안 지우면 죽음 텀블이
    // Rx·Ry·Rz 합성 때문에 옆으로 돌아간 몸에 걸려서 방향이 매번 달라진다.
    group.rotation.y = 0;
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
        applyGait();
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
