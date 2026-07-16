import * as THREE from 'three';

const BODY_COLOR = 0x8b5a2b;
const FACE_COLOR = 0xf0c39e;
const HIT_ANIMATION_DURATION = 0.6;
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;

export function createMonkey({ id, position, scale = 1, speed = 0.5 }) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.scale.setScalar(scale);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: FACE_COLOR });

  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 8), bodyMaterial);
  bodyMesh.position.y = 0.6;
  bodyMesh.userData = { monkeyId: id, part: 'body' };
  group.add(bodyMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyMaterial);
  headMesh.position.y = 1.25;
  headMesh.userData = { monkeyId: id, part: 'head' };
  group.add(headMesh);

  const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), faceMaterial);
  faceMesh.position.set(0, 1.22, 0.3);
  faceMesh.userData = { monkeyId: id, part: 'head' };
  group.add(faceMesh);

  const earGeometry = new THREE.SphereGeometry(0.12, 8, 8);
  const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
  leftEar.position.set(-0.3, 1.4, 0);
  leftEar.userData = { monkeyId: id, part: 'head' };
  group.add(leftEar);

  const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
  rightEar.position.set(0.3, 1.4, 0);
  rightEar.userData = { monkeyId: id, part: 'head' };
  group.add(rightEar);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.3, -0.3),
    new THREE.Vector3(0, 0.1, -0.6),
    new THREE.Vector3(0.15, 0.3, -0.8),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 12, 0.05, 6, false),
    bodyMaterial
  );
  tailMesh.userData = { monkeyId: id, part: 'body' };
  group.add(tailMesh);

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

    const sway = Math.sin(state.elapsed * speed + state.phaseOffset) * 0.5;
    group.position.x = position.x + sway;

    if (state.isTaunting) {
      state.tauntElapsed += dt;
      group.rotation.y = Math.sin(state.tauntElapsed * 10) * 0.6;
      if (state.tauntElapsed > 0.8) {
        state.isTaunting = false;
        state.tauntElapsed = 0;
        state.nextTauntAt = state.elapsed + TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN);
      }
    } else {
      group.rotation.y = Math.sin(state.elapsed * 0.7 + state.phaseOffset) * 0.15;
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
    bodyMaterial.transparent = true;
    bodyMaterial.opacity = fade;
    faceMaterial.transparent = true;
    faceMaterial.opacity = fade;
    if (t >= 1) {
      state.dead = true;
    }
  }

  return {
    id,
    group,
    getRaycastMeshes() {
      return [bodyMesh, headMesh, faceMesh, leftEar, rightEar, tailMesh];
    },
    update(dt) {
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
    getWorldPosition(target = new THREE.Vector3()) {
      return group.getWorldPosition(target);
    },
  };
}
