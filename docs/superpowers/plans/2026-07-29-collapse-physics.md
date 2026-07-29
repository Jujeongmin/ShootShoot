# 구조물 붕괴 물리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구조물이 통짜로 기울어 사라지는 대신, 맞은 지점에서 조각이 튀어나가 중력으로 떨어지고 바닥에서 튄 뒤 멈췄다가 사라지게 한다.

**Architecture:** 운동 계산은 three.js 를 모르는 순수 모듈(`debris.js`)이 하고, `obstacles.js` 는 조각을 그룹에서 떼어내 매 프레임 그 결과를 오브젝트에 옮긴다. 명중점은 `collapseStructure` 인자로 들어온다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), three.js 0.166. 새 의존성 없음.

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 153개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- **새 의존성 금지.** 물리 엔진을 넣지 않는다.
- 조각끼리 충돌시키지 않는다. 조각은 서로 통과한다.
- 난수를 쓰지 않는다. 같은 사격은 같은 붕괴를 내야 한다.
- 발판 위 원숭이는 건드리지 않는다. 지금처럼 죽는 연출만 한다.
- `getBlockingMeshes`, `getPillarMeshes`, `getTowerSlots`, `findStructuresInBox` 의 동작과 반환 형태는 바뀌지 않는다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- `obstacles.js` 는 `loadObstacles(scene)` 하나를 내보내고 Promise 를 준다.
- 타워 2개, 참호 2개. 각각 `THREE.Group` 에 담겨 `scene` 에 붙는다.
- 타워 그룹의 자식: 상자 인스턴스 4개(`crateGltf.scene.clone()`)와 발판 1개(`sackTrenchGltf.scene.clone()`).
- 참호 그룹의 자식: 자루벽 인스턴스 1개.
- `crate.glb` 와 `sack-trench.glb` 는 둘 다 메시가 하나다. 그래서 타워는 5조각, 참호는 1조각이 된다. 더 쪼갤 수 없다.
- 각 메시의 재질은 로드할 때 `clone()` 된다. 조각마다 따로 페이드할 수 있다.
- `advanceCollapse(structure, dt)` 가 지금 그룹의 `rotation.z`, `position.y`, 재질 `opacity` 를 한꺼번에 움직인다. 이 함수는 통째로 바뀐다.
- `structure.collapsing` 은 붕괴가 시작됐다는 뜻이고, `collapsed` 는 끝났다는 뜻이다. `getBlockingMeshes` / `getPillarMeshes` / `findStructuresInBox` 가 `!collapsing` 으로 거른다.
- `obstacles.update(scaledDt)` 는 `game.js` 프레임 루프에서 불린다. 마지막 처치 슬로모가 이미 반영된 델타다.
- `GROUND_Y = -1.0` 이 섬 윗면이다.
- `game.js` 의 `applyTowerCollapse(hitTowerIndex, burstColor)` 가 `collapseStructure` 를 부르는 유일한 타워 경로다. 바주카는 `resolveBazookaImpact` 에서 `obstacles.collapseStructure(structure)` 를 직접 부른다.
- `handleWeaponShot` 은 이미 `firstPointByMonkey` 라는 Map 으로 원숭이별 최근접 교차점을 모은다. 타워도 같은 방식으로 모으면 된다.

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/debris.js` | 조각 하나의 운동과 충격 임펄스. 순수 계산 |
| `test/debris.test.js` | 위 모듈 테스트 |

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/gameplay/obstacles.js` | 조각 단위 붕괴로 재작성, `collapseStructure` 가 `impactPoint` 를 받음 |
| `game/src/gameplay/game.js` | 명중점을 넘김 (총알·바주카 양쪽) |

**건드리지 않는 파일**

`shooting.js`, `targetManager.js`, `monkey.js`, `scoring.js`, `world.js`, `skyDecor.js`, `config.js`, `bazookaProjectile.js`.

---

### Task 1: 조각 물리 순수 모듈

three.js 가 안 들어가므로 vitest 의 node 환경에서 그대로 돈다.

**Files:**
- Create: `game/src/gameplay/debris.js`
- Create: `test/debris.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (Task 2 가 쓴다):
  - `createDebrisBody({ position, rotation, velocity, spin, restY }) -> { step(dt), getPosition(), getRotation(), isResting() }` — `position` / `rotation` / `velocity` / `spin` 은 전부 `{ x, y, z }`
  - `impactImpulse(pieceCenter, impactPoint, strength) -> { velocity: {x,y,z}, spin: {x,y,z} }`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/debris.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createDebrisBody, impactImpulse } from '../game/src/gameplay/debris.js';

function fallingBody(y, velocity = { x: 0, y: 0, z: 0 }, spin = { x: 0, y: 0, z: 0 }) {
  return createDebrisBody({
    position: { x: 0, y, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    velocity,
    spin,
    restY: 0,
  });
}

describe('createDebrisBody', () => {
  it('falls under gravity', () => {
    const body = fallingBody(10);
    body.step(0.1);
    expect(body.getPosition().y).toBeLessThan(10);
  });

  it('turns by the angular velocity', () => {
    const body = fallingBody(10, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: -1 });
    body.step(0.5);
    expect(body.getRotation().x).toBeCloseTo(1);
    expect(body.getRotation().z).toBeCloseTo(-0.5);
  });

  it('bounces back up after landing', () => {
    const body = fallingBody(0.1, { x: 0, y: -20, z: 0 });
    body.step(0.05);
    expect(body.getPosition().y).toBe(0);
    body.step(0.01);
    expect(body.getPosition().y).toBeGreaterThan(0);
  });

  it('comes to rest after enough bounces', () => {
    const body = fallingBody(3, { x: 4, y: 0, z: 0 });
    for (let i = 0; i < 400; i += 1) body.step(0.016);
    expect(body.isResting()).toBe(true);
    expect(body.getPosition().y).toBe(0);
  });

  it('does not move once it is resting', () => {
    const body = fallingBody(3, { x: 4, y: 0, z: 0 });
    for (let i = 0; i < 400; i += 1) body.step(0.016);
    const settled = body.getPosition();
    for (let i = 0; i < 20; i += 1) body.step(0.016);
    expect(body.getPosition()).toEqual(settled);
  });

  it('never sinks below the rest height even on a very long frame', () => {
    const body = fallingBody(5);
    body.step(2);
    expect(body.getPosition().y).toBe(0);
  });
});

describe('impactImpulse', () => {
  it('pushes the piece away from the impact point', () => {
    const { velocity } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(velocity.x).toBeGreaterThan(0);
  });

  it('throws a nearer piece harder than a far one', () => {
    const near = impactImpulse({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    const far = impactImpulse({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(near.velocity.x).toBeGreaterThan(far.velocity.x);
  });

  it('lifts the piece even when the impact is level with it', () => {
    const { velocity } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(velocity.y).toBeGreaterThan(0);
  });

  it('gives no spin when the impact lands at the height of the piece centre', () => {
    const { spin } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(spin.x).toBeCloseTo(0);
    expect(spin.y).toBeCloseTo(0);
    expect(spin.z).toBeCloseTo(0);
  });

  it('spins the opposite way when hit above the centre rather than below', () => {
    const below = impactImpulse({ x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    const above = impactImpulse({ x: 2, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(below.spin.z).not.toBeCloseTo(0);
    expect(Math.sign(below.spin.z)).toBe(-Math.sign(above.spin.z));
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/debris.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/debris.js"`

- [ ] **Step 3: 구현**

Create `game/src/gameplay/debris.js`:

```js
// 붕괴 조각 하나의 운동만 다룬다. three.js 를 쓰지 않고 { x, y, z } 만 주고받으므로
// 프레임 루프 밖에서 테스트된다.

const GRAVITY = 26;
// 바닥에 부딪히고 남는 속도 비율. 나무 궤짝이라 잘 안 튄다.
const RESTITUTION = 0.35;
const GROUND_FRICTION = 0.5;
const SPIN_DAMPING = 0.5;
// 이보다 느리게 바닥에 닿으면 더 튀지 않고 멈춘다. 없으면 영원히 잘게 떤다.
const REST_SPEED = 1.2;
// 명중점이 조각 중심과 겹칠 때 속력이 발산하지 않도록 거리에 바닥을 깐다.
const MIN_IMPACT_DISTANCE = 0.5;
// 위로 띄우는 비율. 없으면 조각이 전부 바닥을 미끄러지기만 한다.
const IMPACT_LIFT = 0.45;
const SPIN_GAIN = 2.4;

export function createDebrisBody({ position, rotation, velocity, spin, restY }) {
  const currentPosition = { x: position.x, y: position.y, z: position.z };
  const currentRotation = { x: rotation.x, y: rotation.y, z: rotation.z };
  const currentVelocity = { x: velocity.x, y: velocity.y, z: velocity.z };
  const currentSpin = { x: spin.x, y: spin.y, z: spin.z };
  let resting = false;

  return {
    step(dt) {
      if (resting) return;

      currentVelocity.y -= GRAVITY * dt;
      currentPosition.x += currentVelocity.x * dt;
      currentPosition.y += currentVelocity.y * dt;
      currentPosition.z += currentVelocity.z * dt;
      currentRotation.x += currentSpin.x * dt;
      currentRotation.y += currentSpin.y * dt;
      currentRotation.z += currentSpin.z * dt;

      if (currentPosition.y > restY) return;

      // 프레임이 길어 바닥을 지나쳤어도 여기서 끌어올리므로 뚫고 내려가지 않는다.
      currentPosition.y = restY;

      if (Math.abs(currentVelocity.y) < REST_SPEED) {
        resting = true;
        currentVelocity.x = 0;
        currentVelocity.y = 0;
        currentVelocity.z = 0;
        currentSpin.x = 0;
        currentSpin.y = 0;
        currentSpin.z = 0;
        return;
      }

      currentVelocity.y = -currentVelocity.y * RESTITUTION;
      currentVelocity.x *= GROUND_FRICTION;
      currentVelocity.z *= GROUND_FRICTION;
      currentSpin.x *= SPIN_DAMPING;
      currentSpin.y *= SPIN_DAMPING;
      currentSpin.z *= SPIN_DAMPING;
    },
    getPosition() {
      return { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z };
    },
    getRotation() {
      return { x: currentRotation.x, y: currentRotation.y, z: currentRotation.z };
    },
    isResting() {
      return resting;
    },
  };
}

// 조각은 맞은 곳의 반대편으로 밀린다. 가까울수록 세게 난다.
export function impactImpulse(pieceCenter, impactPoint, strength) {
  const dx = pieceCenter.x - impactPoint.x;
  const dy = pieceCenter.y - impactPoint.y;
  const dz = pieceCenter.z - impactPoint.z;
  const distance = Math.max(Math.hypot(dx, dy, dz), MIN_IMPACT_DISTANCE);
  const speed = strength / (1 + distance);

  const velocity = {
    x: (dx / distance) * speed,
    y: (dy / distance) * speed + speed * IMPACT_LIFT,
    z: (dz / distance) * speed,
  };

  // 조각 중심보다 아래를 맞히면 밀리는 방향으로 앞구른다. 회전축은 미는 방향과
  // 수직인 수평축이고, 크기는 지렛대 길이(조각 중심 y - 명중점 y)에 비례한다.
  // 난수를 안 쓰므로 같은 사격은 항상 같은 붕괴를 낸다.
  const horizontal = Math.hypot(velocity.x, velocity.z);
  if (horizontal === 0) {
    return { velocity, spin: { x: 0, y: 0, z: 0 } };
  }
  const magnitude = speed * dy * SPIN_GAIN;
  const spin = {
    x: (velocity.z / horizontal) * magnitude,
    y: 0,
    z: (-velocity.x / horizontal) * magnitude,
  };

  return { velocity, spin };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/debris.test.js`
Expected: PASS, 11 tests

- [ ] **Step 5: 전체 테스트와 빌드**

Run: `npm test`
Expected: 164 tests passed (153 + 11)

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/debris.js test/debris.test.js
git commit -m "feat: add the debris body integrator

The collapse is about to be per-piece, and the arithmetic that decides
where a piece goes sits inside the frame loop where no test reaches it.
It comes out on its own instead, taking plain numbers so it runs in the
node test environment with no three.js at all.

The ground contact clamps to the rest height before deciding whether to
bounce, so a long frame cannot carry a piece through the floor.

Spin comes from the lever between the impact and the piece centre rather
than from a random number: hitting low topples a piece forward, hitting
dead centre does not turn it, and the same shot always looks the same."
```

---

### Task 2: 조각 단위 붕괴

`obstacles.js` 의 붕괴를 조각별로 다시 쓴다. 이 태스크가 끝나면 게임에서 눈으로 확인할 수 있다 — 명중점은 아직 안 들어오므로 기본값(구조물 중심 앞쪽)으로 날아간다.

**Files:**
- Modify: `game/src/gameplay/obstacles.js`

**Interfaces:**
- Consumes: Task 1 의 `createDebrisBody(...)` 와 `impactImpulse(pieceCenter, impactPoint, strength)`
- Produces: `collapseStructure({ kind, index, impactPoint })` — `impactPoint` 는 `THREE.Vector3` 이며 없으면 기본값을 쓴다. Task 3 이 채운다.

- [ ] **Step 1: import 와 상수**

`game/src/gameplay/obstacles.js` 맨 위 import 에 더한다:

```js
import { createDebrisBody, impactImpulse } from './debris.js';
```

그리고 상수 묶음에서 아래 세 줄을 **지운다**:

```js
const COLLAPSE_DURATION = 0.3;
const COLLAPSE_TILT = Math.PI / 2;
const COLLAPSE_DROP = 0.6;
```

지운 자리에 넣는다:

```js
// 조각을 밀어내는 세기. 거리로 나눠 쓰므로 가까운 조각이 이 값에 가깝게 튄다.
const DEBRIS_IMPACT_STRENGTH = 26;
// 멈춘 조각을 얼마나 두었다가 지울지. 부순 흔적이 잠깐 남아야 타격감이 산다.
const DEBRIS_HOLD_SECONDS = 1.5;
const DEBRIS_FADE_SECONDS = 0.5;
// 명중점을 못 받았을 때 쓸 기본값. 구조물 중심에서 카메라 쪽으로 이만큼 당긴
// 지점을 때린 걸로 치면 조각이 카메라 반대편으로 밀려 예전 붕괴와 방향이 비슷하다.
const DEFAULT_IMPACT_OFFSET_Z = 1.2;
```

- [ ] **Step 2: 조각 만드는 헬퍼 추가**

`collectMaterials` 함수 바로 아래에 넣는다:

```js
// 조각 하나를 기록한다. 붕괴가 시작되면 이 오브젝트가 그룹에서 떨어져 나와 혼자 움직인다.
function makePiece(object) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);

  const materials = [];
  object.traverse((child) => {
    if (child.isMesh) collectMaterials(child, materials);
  });

  return {
    object,
    materials,
    homeParent: object.parent,
    homePosition: object.position.clone(),
    homeQuaternion: object.quaternion.clone(),
    // 조각 원점에서 가장 아래 면까지의 거리. 이걸 빼먹으면 원점이 바닥에 닿을 때까지
    // 내려가서 조각 절반이 땅에 파묻힌 채로 멈춘다.
    restOffset: worldPosition.y - box.min.y,
    // 원점이 조각 한가운데가 아니다. 지렛대를 원점으로 재면 회전 방향이 틀린다.
    centerOffsetY: box.getCenter(new THREE.Vector3()).y - worldPosition.y,
    body: null,
    restedFor: 0,
  };
}
```

- [ ] **Step 3: 참호에 조각 목록 달기**

참호를 만드는 `GROUND_PLACEMENTS.forEach` 안이다. 기존:

```js
        trenches.push({
          index: trenchIndex,
          group,
          meshes,
          materials,
          baseY: GROUND_Y,
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_LOCAL_Y, placement.z),
        });
```
변경 후:
```js
        trenches.push({
          index: trenchIndex,
          group,
          meshes,
          // 자루벽 모델은 메시가 하나라 조각도 하나다. 한 덩이로 굴러간다.
          pieces: [makePiece(instance)],
          collapsing: false,
          collapsed: false,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_LOCAL_Y, placement.z),
        });
```

- [ ] **Step 4: 타워에 조각 목록 달기**

타워를 만드는 `TOWER_PLACEMENTS.forEach` 안이다. 먼저 상자 루프에서 인스턴스를 모은다. 기존:

```js
        const pillarMeshes = [];
        const materials = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
```
변경 후:
```js
        const pillarMeshes = [];
        const crateInstances = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
```

(`const materials = [];` 줄은 Step 8 에서 지우는 것과 같은 줄이다. 여기서 한꺼번에 지워도 된다.)

같은 루프 안, `group.add(crateInstance);` 바로 아래에 한 줄 더한다:

```js
            crateInstances.push(crateInstance);
```

그리고 `towers.push({...})` 를 바꾼다. 기존:

```js
        towers.push({
          index: towerIndex,
          group,
          pillarMeshes,
          materials,
          baseY: 0,
          center: new THREE.Vector3(placement.x, 0 + TOWER_CENTER_LOCAL_Y, placement.z),
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
```
변경 후:
```js
        towers.push({
          index: towerIndex,
          group,
          pillarMeshes,
          // 상자 4개와 발판 1개. 모델이 전부 메시 하나라 이 이상 못 쪼갠다.
          pieces: [...crateInstances, floor].map(makePiece),
          center: new THREE.Vector3(placement.x, 0 + TOWER_CENTER_LOCAL_Y, placement.z),
          collapsing: false,
          collapsed: false,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
```

- [ ] **Step 5: `advanceCollapse` 를 조각 적분으로 교체**

기존 `advanceCollapse` 함수 전체를 지우고 그 자리에 셋을 넣는다:

```js
      // 명중점을 못 받은 경우. 구조물 중심보다 카메라 쪽을 때린 걸로 쳐서 조각이
      // 카메라 반대편으로 밀리게 한다.
      function defaultImpactPoint(structure) {
        return new THREE.Vector3(
          structure.center.x,
          structure.center.y,
          structure.center.z + DEFAULT_IMPACT_OFFSET_Z
        );
      }

      function startCollapse(structure, impactPoint) {
        structure.collapsing = true;
        const impact = impactPoint ?? defaultImpactPoint(structure);

        for (const piece of structure.pieces) {
          const object = piece.object;
          // attach 는 월드 변환을 보존하므로 조각이 있던 자리에 그대로 남는다.
          // 붙이고 나면 scene 이 원점에 있으므로 local 좌표가 곧 월드 좌표다.
          scene.attach(object);
          const center = {
            x: object.position.x,
            y: object.position.y + piece.centerOffsetY,
            z: object.position.z,
          };
          const { velocity, spin } = impactImpulse(center, impact, DEBRIS_IMPACT_STRENGTH);
          piece.body = createDebrisBody({
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
            velocity,
            spin,
            restY: GROUND_Y + piece.restOffset,
          });
          piece.restedFor = 0;
        }
      }

      function advanceCollapse(structure, dt) {
        if (!structure.collapsing || structure.collapsed) return;

        let allGone = true;
        for (const piece of structure.pieces) {
          if (!piece.body) continue;
          piece.body.step(dt);
          const position = piece.body.getPosition();
          const rotation = piece.body.getRotation();
          piece.object.position.set(position.x, position.y, position.z);
          piece.object.rotation.set(rotation.x, rotation.y, rotation.z);

          if (!piece.body.isResting()) {
            allGone = false;
            continue;
          }

          piece.restedFor += dt;
          const fadeElapsed = piece.restedFor - DEBRIS_HOLD_SECONDS;
          if (fadeElapsed <= 0) {
            allGone = false;
            continue;
          }

          const opacity = Math.max(0, 1 - fadeElapsed / DEBRIS_FADE_SECONDS);
          for (const material of piece.materials) {
            material.transparent = true;
            material.opacity = opacity;
          }
          if (opacity > 0) {
            allGone = false;
            continue;
          }
          piece.object.visible = false;
        }

        if (allGone) structure.collapsed = true;
      }
```

- [ ] **Step 6: `resetStructure` 를 조각 복원으로 교체**

기존 `resetStructure` 전체를 지우고 넣는다:

```js
      function resetStructure(structure) {
        structure.collapsing = false;
        structure.collapsed = false;
        structure.group.visible = true;
        structure.group.rotation.z = 0;

        for (const piece of structure.pieces) {
          piece.body = null;
          piece.restedFor = 0;
          // 조각이 scene 밑으로 나가 있다. 원래 부모로 돌려놓고 저장해 둔 로컬
          // 변환을 그대로 씌운다 — attach 가 월드를 보존하려 들기 때문에 덮어야 한다.
          piece.homeParent.attach(piece.object);
          piece.object.position.copy(piece.homePosition);
          piece.object.quaternion.copy(piece.homeQuaternion);
          piece.object.visible = true;
          for (const material of piece.materials) {
            material.opacity = 1;
            material.transparent = false;
          }
        }
      }
```

- [ ] **Step 7: `collapseStructure` 가 명중점을 받게 하기**

반환 객체의 `collapseStructure` 다. 기존:

```js
        collapseStructure({ kind, index }) {
          const structure = listOf(kind).find((s) => s.index === index);
          if (!structure || structure.collapsing) return;
          structure.collapsing = true;
        },
```
변경 후:
```js
        collapseStructure({ kind, index, impactPoint }) {
          const structure = listOf(kind).find((s) => s.index === index);
          if (!structure || structure.collapsing) return;
          startCollapse(structure, impactPoint);
        },
```

- [ ] **Step 8: 구조물 단위 `materials` 걷어내기**

페이드가 조각별로 바뀌었으므로 구조물이 들고 있던 `materials` 배열은 이제 아무도 안 읽는다. `makePiece` 가 자기 재질을 직접 모은다.

지울 것 넷이다:

1. 참호 루프의 `const materials = [];` 와 그 traverse 안의 `collectMaterials(object, materials);`
2. `trenches.push({...})` 의 `materials,` 줄
3. 타워 루프의 `const materials = [];` 와 상자·발판 traverse 안의 `collectMaterials(object, materials);` 두 줄
4. `towers.push({...})` 의 `materials,` 줄

`collectMaterials` 함수 자체는 `makePiece` 가 쓰므로 **남긴다.** 참호의 `meshes` 배열과 타워의 `pillarMeshes` 배열도 `getBlockingMeshes` / `getPillarMeshes` 가 쓰므로 **남긴다.**

- [ ] **Step 9: 죽은 필드가 남지 않았는지 확인**

Run: `grep -n "collapseElapsed\|baseY\|COLLAPSE_TILT\|COLLAPSE_DROP\|COLLAPSE_DURATION\|structure.materials" game/src/gameplay/obstacles.js`
Expected: 출력 없음 (exit 1). 하나라도 남으면 지운다.

- [ ] **Step 10: 테스트와 빌드**

Run: `npm test`
Expected: 164 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 11: 커밋**

```bash
git add game/src/gameplay/obstacles.js
git commit -m "feat: break a collapsing structure into falling pieces

The old collapse tilted one group ninety degrees and faded it, so every
structure fell the same way no matter where it was hit, and it read as a
single slab rather than as something coming apart.

Each piece is detached with Object3D.attach, which preserves the world
transform so nothing jumps at the moment of the hit, and from then on it
integrates on its own. The rest height is measured from the piece's own
bounding box, otherwise a piece stops when its origin reaches the ground
and half of it is buried.

Pieces linger where they land before fading, so the wreck is visible for
a moment instead of vanishing mid-air."
```

---

### Task 3: 명중점 전달

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 2 의 `collapseStructure({ kind, index, impactPoint })`
- Produces: 없음

- [ ] **Step 1: `applyTowerCollapse` 가 명중점을 받게 하기**

`game/src/gameplay/game.js` 의 함수 선언과 첫 줄이다. 기존:

```js
  function applyTowerCollapse(hitTowerIndex, burstColor) {
    obstacles.collapseStructure({ kind: 'tower', index: hitTowerIndex });
```
변경 후:
```js
  function applyTowerCollapse(hitTowerIndex, impactPoint, burstColor) {
    obstacles.collapseStructure({ kind: 'tower', index: hitTowerIndex, impactPoint });
```

인자 순서가 바뀐다. 아래 두 스텝에서 부르는 곳 두 군데를 전부 고친다.

- [ ] **Step 2: 총알 경로에서 타워별 교차점 모으기**

`handleWeaponShot` 첫머리다. 기존:

```js
    const firstPointByMonkey = new Map();
    const entries = intersections.map((intersection) => {
      const { monkeyId, towerIndex } = intersection.object.userData;
      if (monkeyId && !firstPointByMonkey.has(monkeyId)) {
        firstPointByMonkey.set(monkeyId, intersection.point);
      }
      return { monkeyId, towerIndex };
    });
```
변경 후:
```js
    const firstPointByMonkey = new Map();
    const firstPointByTower = new Map();
    const entries = intersections.map((intersection) => {
      const { monkeyId, towerIndex } = intersection.object.userData;
      if (monkeyId && !firstPointByMonkey.has(monkeyId)) {
        firstPointByMonkey.set(monkeyId, intersection.point);
      }
      // towerIndex 는 0 일 수 있으므로 참/거짓으로 보면 첫 타워가 빠진다.
      if (towerIndex !== undefined && !firstPointByTower.has(towerIndex)) {
        firstPointByTower.set(towerIndex, intersection.point);
      }
      return { monkeyId, towerIndex };
    });
```

- [ ] **Step 3: 총알 경로의 호출 고치기**

같은 함수 안, 타워를 무너뜨리는 반복문이다. 기존:

```js
      const towerKill = applyTowerCollapse(towerIndex);
```
변경 후:
```js
      const towerKill = applyTowerCollapse(towerIndex, firstPointByTower.get(towerIndex));
```

- [ ] **Step 4: 바주카 경로의 호출 고치기**

`resolveBazookaImpact` 안이다. 이 함수는 `impactPoint` 를 이미 인자로 받고 있다. 기존:

```js
        const towerKill = applyTowerCollapse(structure.index, 0xff6600);
```
변경 후:
```js
        const towerKill = applyTowerCollapse(structure.index, impactPoint, 0xff6600);
```

그리고 같은 반복문의 참호 쪽이다. 기존:

```js
      obstacles.collapseStructure(structure);
```
변경 후:
```js
      // 폭심에서 밀려나야 한다. structure 는 { kind, index } 뿐이라 명중점을 얹어 넘긴다.
      obstacles.collapseStructure({ ...structure, impactPoint });
```

- [ ] **Step 5: 인자 순서를 안 고친 호출이 없는지 확인**

Run: `grep -n "applyTowerCollapse" game/src/gameplay/game.js`
Expected: 세 줄 — 선언 하나와 호출 둘. 호출 둘 다 두 번째 인자가 명중점이어야 한다. `applyTowerCollapse(structure.index, 0xff6600)` 처럼 색이 두 번째에 오는 줄이 남아 있으면 안 된다.

- [ ] **Step 6: 테스트와 빌드**

Run: `npm test`
Expected: 164 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: throw the debris away from where the shot landed

A collapse that always threw its pieces the same way hid the one thing
the player did, which was choosing where to aim. Both paths already knew
the point: the shot handler keeps the nearest intersection per monkey and
now keeps one per tower the same way, and the bazooka has been carrying
its blast centre all along.

applyTowerCollapse takes the impact point as its second argument rather
than appending it, so the two call sites read the same way round."
```

- [ ] **Step 8: 사용자 육안 확인 요청**

이 세션 환경에서는 브라우저 스크린샷이 실패한다 (`the Browser pane is not displayed`). 다음을 사용자에게 확인해 달라고 요청한다 (직접 브라우저를 열려고 하지 말 것):

1. 타워를 쏘면 상자 다섯 조각이 따로 날아가는가
2. 맞힌 쪽 반대편으로 밀려나는가 — 왼쪽 기둥을 쏘면 왼쪽에서 오른쪽으로
3. 조각이 바닥에서 튀고 멈추는가, 땅에 파묻히지 않는가
4. 멈춘 조각이 잠깐 있다가 사라지는가
5. 참호는 한 덩이로 굴러가는가 (조각이 하나뿐인 게 의도다)
6. 바주카로 부술 때도 폭심 반대편으로 날아가는가
7. 마지막 처치 슬로모 중에 붕괴가 같이 느려지는가
8. 다음 라운드가 시작되면 구조물이 원래 자리에 멀쩡히 돌아오는가

개발 서버 주소는 `http://127.0.0.1:5174/` 다. 5173은 다른 프로젝트(TowerWar)가 잡고 있다.
