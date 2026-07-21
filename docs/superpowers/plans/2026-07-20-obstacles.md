# 엄폐 장애물 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사격장에 실제로 사선을 막는 정적 장애물(나무 상자, 모래주머니 참호벽)을 고정 배치하고, 총알이 장애물을 관통하지 못하게(원숭이는 관통 가능) 레이캐스트 규칙을 추가한다.

**Architecture:** 새 모듈 `game/src/gameplay/obstacles.js`가 두 GLB 에셋(`crate.glb`, `sack-trench.glb`)을 각각 한 번 로드한 뒤, 고정된 좌표 목록을 따라 `.clone()`으로 여러 인스턴스를 만들어 씬에 배치한다(원숭이와 달리 스켈레톤이 없는 정적 메쉬라 일반 `Object3D.clone()`으로 충분하고, 지오메트리/재질은 인스턴스끼리 공유해도 무방하다 — `rifleViewmodel.js`의 `GLTFLoader` 로딩 패턴을 그대로 따른다). `game.js`는 부트스트랩 시 이 모듈을 병렬 로드하고, `handleShot`의 레이캐스트 대상에 원숭이 메쉬와 장애물 메쉬를 합친 뒤, 가까운 순서로 순회하면서 원숭이는 계속 관통하고 장애물을 만나면 순회를 멈추도록 로직을 수정한다.

**Tech Stack:** Three.js `GLTFLoader` (이미 프로젝트에 사용 중인 로더, 신규 의존성 없음), Vanilla JS ES 모듈.

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 원숭이가 장애물 뒤에서 숨었다 나왔다 하는 동적 행동은 만들지 않음 — 고정 배치.
- 라운드마다 장애물 배치가 바뀌지 않음 — 게임 내내 같은 배치, `targetManager.clear()`/`spawnRound()`와 무관하게 유지.
- 장애물 자체를 파괴하거나 피격 반응을 주는 기능은 만들지 않음 — 장애물은 명중 판정(차단)에만 관여하고, 점수/이펙트/사운드를 내지 않음.
- 기존 `resolveShot`(관통 히트 해석, `game/src/gameplay/shooting.js`)은 수정하지 않는다 — `handleShot`이 `resolveShot`에 넘기는 히트 목록을 만드는 단계에서만 장애물 차단을 반영한다.

---

### Task 1: `obstacles.js` 모듈 + 에셋 정리

**Files:**
- Move: `game/public/Crate by Quaternius - 3OEFd1AWfa.glb` → `game/public/models/crate.glb`
- Move: `game/public/Sack Trench by Quaternius - LW3jwpPfiN.glb` → `game/public/models/sack-trench.glb`
- Create: `game/src/gameplay/obstacles.js`

**Interfaces:**
- Produces: `loadObstacles(scene: THREE.Scene) -> Promise<{ getBlockingMeshes(): THREE.Mesh[] }>` — Task 2가 이 시그니처로 소비한다.

**배경 (직접 GLB를 로드해 측정한 실제 수치 — 추측이 아님):**
- `crate.glb`: 메쉬 2개(`Crate_1`, `Crate_2`), 원본 바운딩박스 0.1602×0.1602×0.1602(정육면체), 바운딩박스 최소 y ≈ -0.002(원점이 바닥 근처) → 스케일만 곱하면 바로 땅에 붙는다.
- `sack-trench.glb`: 메쉬 1개(`SackTrench`), 원본 바운딩박스 3.1619(폭,x)×1.1941(높이,y)×0.7751(깊이,z), 바운딩박스 최소 y ≈ -0.0112(마찬가지로 원점이 바닥 근처).
- 씬의 기존 좌표 기준: 카메라는 `(0, 1.6, 0)`(`game/src/core/engine.js:6`), 원숭이는 `y: -1.0`에 스폰(`game/src/gameplay/targetManager.js`의 `computeSpawnPosition`), 플랫폼은 `y: -1.5`(높이 1짜리 박스라 윗면이 y=-1.0으로 원숭이 발 높이와 일치, `game/src/gameplay/world.js`). 플랫폼은 `z: -14`~`-18`에 위치. 장애물은 카메라(z=0)와 플랫폼 사이인 `z: -7`~`-10` 구간에 배치해 일부 원숭이의 사선을 가린다.

- [ ] **Step 1: 에셋을 `game/public/models/`로 이동하고 git에 추가**

```bash
git mv "game/public/Crate by Quaternius - 3OEFd1AWfa.glb" "game/public/models/crate.glb"
git mv "game/public/Sack Trench by Quaternius - LW3jwpPfiN.glb" "game/public/models/sack-trench.glb"
```

(두 파일은 현재 git에 추적되지 않은(untracked) 상태이므로 `git mv`가 실패하면 대신 `mv`로 옮긴 뒤 `git add game/public/models/crate.glb game/public/models/sack-trench.glb`로 새 경로만 추가하고, 기존 루트의 파일이 여전히 untracked로 남아있지 않은지 `git status`로 확인한다.)

- [ ] **Step 2: `game/src/gameplay/obstacles.js` 작성**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CRATE_URL = '/models/crate.glb';
const SACK_TRENCH_URL = '/models/sack-trench.glb';
const CRATE_SCALE = 6;
const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;

const PLACEMENTS = [
  { type: 'sackTrench', x: -3, z: -9 },
  { type: 'sackTrench', x: 2.5, z: -10 },
  { type: 'crate', x: 0.5, z: -7.5 },
  { type: 'crate', x: -1.5, z: -8.5 },
];

export function loadObstacles(scene) {
  const loader = new GLTFLoader();
  return Promise.all([loader.loadAsync(CRATE_URL), loader.loadAsync(SACK_TRENCH_URL)]).then(
    ([crateGltf, sackTrenchGltf]) => {
      const blockingMeshes = [];

      for (const placement of PLACEMENTS) {
        const isCrate = placement.type === 'crate';
        const template = isCrate ? crateGltf.scene : sackTrenchGltf.scene;
        const scale = isCrate ? CRATE_SCALE : SACK_TRENCH_SCALE;

        const instance = template.clone();
        instance.scale.setScalar(scale);
        instance.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(instance);

        instance.traverse((object) => {
          if (object.isMesh) blockingMeshes.push(object);
        });
      }

      return {
        getBlockingMeshes() {
          return blockingMeshes;
        },
      };
    }
  );
}
```

- [ ] **Step 3: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. `dist/models/crate.glb`와 `dist/models/sack-trench.glb`가 번들에 포함됨(기존 `rifle.glb`와 같은 방식으로 `public/` 통과 복사). 이 모듈은 순수 로딩/배치 로직이라 Vitest 유닛 테스트 대상이 아니다(`monkeyModel.js`, `rifleViewmodel.js`와 동일한 검증 방식).

- [ ] **Step 4: Commit**

```bash
git add game/src/gameplay/obstacles.js game/public/models/crate.glb game/public/models/sack-trench.glb
git commit -m "feat: add obstacles.js module for static cover obstacles"
```

---

### Task 2: `game.js`에 장애물 로딩 + 레이캐스트 차단 연결

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `loadObstacles(scene) -> Promise<{ getBlockingMeshes() }>` (Task 1에서 생성)

- [ ] **Step 1: import 추가**

`game/src/gameplay/game.js` 최상단 import 목록에 추가 (기존 `import { loadRifleViewmodel } from './rifleViewmodel.js';` 다음 줄):

```js
import { loadObstacles } from './obstacles.js';
```

- [ ] **Step 2: 상태 변수 추가**

`createGame` 함수 내부, 기존 `let rifleViewmodel = null;` 다음 줄에 추가:

```js
  let obstacles = null;
```

- [ ] **Step 3: 부트스트랩 로딩에 병렬 추가**

`start()` 함수 맨 끝의 `Promise.all(...)` 블록을 다음과 같이 수정한다.

변경 전:
```js
    Promise.all([loadMonkeyModel(), loadRifleViewmodel(engine.camera)]).then(
      ([monkeyModel, resolvedRifleViewmodel]) => {
        targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
        rifleViewmodel = resolvedRifleViewmodel;
        screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
      }
    );
```

변경 후:
```js
    Promise.all([
      loadMonkeyModel(),
      loadRifleViewmodel(engine.camera),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedRifleViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
      rifleViewmodel = resolvedRifleViewmodel;
      obstacles = resolvedObstacles;
      screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
    });
```

(메뉴는 이 `.then()` 콜백 안에서만 표시되고, `phase`는 `startGame()`이 호출되어야만 `'playing'`으로 바뀌며, `startGame()`은 메뉴의 "시작하기" 버튼을 눌러야 호출된다 — 즉 `handleShot`이 실제로 동작할 수 있는 시점에는 `obstacles`가 항상 이미 로드되어 있다. 기존 `targetManager`/`rifleViewmodel`과 동일한 보장이므로 `handleShot`에 별도 null 체크를 추가할 필요는 없다.)

- [ ] **Step 4: `handleShot`의 레이캐스트 대상/차단 로직 수정**

`handleShot` 함수 내부의 레이캐스트~히트 목록 생성 부분을 다음과 같이 수정한다.

변경 전:
```js
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const intersections = raycaster.intersectObjects(targetManager.getRaycastMeshes(), false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      const monkey = targetManager.findMonkey(monkeyId);
      if (!monkey) continue;
      hits.push({ monkeyId, part: monkey.classifyHit(intersection.point) });
    }
```

변경 후:
```js
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const raycastTargets = [...targetManager.getRaycastMeshes(), ...obstacles.getBlockingMeshes()];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId } = intersection.object.userData;
      if (!monkeyId) break;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      const monkey = targetManager.findMonkey(monkeyId);
      if (!monkey) continue;
      hits.push({ monkeyId, part: monkey.classifyHit(intersection.point) });
    }
```

(`raycaster.intersectObjects`는 결과를 거리순으로 정렬해서 반환한다. 장애물 메쉬에는 `userData.monkeyId`가 설정되어 있지 않으므로 `!monkeyId`가 참이 되고, 그 지점에서 `break`하면 그보다 먼 원숭이는 이번 샷의 `hits`에 포함되지 않는다 — 원숭이는 계속 관통, 장애물은 차단이라는 스펙 3.2 규칙을 그대로 구현한다. 이 부분 이후의 `resolveShot(hits)` 호출과 그 이하 로직은 전혀 수정하지 않는다.)

- [ ] **Step 5: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 6: 브라우저에서 수동 확인**

Run: `npm run dev`, 게임 시작 → 카메라와 원숭이 사이에 상자/모래주머니 장애물이 보이는지 확인 → 장애물에 가려진 원숭이 몸통 부위를 조준했을 때 총알이 막혀 빗나가는지(장애물 앞에서 멈춤), 장애물 위로 드러난 부위(주로 머리)를 맞추면 정상적으로 명중하는지 확인. 장애물이 없는 각도의 원숭이는 기존처럼 정상 관통/명중하는지도 확인.

- [ ] **Step 7: Commit**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: load obstacles and block raycast shots on cover"
```

---

## Self-Review Notes

- **스펙 커버리지**: 에셋 정리(2절) → Task 1 Step 1. 모듈 인터페이스(3.3) → Task 1 Step 2. 레이캐스트 차단 규칙(3.2) → Task 2 Step 4. 고정 배치·게임 부트스트랩 로딩(3.1) → Task 1의 `PLACEMENTS` 상수 + Task 2 Step 3. 비목표(동적 숨기, 라운드별 재배치, 파괴/피격 반응 없음) → 장애물은 `Promise.all` 로딩 후 한 번만 배치되고 `targetManager.clear()`/`spawnRound()` 어디에도 관여하지 않으므로 자동으로 충족.
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `loadObstacles(scene) -> Promise<{ getBlockingMeshes() }>` — Task 1의 정의와 Task 2의 사용처(`obstacles.getBlockingMeshes()`)가 동일.
- **좌표/스케일 근거**: Task 1의 바운딩박스 수치는 실제로 두 GLB 파일을 Node.js에서 `GLTFLoader`로 로드해 측정한 값(추정이 아님). `CRATE_SCALE=6`(약 0.96m 정육면체), `SACK_TRENCH_SCALE=1`(스펙이 예측한 대로 원본 그대로 사용 가능한 높이)은 초기 추정치이며, 스펙의 "열린 위험"대로 실제 렌더링 후 눈으로 조정이 필요할 수 있음 — Task 2 Step 6의 수동 확인에서 "일부는 잘 보이고 일부는 가려지는" 밸런스가 아니라면, 배치 좌표(`PLACEMENTS`)나 스케일 상수를 조정하는 후속 수정이 있을 수 있다(이번 계획 범위에서는 최초 배치까지만 다룬다).
