# 하늘 배경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구름, 먼 섬 실루엣, 지나가는 새로 하늘을 채운다. 사격에는 영향을 주지 않는다.

**Architecture:** 움직임 계산은 순수 함수 모듈(`skyMotion.js`)로 떼어 테스트하고, three.js 메시 조립과 매 프레임 갱신은 `skyDecor.js` 하나가 맡는다. `game.js` 는 만들고 매 프레임 `update(scaledDt)` 를 부르기만 한다. 배경 메시는 레이캐스트 배열에 넣지 않으므로 사격 판정에 걸리지 않는다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), three.js 0.166.

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 136개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- 배경 메시는 **레이캐스트 대상이 아니다.** `getRaycastMeshes` 류 배열에 넣지 않는다.
- 구름은 `z = -130` 보다 가까이 오지 않는다. 섬이 `z = -80` 이라 그 뒤에만 두면 사격선을 가리지 않는다.
- 그림자를 켜지 않는다. `castShadow` / `receiveShadow` 를 배경 메시에 설정하지 않는다.
- 배치 난수는 고정 시드다. 판마다 하늘이 달라지면 육안 회귀 확인이 불가능하다.
- 외부 텍스처·모델 에셋을 추가하지 않는다. 전부 코드에서 만드는 로우폴리 메시다.
- 재질은 종류당 하나를 만들어 공유한다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- `game/src/gameplay/world.js` 가 `scene.background`(`0x87ceeb`), `scene.fog`(`Fog(0x87ceeb, 80, 320)`), 조명, 섬, 용골을 만든다. 이 파일은 **건드리지 않는다.**
- 섬 중심 `z = -80`, 폭 26, 깊이 40, 윗면 `y = -1.0`.
- 카메라는 `y = 1.6`, `z = 0` 고정이고 `far = 800` 이다. 월드 좌표가 곧 화면 배치다.
- 프레임 루프는 `game.js` 의 `engine.start((dt) => { ... })` 하나뿐이다. 그 안에서 `const scaledDt = dt * lastKillEffect.getTimeScale();` 가 마지막 처치 슬로모를 반영한 델타다.
- `createGame` 안에서 `createWorld(engine.scene);` 이 다른 생성자들보다 먼저 불린다.
- 레이캐스트 대상은 `handleShot` 이 배열로 명시해 모은다. 씬에 메시를 더해도 그 배열에 안 넣으면 판정에 안 걸린다.

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/skyMotion.js` | 순수 함수. 드리프트 랩어라운드, 비행 진행도, 시드 난수 |
| `test/skyMotion.test.js` | 위 모듈 테스트 |
| `game/src/gameplay/skyDecor.js` | 배경 메시 생성과 매 프레임 갱신 |

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/gameplay/game.js` | `createSkyDecor` 생성과 프레임 루프 배선 |

**건드리지 않는 파일**

`world.js`, `targetManager.js`, `obstacles.js`, `weaponViewmodel.js`, `engine.js`, `config.js`.

---

### Task 1: 하늘 움직임 순수 함수

배경이 움직이는 데 필요한 계산만 떼어낸다. three.js 가 안 들어가므로 vitest 의 node 환경에서 그대로 돈다.

**Files:**
- Create: `game/src/gameplay/skyMotion.js`
- Create: `test/skyMotion.test.js`

**Interfaces:**
- Consumes: 없음
- Produces (Task 2, 3 이 쓴다):
  - `driftWrapped(x: number, dx: number, minX: number, maxX: number) -> number`
  - `flightProgress(t: number, dt: number, durationSeconds: number) -> number`
  - `createSeededRandom(seed: number) -> () => number`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/skyMotion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { driftWrapped, flightProgress, createSeededRandom } from '../game/src/gameplay/skyMotion.js';

describe('driftWrapped', () => {
  it('moves by the delta while inside the range', () => {
    expect(driftWrapped(0, 1.2, -170, 170)).toBeCloseTo(1.2);
  });

  it('wraps to the near edge after passing the far edge', () => {
    expect(driftWrapped(169, 2, -170, 170)).toBeCloseTo(-169);
  });

  it('wraps to the far edge when drifting backwards', () => {
    expect(driftWrapped(-169, -2, -170, 170)).toBeCloseTo(169);
  });

  it('stays inside the range after a delta wider than the range', () => {
    const x = driftWrapped(0, 1000, -170, 170);
    expect(x).toBeGreaterThanOrEqual(-170);
    expect(x).toBeLessThan(170);
  });
});

describe('flightProgress', () => {
  it('advances by the fraction of the duration', () => {
    expect(flightProgress(0, 6, 24)).toBeCloseTo(0.25);
  });

  it('wraps past one without losing the overshoot', () => {
    expect(flightProgress(0.9, 6, 24)).toBeCloseTo(0.15);
  });

  it('returns 0 for a zero duration rather than dividing by it', () => {
    expect(flightProgress(0.5, 1, 0)).toBe(0);
  });
});

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    const first = [a(), a(), a(), a(), a()];
    const second = [b(), b(), b(), b(), b()];
    expect(first).toEqual(second);
  });

  it('produces numbers in [0, 1)', () => {
    const random = createSeededRandom(20260729);
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/skyMotion.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/skyMotion.js"`

- [ ] **Step 3: 구현**

Create `game/src/gameplay/skyMotion.js`:

```js
// 하늘 장식이 움직이는 데 필요한 계산만 모아 둔다. three.js 가 없으므로
// 프레임 루프 밖에서 그대로 테스트된다.

// x 를 dx 만큼 밀되 범위를 벗어나면 반대쪽 끝으로 넘긴다. 한 프레임이 아무리
// 길어도 범위 안에 떨어지도록 조건문 대신 나머지 연산을 쓴다.
export function driftWrapped(x, dx, minX, maxX) {
  const span = maxX - minX;
  const offset = x + dx - minX;
  return minX + ((offset % span) + span) % span;
}

// 0 에서 1 사이를 도는 진행도. 1 을 넘으면 넘어간 만큼을 남긴다 — 0 으로 대입하면
// 프레임마다 남는 조각이 버려져 무리가 조금씩 앞당겨진다.
export function flightProgress(t, dt, durationSeconds) {
  if (durationSeconds <= 0) return 0;
  return (t + dt / durationSeconds) % 1;
}

// 판마다 하늘 배치가 달라지면 육안으로 회귀를 잡을 수 없다. 고정 시드에서
// 같은 수열을 내는 LCG 하나면 배치용으로 충분하다.
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/skyMotion.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: 전체 테스트**

Run: `npm test`
Expected: 145 tests passed (136 + 9)

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/skyMotion.js test/skyMotion.test.js
git commit -m "feat: add the sky motion helpers

The background lives in three.js where no test reaches it, so the parts
that are arithmetic come out into their own module.

driftWrapped uses a modulo rather than a bounds check because a long
frame can carry a cloud further than the range is wide. flightProgress
keeps the overshoot for the same reason — assigning zero would drop a
sliver of time every lap and creep the flock forward.

The placement random is seeded so the sky is identical every run;
otherwise nothing about it could be checked by eye twice."
```

---

### Task 2: 구름과 먼 섬

`skyDecor.js` 를 만들고 구름과 먼 섬을 넣는다. 새는 Task 3 에서 같은 파일에 더한다. 이 태스크가 끝나면 게임에서 눈으로 확인할 수 있다.

**Files:**
- Create: `game/src/gameplay/skyDecor.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `driftWrapped(x, dx, minX, maxX) -> number`, `createSeededRandom(seed) -> () => number`
- Produces: `createSkyDecor(scene) -> { update(dt), dispose() }` — Task 3 이 같은 객체에 새를 더한다

- [ ] **Step 1: `skyDecor.js` 작성**

Create `game/src/gameplay/skyDecor.js`:

```js
import * as THREE from 'three';
import { driftWrapped, createSeededRandom } from './skyMotion.js';

// 섬이 z = -80 이다. 구름을 항상 그보다 뒤에 두면 조준해서 화각이 좁아져도
// 표적을 가리지 않는다.
const CLOUD_Z_NEAR = -130;
const CLOUD_Z_FAR = -300;
const CLOUD_COUNT = 14;
const CLOUD_X_LIMIT = 170;
const CLOUD_Y_MIN = -25;
const CLOUD_Y_MAX = 35;
const CLOUD_DRIFT_SPEED = 0.6;
const CLOUD_PUFF_MIN = 4;
const CLOUD_PUFF_MAX = 6;

// fog 가 320에서 끝나므로 이보다 멀면 하늘색에 잠겨 실루엣만 남는다.
const DISTANT_ISLAND_COUNT = 5;
const DISTANT_ISLAND_Z_NEAR = -250;
const DISTANT_ISLAND_Z_FAR = -400;

// 배치가 판마다 바뀌면 육안 확인이 무의미해진다.
const SKY_SEED = 20260729;

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

// 구 몇 개를 겹쳐 한 덩이로 만든다. 가로로 늘어놓고 서로 반쯤 파묻어야
// 낱개 구로 안 보인다.
function buildCloud(random, material) {
  const cloud = new THREE.Group();
  const puffCount = Math.round(randomBetween(random, CLOUD_PUFF_MIN, CLOUD_PUFF_MAX));
  const scale = randomBetween(random, 6, 14);
  for (let i = 0; i < puffCount; i += 1) {
    const radius = scale * randomBetween(random, 0.5, 1);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 7, 5), material);
    puff.position.set(
      (i - (puffCount - 1) / 2) * scale * 0.7,
      randomBetween(random, -0.2, 0.2) * scale,
      randomBetween(random, -0.3, 0.3) * scale
    );
    cloud.add(puff);
  }
  return cloud;
}

// 지금 섬과 같은 모양(윗면 + 아래로 뻗은 용골)이되 훨씬 크게 잡는다. 같은
// 크기로 두면 그 거리에서 점으로 사라진다.
function buildDistantIsland(random, topMaterial, keelMaterial) {
  const island = new THREE.Group();
  const width = randomBetween(random, 40, 90);
  const depth = width * randomBetween(random, 0.5, 0.9);
  const thickness = randomBetween(random, 6, 12);
  const keelHeight = width * 0.8;

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), topMaterial);
  island.add(top);

  const keel = new THREE.Mesh(new THREE.ConeGeometry(width * 0.45, keelHeight, 6), keelMaterial);
  keel.rotation.x = Math.PI;
  keel.position.y = -thickness / 2 - keelHeight / 2;
  island.add(keel);

  return island;
}

export function createSkyDecor(scene) {
  const random = createSeededRandom(SKY_SEED);
  const root = new THREE.Group();
  scene.add(root);

  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f6fa });
  const islandTopMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4f3a });
  const islandKeelMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4230 });

  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const cloud = buildCloud(random, cloudMaterial);
    cloud.position.set(
      randomBetween(random, -CLOUD_X_LIMIT, CLOUD_X_LIMIT),
      randomBetween(random, CLOUD_Y_MIN, CLOUD_Y_MAX),
      randomBetween(random, CLOUD_Z_FAR, CLOUD_Z_NEAR)
    );
    root.add(cloud);
    clouds.push(cloud);
  }

  for (let i = 0; i < DISTANT_ISLAND_COUNT; i += 1) {
    const island = buildDistantIsland(random, islandTopMaterial, islandKeelMaterial);
    island.position.set(
      randomBetween(random, -220, 220),
      randomBetween(random, -30, 10),
      randomBetween(random, DISTANT_ISLAND_Z_FAR, DISTANT_ISLAND_Z_NEAR)
    );
    island.rotation.y = randomBetween(random, -0.6, 0.6);
    root.add(island);
  }

  return {
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x = driftWrapped(
          cloud.position.x,
          CLOUD_DRIFT_SPEED * dt,
          -CLOUD_X_LIMIT,
          CLOUD_X_LIMIT
        );
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((child) => {
        if (child.isMesh) child.geometry.dispose();
      });
      cloudMaterial.dispose();
      islandTopMaterial.dispose();
      islandKeelMaterial.dispose();
    },
  };
}
```

- [ ] **Step 2: `game.js` 에 import 추가**

`game/src/gameplay/game.js` 의 import 묶음, `import { createReloadState } from './reloadState.js';` 아래에 넣는다:

```js
import { createSkyDecor } from './skyDecor.js';
```

- [ ] **Step 3: 생성**

`createGame` 안, `createWorld(engine.scene);` 바로 아래에 넣는다. 월드가 fog 와 조명을 먼저 세워야 한다:

```js
  const skyDecor = createSkyDecor(engine.scene);
```

- [ ] **Step 4: 프레임 루프 배선**

프레임 루프 안, `const scaledDt = dt * lastKillEffect.getTimeScale();` 바로 아래에 넣는다:

```js
      // 슬로모가 걸리면 하늘도 같이 느려져야 한다. 배경만 제 속도로 흐르면
      // 마지막 처치 연출이 깨져 보인다.
      skyDecor.update(scaledDt);
```

- [ ] **Step 5: 테스트와 빌드**

Run: `npm test`
Expected: 145 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 배경이 레이캐스트에 안 들어갔는지 확인**

Run: `grep -n "skyDecor" game/src/gameplay/game.js`
Expected: 세 줄만 나온다 — import, 생성, `update`. `raycastTargets` 근처에는 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
git add game/src/gameplay/skyDecor.js game/src/gameplay/game.js
git commit -m "feat: fill the sky with clouds and distant islands

The sky was one flat colour with a single island in it, so nothing gave
the scene a sense of height or distance.

Clouds are capped at z = -130, always behind the island at z = -80, so
they never cross the firing line even at the narrow aiming FOV. Nothing
here is added to the raycast array, so none of it can be shot.

The distant islands are far past the fog end at 320, which is what turns
them into silhouettes without needing a second material set. They are
built much larger than the real island because at that range a matching
size would vanish.

Motion runs on the scaled delta so the last-kill slow motion carries the
sky with it."
```

---

### Task 3: 새 무리

같은 `skyDecor.js` 에 새를 더한다. 장식이므로 레이캐스트에 넣지 않는다.

**Files:**
- Modify: `game/src/gameplay/skyDecor.js`

**Interfaces:**
- Consumes: Task 1 의 `flightProgress(t, dt, durationSeconds) -> number`
- Produces: 없음 (`createSkyDecor` 의 반환 형태는 그대로 `{ update(dt), dispose() }`)

- [ ] **Step 1: import 에 `flightProgress` 추가**

기존:
```js
import { driftWrapped, createSeededRandom } from './skyMotion.js';
```
변경 후:
```js
import { driftWrapped, flightProgress, createSeededRandom } from './skyMotion.js';
```

- [ ] **Step 2: 새 상수 추가**

`SKY_SEED` 선언 **위**, `DISTANT_ISLAND_Z_FAR` 아래에 넣는다:

```js
const BIRD_COUNT = 5;
const BIRD_FLIGHT_SECONDS = 24;
const BIRD_X_SPAN = 180;
const BIRD_Z = -150;
const BIRD_Y_MIN = 22;
const BIRD_Y_MAX = 38;
const BIRD_WING_SPAN = 1.2;
const BIRD_WING_CHORD = 0.6;
const BIRD_FLAP_HZ = 3;
const BIRD_FLAP_ANGLE = 0.5;
```

- [ ] **Step 3: 새 지오메트리 빌더 추가**

`buildDistantIsland` 아래, `createSkyDecor` 위에 넣는다:

```js
// 삼각형 한 장이 날개 하나다. 뿌리를 원점에 두어야 rotation.z 로 접었다 펼 수
// 있으므로 정점을 그렇게 잡는다.
function buildWingGeometry(mirrored) {
  const tipX = mirrored ? -BIRD_WING_SPAN : BIRD_WING_SPAN;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0, -BIRD_WING_CHORD / 2, 0, 0, BIRD_WING_CHORD / 2, tipX, 0, 0],
      3
    )
  );
  return geometry;
}

function buildBird(material) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(buildWingGeometry(false), material);
  const right = new THREE.Mesh(buildWingGeometry(true), material);
  group.add(left);
  group.add(right);
  return { group, left, right };
}
```

- [ ] **Step 4: 무리 만들기**

`createSkyDecor` 안, 먼 섬 루프 아래이자 `return {` 위에 넣는다:

```js
  // 조명 계산 없이 어두운 실루엣이면 된다. 양면으로 두지 않으면 지나가는
  // 방향에 따라 날개 한쪽이 사라진다.
  const birdMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b4451,
    side: THREE.DoubleSide,
  });

  const birds = [];
  for (let i = 0; i < BIRD_COUNT; i += 1) {
    const bird = buildBird(birdMaterial);
    // 가운데를 0 으로 두고 양옆으로 벌어진다. 뒤로 물러난 거리를 좌우 거리에
    // 비례시키면 V 대형이 된다.
    const lateral = i - (BIRD_COUNT - 1) / 2;
    bird.offsetX = -Math.abs(lateral) * 2.5;
    bird.offsetY = randomBetween(random, BIRD_Y_MIN, BIRD_Y_MAX);
    bird.offsetZ = lateral * 2.5;
    // 날갯짓을 조금씩 어긋나게 해야 한 몸처럼 안 보인다.
    bird.flapPhase = randomBetween(random, 0, Math.PI * 2);
    bird.group.position.set(0, bird.offsetY, BIRD_Z + bird.offsetZ);
    root.add(bird.group);
    birds.push(bird);
  }

  let flightT = 0;
  let flapPhase = 0;
```

- [ ] **Step 5: `update` 에 새 갱신 추가**

기존:
```js
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x = driftWrapped(
          cloud.position.x,
          CLOUD_DRIFT_SPEED * dt,
          -CLOUD_X_LIMIT,
          CLOUD_X_LIMIT
        );
      }
    },
```
변경 후:
```js
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x = driftWrapped(
          cloud.position.x,
          CLOUD_DRIFT_SPEED * dt,
          -CLOUD_X_LIMIT,
          CLOUD_X_LIMIT
        );
      }

      flightT = flightProgress(flightT, dt, BIRD_FLIGHT_SECONDS);
      flapPhase += dt * BIRD_FLAP_HZ * Math.PI * 2;
      const leadX = -BIRD_X_SPAN + flightT * BIRD_X_SPAN * 2;
      for (const bird of birds) {
        bird.group.position.x = leadX + bird.offsetX;
        const flap = Math.sin(flapPhase + bird.flapPhase) * BIRD_FLAP_ANGLE;
        bird.left.rotation.z = flap;
        bird.right.rotation.z = -flap;
      }
    },
```

- [ ] **Step 6: `dispose` 에 새 재질 추가**

기존:
```js
      islandKeelMaterial.dispose();
```
변경 후:
```js
      islandKeelMaterial.dispose();
      birdMaterial.dispose();
```

지오메트리는 `root.traverse` 가 이미 처리한다 — 새 날개도 `root` 아래에 있다.

- [ ] **Step 7: 테스트와 빌드**

Run: `npm test`
Expected: 145 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 8: 커밋**

```bash
git add game/src/gameplay/skyDecor.js
git commit -m "feat: send a flock of birds across the sky

Clouds drift but nothing in the scene moves under its own power, which
reads as a still photograph once you watch it for a while.

Each bird is two triangles rooted at the origin so the wings fold on
rotation.z. The material is basic and double sided — these are meant to
be silhouettes, and a single sided wing disappears depending on which
way the flock is heading.

They are decoration only and stay out of the raycast array, so aiming at
one does nothing."
```

- [ ] **Step 9: 사용자 육안 확인 요청**

이 세션 환경에서는 브라우저 스크린샷이 실패한다. 다음을 사용자에게 확인해 달라고 요청한다 (직접 브라우저를 열려고 하지 말 것):

1. 섬 뒤로 구름이 보이고 천천히 옆으로 흐르는가
2. 구름이 원숭이를 가리지 않는가 — 조준했을 때도
3. 지평선에 먼 섬 실루엣이 흐리게 보이는가
4. 새 무리가 하늘 위쪽을 가로지르고, 다 지나가면 다시 나타나는가
5. 새를 조준해서 쏴도 아무 일도 안 일어나는가
6. 마지막 처치 슬로모가 걸릴 때 구름과 새도 같이 느려지는가
7. 프레임이 눈에 띄게 떨어지지 않는가

개발 서버는 `preview_start` 로 띄우고, 포트 5173은 다른 프로젝트가 잡고 있으므로 주소는 `http://127.0.0.1:5174/` 다.
