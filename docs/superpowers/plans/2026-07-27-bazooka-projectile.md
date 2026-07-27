# 바주카포 투사체 + 화면 기준 폭발 판정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바주카포를 쏘면 어디를 조준했든 포탄이 날아가 그 지점에서 폭발하고, 조준 레티클 사각형 안에 보이는 원숭이가 전부 죽게 만든다.

**Architecture:** 사망 판정을 월드 반경이 아니라 **화면 픽셀 기준 정사각형**으로 바꿔, 레티클에 그려진 범위와 실제 판정 범위가 항상 같은 숫자를 쓰도록 한다. 투사체는 `bazookaProjectile.js`가 독립적으로 관리하며 게임 루프의 `scaledDt`로 전진해 기존 슬로모션·일시정지와 자연스럽게 맞물린다. `setTimeout`은 쓰지 않는다.

**Tech Stack:** Vanilla JS (ES modules), three.js 0.166, Vite 5, Vitest 1.6 (`environment: 'node'`)

## Global Constraints

- 테스트 환경은 **node**다 (`vitest.config.js`). DOM이 없으므로 새 순수 모듈은 `document`/`window`에 의존하면 안 된다. DOM 사각형이 필요하면 `{ left, top, width, height }` 평범한 객체를 인자로 받는다.
- three.js는 node에서 import 가능하다. `PerspectiveCamera`, `Vector3`, `Mesh`, `SphereGeometry`, `MeshBasicMaterial`은 헤드리스로 동작한다. `scene`은 테스트에서 `{ add(){}, remove(){} }` 가짜 객체로 대체한다.
- 기존 코드 스타일을 따른다: 팩토리 함수 `createXxx(...)`가 메서드 객체를 반환, 이름 있는 export, 세미콜론 사용, 들여쓰기 2칸.
- 주석은 한국어로, 꼭 필요한 곳에만 (기존 `game.js` 주석 스타일 참고).
- 색상 상수: 바주카 레티클 `#e4503a`, 안쪽 어두운 원 `#c43a28`, 폭발 입자 `0xff8800`, 바주카 히트버스트 `0xff6600`.
- 커밋 메시지는 영어 한 줄 요약 + 필요시 한국어 본문. 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **master 브랜치에 직접 커밋한다** (사용자가 명시적으로 선택, 워크트리 미사용).
- 전체 테스트 실행: `npm test`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/screenTargeting.js` (신규) | 화면 좌표 투영 및 사각형 판정. 순수 함수만. DOM·전역 의존 없음 |
| `game/src/gameplay/bazookaProjectile.js` (신규) | 비행 중인 포탄 목록 보관, dt 기반 전진, 착탄 콜백 |
| `game/src/audio/sfx.js` (수정) | `explosion()` 추가 |
| `game/src/gameplay/effects.js` (수정) | 버스트별 수명 지원 + `spawnExplosion()` 추가 |
| `game/src/ui/scopeOverlay.js` (수정) | 바주카포용 브래킷 레티클, `show(weaponId, blastRadiusPx)` |
| `game/src/config.js` (수정) | `CONFIG.bazooka` 수치 교체 |
| `game/src/gameplay/targetManager.js` (수정) | `getMonkeys()` 추가, `findMonkeysWithinRadius()` 제거 |
| `game/src/gameplay/game.js` (수정) | `handleBazookaShot` 재작성, 루프·라운드전환·게임오버 연동 |
| `test/screenTargeting.test.js` (신규) | |
| `test/bazookaProjectile.test.js` (신규) | |
| `test/effects.test.js` (신규) | |

---

### Task 1: 화면 기준 타겟팅 (`screenTargeting.js`)

폭발 판정의 핵심. 순수 함수라 가장 먼저, 단독으로 만든다.

**Files:**
- Create: `game/src/gameplay/screenTargeting.js`
- Test: `test/screenTargeting.test.js`

**Interfaces:**
- Consumes: 없음 (three.js만)
- Produces:
  - `computeBlastRadiusPx(containerHeight: number, ratio: number) -> number`
  - `findMonkeysInScreenBox(monkeys, camera, rect, radiusPx) -> Monkey[]`
    - `monkeys`: `{ isDying(): boolean, getWorldPosition(): THREE.Vector3 }` 를 갖는 객체 배열
    - `rect`: `{ left, top, width, height }`
    - 반환: 조건을 만족하는 원소들의 부분 배열 (원본 객체 그대로)

- [ ] **Step 1: Write the failing test**

`test/screenTargeting.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeBlastRadiusPx,
  findMonkeysInScreenBox,
} from '../game/src/gameplay/screenTargeting.js';

const RECT = { left: 0, top: 0, width: 800, height: 600 };

function makeCamera() {
  // 게임의 조준 상태와 같은 좁은 FOV. 카메라는 원점에서 -z를 본다.
  const camera = new THREE.PerspectiveCamera(9, RECT.width / RECT.height, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function fakeMonkey(x, y, z, { dying = false } = {}) {
  return {
    isDying: () => dying,
    getWorldPosition: () => new THREE.Vector3(x, y, z),
  };
}

describe('computeBlastRadiusPx', () => {
  it('scales the container height by the ratio', () => {
    expect(computeBlastRadiusPx(600, 0.25)).toBe(150);
  });

  it('returns 0 for a zero-height container', () => {
    expect(computeBlastRadiusPx(0, 0.25)).toBe(0);
  });
});

describe('findMonkeysInScreenBox', () => {
  it('includes a monkey dead centre in the crosshair', () => {
    const monkey = fakeMonkey(0, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([monkey]);
  });

  it('excludes a monkey far outside the box', () => {
    const monkey = fakeMonkey(40, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('includes monkeys at different depths along the same line of sight', () => {
    // 같은 레인의 앞뒤 원숭이. 화면상 같은 위치라 둘 다 잡혀야 한다.
    const near = fakeMonkey(0, 0, -78);
    const far = fakeMonkey(0, 0, -90);
    const found = findMonkeysInScreenBox([near, far], makeCamera(), RECT, 150);
    expect(found).toEqual([near, far]);
  });

  it('uses a square box, not a circle: the diagonal corner is included', () => {
    // 정사각형 모서리 방향. 원 판정이었다면 반경 밖이라 빠졌을 위치.
    const camera = makeCamera();
    const radiusPx = 150;
    // 화면상 (center + 140px, center + 140px) 근처에 놓이는 월드 좌표를 역산한다.
    const halfHeightAt80 = 80 * Math.tan(THREE.MathUtils.degToRad(9) / 2);
    const unitPerPx = halfHeightAt80 / (RECT.height / 2);
    const monkey = fakeMonkey(140 * unitPerPx, 140 * unitPerPx, -80);
    const found = findMonkeysInScreenBox([monkey], camera, RECT, radiusPx);
    expect(found).toEqual([monkey]);
  });

  it('excludes monkeys that are already dying', () => {
    const monkey = fakeMonkey(0, 0, -80, { dying: true });
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('excludes monkeys behind the camera', () => {
    // +z는 카메라 뒤. 투영하면 화면 중앙에 겹쳐 보이지만 맞으면 안 된다.
    const monkey = fakeMonkey(0, 0, 80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), RECT, 150);
    expect(found).toEqual([]);
  });

  it('respects a rect that is offset from the viewport origin', () => {
    const offsetRect = { left: 100, top: 50, width: 800, height: 600 };
    const monkey = fakeMonkey(0, 0, -80);
    const found = findMonkeysInScreenBox([monkey], makeCamera(), offsetRect, 150);
    expect(found).toEqual([monkey]);
  });

  it('returns an empty array when given no monkeys', () => {
    expect(findMonkeysInScreenBox([], makeCamera(), RECT, 150)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/screenTargeting.test.js
```

Expected: FAIL — `Failed to resolve import "../game/src/gameplay/screenTargeting.js"`

- [ ] **Step 3: Write minimal implementation**

`game/src/gameplay/screenTargeting.js`:

```js
export function computeBlastRadiusPx(containerHeight, ratio) {
  return containerHeight * ratio;
}

export function findMonkeysInScreenBox(monkeys, camera, rect, radiusPx) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return monkeys.filter((monkey) => {
    if (monkey.isDying()) return false;

    // project()는 벡터를 제자리에서 바꾼다. getWorldPosition()이 매번 새 벡터를
    // 주므로 원숭이 좌표가 오염될 걱정은 없다.
    const ndc = monkey.getWorldPosition().project(camera);
    if (ndc.z > 1) return false; // 카메라 뒤

    const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

    return Math.abs(x - centerX) <= radiusPx && Math.abs(y - centerY) <= radiusPx;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/screenTargeting.test.js
```

Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/screenTargeting.js test/screenTargeting.test.js
git commit -m "feat: add screen-space square targeting for the bazooka blast"
```

---

### Task 2: 투사체 (`bazookaProjectile.js`)

**Files:**
- Create: `game/src/gameplay/bazookaProjectile.js`
- Test: `test/bazookaProjectile.test.js`

**Interfaces:**
- Consumes: 없음 (three.js만)
- Produces: `createBazookaProjectiles(scene) -> { spawn, update, hasPending, clear }`
  - `spawn(fromWorld: THREE.Vector3, toWorld: THREE.Vector3, flightSeconds: number, onImpact: (point: THREE.Vector3) => void)`
  - `update(dt: number)` — 누적 시간이 `flightSeconds`에 도달하면 `onImpact(toWorld)`를 **정확히 1회** 호출하고 포탄을 제거한다
  - `hasPending() -> boolean`
  - `clear()` — 대기 중 포탄을 전부 폐기한다. **`onImpact`은 호출하지 않는다**

- [ ] **Step 1: Write the failing test**

`test/bazookaProjectile.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBazookaProjectiles } from '../game/src/gameplay/bazookaProjectile.js';

function fakeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

const FROM = new THREE.Vector3(0, 0, 0);
const TO = new THREE.Vector3(0, 0, -80);

describe('createBazookaProjectiles', () => {
  it('has nothing pending before anything is spawned', () => {
    const projectiles = createBazookaProjectiles(fakeScene());
    expect(projectiles.hasPending()).toBe(false);
  });

  it('adds a mesh to the scene on spawn and reports it as pending', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(scene);
    projectiles.spawn(FROM, TO, 0.3, () => {});
    expect(scene.add).toHaveBeenCalledTimes(1);
    expect(projectiles.hasPending()).toBe(true);
  });

  it('does not call onImpact before the flight time has elapsed', () => {
    const projectiles = createBazookaProjectiles(fakeScene());
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.1);
    projectiles.update(0.1);
    expect(onImpact).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);
  });

  it('calls onImpact with the impact point once the flight time elapses', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(scene);
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.3);
    expect(onImpact).toHaveBeenCalledTimes(1);
    expect(onImpact.mock.calls[0][0].z).toBeCloseTo(-80, 6);
    expect(projectiles.hasPending()).toBe(false);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('calls onImpact exactly once even if update keeps being called', () => {
    const projectiles = createBazookaProjectiles(fakeScene());
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.update(0.5);
    projectiles.update(0.5);
    projectiles.update(0.5);
    expect(onImpact).toHaveBeenCalledTimes(1);
  });

  it('moves the mesh partway along the path while in flight', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(scene);
    projectiles.spawn(FROM, TO, 0.4, () => {});
    projectiles.update(0.2);
    const mesh = scene.add.mock.calls[0][0];
    expect(mesh.position.z).toBeCloseTo(-40, 6);
  });

  it('tracks several projectiles independently', () => {
    const projectiles = createBazookaProjectiles(fakeScene());
    const first = vi.fn();
    const second = vi.fn();
    projectiles.spawn(FROM, TO, 0.2, first);
    projectiles.spawn(FROM, TO, 0.6, second);

    projectiles.update(0.2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);

    projectiles.update(0.4);
    expect(second).toHaveBeenCalledTimes(1);
    expect(projectiles.hasPending()).toBe(false);
  });

  it('discards pending projectiles on clear without firing their callbacks', () => {
    const scene = fakeScene();
    const projectiles = createBazookaProjectiles(scene);
    const onImpact = vi.fn();
    projectiles.spawn(FROM, TO, 0.3, onImpact);
    projectiles.clear();

    expect(projectiles.hasPending()).toBe(false);
    expect(scene.remove).toHaveBeenCalledTimes(1);

    projectiles.update(1.0);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('lets a callback spawn another projectile without disturbing the update pass', () => {
    const projectiles = createBazookaProjectiles(fakeScene());
    const second = vi.fn();
    projectiles.spawn(FROM, TO, 0.2, () => {
      projectiles.spawn(FROM, TO, 0.2, second);
    });

    projectiles.update(0.2);
    expect(second).not.toHaveBeenCalled();
    expect(projectiles.hasPending()).toBe(true);

    projectiles.update(0.2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/bazookaProjectile.test.js
```

Expected: FAIL — `Failed to resolve import "../game/src/gameplay/bazookaProjectile.js"`

- [ ] **Step 3: Write minimal implementation**

`game/src/gameplay/bazookaProjectile.js`:

```js
import * as THREE from 'three';

const PROJECTILE_RADIUS = 0.3;
const PROJECTILE_COLOR = 0xff6600;

export function createBazookaProjectiles(scene) {
  const active = [];

  function disposeProjectile(projectile) {
    scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    projectile.mesh.material.dispose();
  }

  function spawn(fromWorld, toWorld, flightSeconds, onImpact) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(PROJECTILE_RADIUS, 8, 8),
      new THREE.MeshBasicMaterial({ color: PROJECTILE_COLOR })
    );
    mesh.position.copy(fromWorld);
    scene.add(mesh);

    active.push({
      mesh,
      from: fromWorld.clone(),
      to: toWorld.clone(),
      elapsed: 0,
      duration: Math.max(flightSeconds, 0.0001),
      onImpact,
    });
  }

  function update(dt) {
    // 뒤에서부터 훑는다. 착탄 콜백이 새 포탄을 spawn해도 배열 끝에 붙으므로
    // 이번 패스에서는 건드리지 않는다.
    for (let i = active.length - 1; i >= 0; i--) {
      const projectile = active[i];
      projectile.elapsed += dt;
      const t = Math.min(projectile.elapsed / projectile.duration, 1);
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, t);

      if (t < 1) continue;

      disposeProjectile(projectile);
      active.splice(i, 1);
      projectile.onImpact(projectile.to);
    }
  }

  function hasPending() {
    return active.length > 0;
  }

  function clear() {
    for (const projectile of active) {
      disposeProjectile(projectile);
    }
    active.length = 0;
  }

  return { spawn, update, hasPending, clear };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/bazookaProjectile.test.js
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/bazookaProjectile.js test/bazookaProjectile.test.js
git commit -m "feat: add dt-driven bazooka projectile flight"
```

---

### Task 3: 폭발 연출과 효과음

`effects.js`의 버스트 수명이 지금은 모듈 상수로 고정되어 있다. 폭발은 더 오래 남아야 하므로 버스트별 수명으로 바꾼다.

**Files:**
- Modify: `game/src/gameplay/effects.js`
- Modify: `game/src/audio/sfx.js`
- Test: `test/effects.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `effects.spawnExplosion(position: THREE.Vector3)` — 기존 `spawnHitBurst`보다 입자가 많고 크며 오래 남는다
  - `sfx.explosion()`

- [ ] **Step 1: Write the failing test**

`test/effects.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createEffects } from '../game/src/gameplay/effects.js';

function fakeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

describe('createEffects', () => {
  it('adds a group to the scene for a hit burst', () => {
    const scene = fakeScene();
    createEffects(scene).spawnHitBurst(new THREE.Vector3(0, 0, -10));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('removes a hit burst once its lifetime elapses', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.update(0.6);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('adds a group to the scene for an explosion', () => {
    const scene = fakeScene();
    createEffects(scene).spawnExplosion(new THREE.Vector3(0, 0, -80));
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('keeps an explosion alive longer than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    effects.update(0.6);
    expect(scene.remove).not.toHaveBeenCalled();
    effects.update(0.4);
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });

  it('gives an explosion more particles than a hit burst', () => {
    const scene = fakeScene();
    const effects = createEffects(scene);
    effects.spawnHitBurst(new THREE.Vector3(0, 0, -10));
    effects.spawnExplosion(new THREE.Vector3(0, 0, -80));
    const [burstGroup] = scene.add.mock.calls[0];
    const [explosionGroup] = scene.add.mock.calls[1];
    expect(explosionGroup.children.length).toBeGreaterThan(burstGroup.children.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/effects.test.js
```

Expected: FAIL — `effects.spawnExplosion is not a function`

- [ ] **Step 3: Write minimal implementation**

`game/src/gameplay/effects.js` 전체를 다음으로 교체한다:

```js
import * as THREE from 'three';

const PARTICLE_COUNT = 10;
const PARTICLE_LIFETIME = 0.5;
const EXPLOSION_PARTICLE_COUNT = 30;
const EXPLOSION_LIFETIME = 0.9;

export function createEffects(scene) {
  const bursts = [];

  function spawnBurst({ position, color, count, radius, minSpeed, speedRange, lifetime }) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color });
    const particles = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 4, 4), material);
      mesh.position.copy(position);
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = minSpeed + Math.random() * speedRange;
      particles.push({ mesh, velocity: direction.multiplyScalar(speed) });
      group.add(mesh);
    }
    scene.add(group);
    bursts.push({ group, particles, elapsed: 0, lifetime });
  }

  function spawnHitBurst(position, color = 0xffdd55) {
    spawnBurst({
      position,
      color,
      count: PARTICLE_COUNT,
      radius: 0.04,
      minSpeed: 1.5,
      speedRange: 1.5,
      lifetime: PARTICLE_LIFETIME,
    });
  }

  function spawnExplosion(position, color = 0xff8800) {
    spawnBurst({
      position,
      color,
      count: EXPLOSION_PARTICLE_COUNT,
      radius: 0.35,
      minSpeed: 6,
      speedRange: 8,
      lifetime: EXPLOSION_LIFETIME,
    });
  }

  function update(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.elapsed += dt;
      const t = burst.elapsed / burst.lifetime;
      for (const particle of burst.particles) {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 4 * dt;
        particle.mesh.scale.setScalar(Math.max(1 - t, 0));
      }
      if (t >= 1) {
        scene.remove(burst.group);
        bursts.splice(i, 1);
      }
    }
  }

  return { spawnHitBurst, spawnExplosion, update };
}
```

`game/src/audio/sfx.js`의 `roundClear()` 바로 다음에 추가한다:

```js
  explosion() {
    playTone({ frequency: 160, frequencyEnd: 40, duration: 0.5, type: 'sawtooth', gain: 0.3 });
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/effects.test.js
```

Expected: PASS — 5 tests

전체 테스트도 확인한다 (`effects.js` 리팩터가 다른 것을 깨지 않았는지):

```bash
npm test
```

Expected: 모든 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/effects.js game/src/audio/sfx.js test/effects.test.js
git commit -m "feat: add explosion burst effect and boom sound"
```

---

### Task 4: 바주카 브래킷 레티클

**Files:**
- Modify: `game/src/ui/scopeOverlay.js`
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js:520` (`scopeOverlay.show(...)` 호출부)

**Interfaces:**
- Consumes: `computeBlastRadiusPx` (Task 1)
- Produces: `scopeOverlay.show(weaponId: string, blastRadiusPx: number)` — `blastRadiusPx`는 바주카포일 때만 쓰인다. 나머지 무기는 기존 `70vmin` 레이아웃 그대로

- [ ] **Step 1: config에 새 수치를 넣는다**

`game/src/config.js`의 `bazooka` 블록을 다음으로 바꾼다. `blastRadius`는 Task 5에서 마지막 사용처가 사라질 때 지운다.

```js
  bazooka: {
    maxRounds: 5,
    blastRadius: 6,
    blastScreenRatio: 0.25,
    maxRange: 85,
    flightSeconds: 0.3,
    weapon: {
      id: 'bazooka', name: '바주카포', model: '/models/bazooka.glb', format: 'glb',
      scale: 0.22552, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  },
```

- [ ] **Step 2: 레티클을 구현한다**

`game/src/ui/scopeOverlay.js` 전체를 다음으로 교체한다:

```js
const RETICLE_STYLES = {
  basic: {
    ringVisible: false,
    crosshairColor: '#fff',
    centerColor: '#f00',
    centerShape: 'dot',
  },
  assault: {
    ringVisible: false,
    crosshairColor: '#00e5ff',
    centerColor: '#00e5ff',
    centerShape: 'diamond',
  },
  sniper: {
    ringVisible: true,
    ringShape: 'circle',
    ringBorder: '4px solid #000',
    crosshairColor: '#000',
    centerColor: '#f00',
    centerShape: 'dot',
  },
  raygun: {
    ringVisible: true,
    ringShape: 'hexagon',
    ringBorder: '4px solid #00ff66',
    crosshairColor: '#00ff66',
    centerColor: '#00ff66',
    centerShape: 'dot',
  },
};

const DEFAULT_STYLE = RETICLE_STYLES.basic;
const HEXAGON_CLIP_PATH = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

const BAZOOKA_ID = 'bazooka';
const BAZOOKA_COLOR = '#e4503a';
const BAZOOKA_CORE_COLOR = '#c43a28';
const BRACKET_THICKNESS = 4;

function centerShapeStyle(style) {
  if (style.centerShape === 'diamond') {
    return `width:8px; height:8px; margin:-4px 0 0 -4px; background:${style.centerColor}; transform: rotate(45deg);`;
  }
  return `width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:${style.centerColor};`;
}

function crosshairHtml(style) {
  return `
    <div style="position:absolute; top:0; left:calc(50% - 1px); width:2px; height:38%; background:${style.crosshairColor};"></div>
    <div style="position:absolute; bottom:0; left:calc(50% - 1px); width:2px; height:38%; background:${style.crosshairColor};"></div>
    <div style="position:absolute; left:0; top:calc(50% - 1px); height:2px; width:38%; background:${style.crosshairColor};"></div>
    <div style="position:absolute; right:0; top:calc(50% - 1px); height:2px; width:38%; background:${style.crosshairColor};"></div>
    <div style="position:absolute; top:50%; left:50%; ${centerShapeStyle(style)}"></div>
  `;
}

// 판정에 쓰이는 정사각형(반경 radiusPx)을 그대로 그린다. 네 모서리 브래킷이
// 사각형의 경계이고, 그 안에 들어온 원숭이가 죽는다.
function bazookaReticleHtml(radiusPx) {
  const r = radiusPx;
  const arm = r * 0.42;
  const tickLength = r * 0.22;
  const tickOffset = r * 0.45;
  const outer = r * 0.16;
  const inner = r * 0.08;
  const t = BRACKET_THICKNESS;
  const bar = `position:absolute; background:${BAZOOKA_COLOR};`;

  const corners = [
    ['top:0; left:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['top:0; right:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['bottom:0; left:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['bottom:0; right:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
  ]
    .map(([anchor, horizontal, vertical]) =>
      `<div style="${bar} ${anchor} ${horizontal}"></div><div style="${bar} ${anchor} ${vertical}"></div>`
    )
    .join('');

  const ticks = [
    `${bar} left:${r - t / 2}px; top:${r - tickOffset - tickLength}px; width:${t}px; height:${tickLength}px;`,
    `${bar} left:${r - t / 2}px; top:${r + tickOffset}px; width:${t}px; height:${tickLength}px;`,
    `${bar} top:${r - t / 2}px; left:${r - tickOffset - tickLength}px; height:${t}px; width:${tickLength}px;`,
    `${bar} top:${r - t / 2}px; left:${r + tickOffset}px; height:${t}px; width:${tickLength}px;`,
  ]
    .map((style) => `<div style="${style}"></div>`)
    .join('');

  const core = `
    <div style="position:absolute; left:${r - outer}px; top:${r - outer}px; width:${outer * 2}px; height:${outer * 2}px; border-radius:50%; background:${BAZOOKA_COLOR};"></div>
    <div style="position:absolute; left:${r - inner}px; top:${r - inner}px; width:${inner * 2}px; height:${inner * 2}px; border-radius:50%; background:${BAZOOKA_CORE_COLOR};"></div>
  `;

  return corners + ticks + core;
}

export function createScopeOverlay(container) {
  const ring = document.createElement('div');
  ring.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; box-sizing: border-box;
    pointer-events: none; display: none; z-index: 12;
  `;
  container.appendChild(ring);

  const reticle = document.createElement('div');
  reticle.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; pointer-events: none; display: none; z-index: 13;
  `;
  container.appendChild(reticle);

  let currentKey = null;

  function applyBazooka(radiusPx) {
    ring.style.border = 'none';
    ring.style.clipPath = 'none';
    reticle.style.width = `${radiusPx * 2}px`;
    reticle.style.height = `${radiusPx * 2}px`;
    reticle.innerHTML = bazookaReticleHtml(radiusPx);
  }

  function applyStandard(style) {
    ring.style.border = style.ringBorder ?? 'none';
    ring.style.borderRadius = style.ringShape === 'hexagon' ? '0' : '50%';
    ring.style.clipPath = style.ringShape === 'hexagon' ? HEXAGON_CLIP_PATH : 'none';
    reticle.style.width = '70vmin';
    reticle.style.height = '70vmin';
    reticle.innerHTML = crosshairHtml(style);
  }

  function show(weaponId, blastRadiusPx = 0) {
    const isBazooka = weaponId === BAZOOKA_ID;
    // 창 크기가 바뀌면 반경도 바뀌므로 캐시 키에 포함한다.
    const key = isBazooka ? `${weaponId}:${blastRadiusPx}` : weaponId;

    if (key !== currentKey) {
      currentKey = key;
      if (isBazooka) {
        applyBazooka(blastRadiusPx);
      } else {
        applyStandard(RETICLE_STYLES[weaponId] ?? DEFAULT_STYLE);
      }
    }

    ring.style.display = !isBazooka && (RETICLE_STYLES[weaponId] ?? DEFAULT_STYLE).ringVisible
      ? 'block'
      : 'none';
    reticle.style.display = 'block';
  }

  function hide() {
    ring.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 3: 호출부에 반경을 넘긴다**

`game/src/gameplay/game.js` 상단 import 목록(`import { CONFIG } from '../config.js';` 바로 위)에 추가한다:

```js
import { computeBlastRadiusPx } from './screenTargeting.js';
```

`game.js:520`의 `scopeOverlay.show(getActiveWeaponId());` 를 다음으로 바꾼다:

```js
        scopeOverlay.show(
          getActiveWeaponId(),
          computeBlastRadiusPx(container.clientHeight, CONFIG.bazooka.blastScreenRatio)
        );
```

- [ ] **Step 4: 회귀가 없는지 확인한다**

```bash
npm test
```

Expected: 모든 테스트 통과 (이 태스크는 DOM 코드라 단위 테스트가 없다. 모양은 사용자가 브라우저에서 확인한다.)

- [ ] **Step 5: Commit**

```bash
git add game/src/ui/scopeOverlay.js game/src/config.js game/src/gameplay/game.js
git commit -m "feat: draw the bazooka reticle as a corner-bracket blast box"
```

---

### Task 5: 발사 흐름 연결

마지막 통합. 이 태스크가 끝나야 실제로 플레이 가능해진다.

**Files:**
- Modify: `game/src/gameplay/targetManager.js:101-118`
- Modify: `game/src/gameplay/game.js`
- Modify: `game/src/config.js`

**Interfaces:**
- Consumes: `findMonkeysInScreenBox`, `computeBlastRadiusPx` (Task 1), `createBazookaProjectiles` (Task 2), `effects.spawnExplosion`, `sfx.explosion` (Task 3)
- Produces: `targetManager.getMonkeys() -> Monkey[]`

- [ ] **Step 1: targetManager에 getMonkeys를 추가하고 낡은 함수를 지운다**

`game/src/gameplay/targetManager.js`에서 `findMonkeysWithinRadius` 함수 정의(101-106행)를 통째로 삭제하고, 그 자리에 다음을 넣는다:

```js
  function getMonkeys() {
    return monkeys;
  }
```

이어지는 `return { ... }` 블록에서 `findMonkeysWithinRadius,` 를 `getMonkeys,` 로 바꾼다.

- [ ] **Step 2: game.js를 연결한다**

`game/src/gameplay/game.js` 상단, Task 4에서 넣은 import를 다음으로 확장한다:

```js
import { computeBlastRadiusPx, findMonkeysInScreenBox } from './screenTargeting.js';
import { createBazookaProjectiles } from './bazookaProjectile.js';
```

`const lastKillEffect = createLastKillEffect();` 바로 다음 줄에 추가한다:

```js
  const projectiles = createBazookaProjectiles(engine.scene);
```

`startGame()`의 `scoreState = createScoreState();` 바로 앞에 추가한다:

```js
    projectiles.clear();
```

`endGame()`의 `targetManager.clear();` 바로 다음에 추가한다:

```js
    projectiles.clear();
```

`handleBazookaShot` 함수 전체(429-470행)를 다음으로 교체한다:

```js
  function resolveBazookaImpact({ impactPoint, captured, hitTowerIndex }) {
    effects.spawnExplosion(impactPoint);
    sfx.explosion();

    // 포탄이 날아가는 동안 라운드가 끝났거나 게임오버가 됐으면 연출만 남긴다.
    if (phase !== 'playing') return;

    if (hitTowerIndex !== null) {
      applyTowerCollapse(hitTowerIndex);
    }

    const killedHits = [];
    let popupWorldPosition = null;
    for (const monkey of captured) {
      if (!monkey.kill()) continue;
      const worldPos = monkey.getWorldPosition();
      if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
      effects.spawnHitBurst(worldPos, 0xff6600);
      killedHits.push({ monkeyId: monkey.id, part: 'body' });
    }

    const effectiveOutcome = {
      isMiss: killedHits.length === 0 && hitTowerIndex === null,
      penetrationCount: killedHits.length,
      hits: killedHits,
    };
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    finishShot({
      effectiveOutcome,
      gained,
      popupWorldPosition,
      isPureTowerHit: hitTowerIndex !== null,
    });
  }

  function handleBazookaShot(intersections) {
    const first = intersections[0];
    const hitTowerIndex = first && first.object.userData.towerIndex !== undefined
      ? first.object.userData.towerIndex
      : null;

    // 아무것도 안 맞아도 포탄은 날아간다. 원숭이 대열 부근(maxRange)에서 터진다.
    const impactPoint = first
      ? first.point.clone()
      : raycaster.ray.at(CONFIG.bazooka.maxRange, new THREE.Vector3());

    // 대상은 쏜 순간에 확정한다. 비행 중 조준을 움직여도 결과가 바뀌지 않는다.
    const captured = findMonkeysInScreenBox(
      targetManager.getMonkeys(),
      engine.camera,
      container.getBoundingClientRect(),
      computeBlastRadiusPx(container.clientHeight, CONFIG.bazooka.blastScreenRatio)
    );

    if (bazookaStore.consumeRound() === 0) {
      swapWeaponViewmodel(getEquippedWeapon()).catch(() => {});
    }

    const muzzle = raycaster.ray.origin
      .clone()
      .addScaledVector(raycaster.ray.direction, 2)
      .add(new THREE.Vector3(0.5, -0.4, 0).applyQuaternion(engine.camera.quaternion));

    projectiles.spawn(muzzle, impactPoint, CONFIG.bazooka.flightSeconds, () => {
      resolveBazookaImpact({ impactPoint, captured, hitTowerIndex });
    });
  }
```

게임 루프(`engine.start` 콜백) 안에서 `effects.update(scaledDt);` 바로 다음에 추가한다:

```js
      projectiles.update(scaledDt);
```

같은 루프의 라운드 전환 조건을 바꾼다. 현재 `if (targetManager.allCleared()) {` 인 줄을 다음으로 교체한다:

```js
        if (targetManager.allCleared() && !projectiles.hasPending()) {
```

- [ ] **Step 3: config에서 낡은 값을 지운다**

`game/src/config.js`의 `bazooka` 블록에서 `blastRadius: 6,` 줄을 삭제한다. 이제 아무도 쓰지 않는다.

- [ ] **Step 4: 죽은 참조가 없는지 확인하고 테스트한다**

```bash
grep -rn "blastRadius\|findMonkeysWithinRadius" game/src test
```

Expected: 출력 없음 (`blastScreenRatio`는 이름이 달라 걸리지 않는다)

```bash
npm test
```

Expected: 모든 테스트 통과

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/game.js game/src/gameplay/targetManager.js game/src/config.js
git commit -m "feat: fire bazooka rounds as projectiles with screen-space blast"
```

---

## 구현 후 사용자 확인

이 세션의 브라우저 프리뷰는 rAF가 돌지 않아(pane 미표시) 자동 시각 검증이 불가능하다. 구현이 끝나면 사용자가 직접 확인한다.

dev 서버는 `--host`로 떠 있으므로 같은 네트워크의 다른 기기에서도 접속 가능하다.

바주카포를 바로 얻으려면 브라우저 콘솔에서:

```js
localStorage.setItem('shootshoot.bazooka','5'); location.reload()
```

확인할 것:

1. 허공(하늘, 아무것도 없는 곳)을 조준하고 쏴도 포탄이 날아가 폭발하는가
2. 브래킷 사각형 안에 있던 원숭이가 전부 죽는가 — 특히 **뒷줄 원숭이**와 **모서리 근처 원숭이**
3. 레티클이 참고 이미지처럼 보이는가 (코너 브래킷 4개 + 안쪽 눈금 4개 + 중앙 원)
4. 5발 다 쓰면 원래 무기로 돌아오는가
5. 마지막 원숭이를 잡았을 때 포탄이 착탄하기 전에 다음 라운드로 넘어가지 않는가

튜닝 지점 (전부 `game/src/config.js`의 `CONFIG.bazooka`):
- 범위가 좁거나 넓다 → `blastScreenRatio` (현재 0.25)
- 포탄이 느리거나 안 보인다 → `flightSeconds` (현재 0.3)
- 폭발이 너무 앞/뒤에서 난다 → `maxRange` (현재 85)
