# 바주카 폭발이 구조물도 파괴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바주카 조준 상자 안에 들어온 구조물(타워·모래주머니 참호)을 전부 파괴하고, 구조물 자체의 점수는 없애되 붕괴로 죽은 원숭이는 일반 사격과 같은 점수를 받게 한다.

**Architecture:** 원숭이 판정에 쓰던 화면 사각형 검사를 `isPointInScreenBox`로 한 겹 추출해 구조물에도 재사용한다. 참호를 타워와 같은 붕괴 상태 머신에 편입시킨다. 점수는 `applyTowerCollapse`가 직접 더하던 것을 죽은 원숭이 반환으로 바꿔 일반 점수 경로에 합류시킨다.

**Tech Stack:** Vanilla JS (ES modules), three.js 0.166, Vite 5, Vitest 1.6 (`environment: 'node'`)

**선행 설계:** [2026-07-27-bazooka-projectile-design.md](../specs/2026-07-27-bazooka-projectile-design.md) 의 "후속 확장 — 구조물도 폭발 범위에 포함" 절

## Global Constraints

- 테스트 환경은 **node**다. `obstacles.js`는 GLTF 파일을 로드하므로 단위 테스트가 불가능하다 — 순수 함수만 테스트한다.
- 기존 스타일: 팩토리 함수 `createXxx(...)`, 이름 있는 export, 세미콜론, 들여쓰기 2칸. 주석은 한국어로 꼭 필요한 곳에만.
- 실측 상수는 아래 값을 **그대로** 쓴다. 임의로 바꾸지 않는다.
  - 타워 중심 y (그룹 원점 기준 오프셋): `0.11`
  - 참호 중심 y (그룹 원점 기준 오프셋): `0.586`
  - 참호 그룹은 `GROUND_Y = -1.0`에, 타워 그룹은 `y = 0`에 있다
- **master 브랜치에 직접 커밋한다** (사용자가 명시적으로 선택, 워크트리 미사용).
- 커밋 메시지는 영어 한 줄 요약 + 필요시 한국어 본문, 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`.
- 전체 테스트: `npm test` — 현재 107개가 통과 중이며 줄어들면 안 된다.

---

## File Structure

| 파일 | 변경 |
|---|---|
| `game/src/gameplay/screenTargeting.js` | `isPointInScreenBox` 추출, `findMonkeysInScreenBox`가 이를 사용 |
| `game/src/gameplay/obstacles.js` | 참호를 파괴 가능하게, `findStructuresInBox`/`collapseStructure` 추가, `collapseTower` 제거 |
| `game/src/gameplay/game.js` | 바주카가 구조물 파괴, 타워 원숭이 점수 일반 경로화 |
| `game/src/config.js` | `score.towerCollapseBonus` 제거 |
| `test/screenTargeting.test.js` | `isPointInScreenBox` 테스트 추가 |

---

### Task 1: `isPointInScreenBox` 추출

구조물과 원숭이가 같은 판정을 공유하게 만드는 준비 작업. 순수 함수라 단독으로 만든다.

**Files:**
- Modify: `game/src/gameplay/screenTargeting.js`
- Modify: `test/screenTargeting.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `isPointInScreenBox(worldPoint: THREE.Vector3, camera, rect, radiusPx) -> boolean`
  - `rect`: `{ left, top, width, height }`
  - 카메라 뒤(투영 후 NDC z > 1)면 `false`
  - 상자 판정은 `Math.abs(x - centerX) <= radiusPx && Math.abs(y - centerY) <= radiusPx`
  - **주의:** `project()`는 벡터를 제자리에서 바꾼다. 호출자의 벡터를 오염시키지 않도록 내부에서 복제해야 한다. `findMonkeysInScreenBox`는 `getCenterWorldPosition()`이 매번 새 벡터를 주므로 지금까지 문제가 없었지만, 구조물은 미리 만들어 둔 중심 벡터를 재사용하므로 복제하지 않으면 두 번째 발사부터 좌표가 깨진다.

- [ ] **Step 1: Write the failing test**

`test/screenTargeting.test.js`의 `describe('findMonkeysInScreenBox', ...)` 블록 **앞에** 다음을 추가한다. import 줄에 `isPointInScreenBox`도 넣는다.

```js
describe('isPointInScreenBox', () => {
  it('accepts a point dead centre in the crosshair', () => {
    const point = new THREE.Vector3(0, 0, -80);
    expect(isPointInScreenBox(point, makeCamera(), RECT, 150)).toBe(true);
  });

  it('rejects a point far outside the box', () => {
    const point = new THREE.Vector3(40, 0, -80);
    expect(isPointInScreenBox(point, makeCamera(), RECT, 150)).toBe(false);
  });

  it('rejects a point behind the camera', () => {
    const point = new THREE.Vector3(0, 0, 80);
    expect(isPointInScreenBox(point, makeCamera(), RECT, 150)).toBe(false);
  });

  it('does not mutate the caller"s vector, so the same point can be tested repeatedly', () => {
    // 구조물은 중심 벡터를 미리 만들어 두고 발사할 때마다 재사용한다.
    // project()가 제자리에서 벡터를 바꾸면 두 번째 발사부터 좌표가 깨진다.
    const point = new THREE.Vector3(0, 0, -80);
    const camera = makeCamera();
    expect(isPointInScreenBox(point, camera, RECT, 150)).toBe(true);
    expect(point.toArray()).toEqual([0, 0, -80]);
    expect(isPointInScreenBox(point, camera, RECT, 150)).toBe(true);
  });
});
```

(테스트 이름의 `caller"s`는 작은따옴표 충돌을 피하려는 것이니 그대로 두거나 `caller` 로 바꿔도 된다.)

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/screenTargeting.test.js
```

Expected: FAIL — `isPointInScreenBox is not a function`

- [ ] **Step 3: Write minimal implementation**

`game/src/gameplay/screenTargeting.js`를 다음으로 교체한다:

```js
export function computeBlastRadiusPx(containerHeight, ratio) {
  return containerHeight * ratio;
}

export function isPointInScreenBox(worldPoint, camera, rect, radiusPx) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // project()는 벡터를 제자리에서 바꾼다. 구조물은 중심 벡터를 재사용하므로
  // 반드시 복제해서 투영한다.
  const ndc = worldPoint.clone().project(camera);
  if (ndc.z > 1) return false; // 카메라 뒤

  const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

  return Math.abs(x - centerX) <= radiusPx && Math.abs(y - centerY) <= radiusPx;
}

export function findMonkeysInScreenBox(monkeys, camera, rect, radiusPx) {
  return monkeys.filter((monkey) => {
    if (monkey.isDying()) return false;
    return isPointInScreenBox(monkey.getCenterWorldPosition(), camera, rect, radiusPx);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/screenTargeting.test.js
```

Expected: PASS — 15 tests (기존 11 + 신규 4). 기존 원숭이 테스트가 전부 그대로 통과해야 한다.

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/screenTargeting.js test/screenTargeting.test.js
git commit -m "refactor: extract isPointInScreenBox for reuse beyond monkeys"
```

---

### Task 2: 참호를 파괴 가능하게 + 구조물 API

**Files:**
- Modify: `game/src/gameplay/obstacles.js`

**Interfaces:**
- Consumes: 없음 (판정 함수는 호출자가 predicate로 넘긴다 — `obstacles.js`가 카메라를 알 필요가 없다)
- Produces:
  - `findStructuresInBox(isInBox: (worldPoint: THREE.Vector3) => boolean) -> Array<{ kind: 'tower' | 'trench', index: number }>`
    미파괴 구조물만, 각자의 **중심점**으로 판정
  - `collapseStructure({ kind, index })` — 이미 무너지는 중이면 아무 일도 하지 않는다
  - `getBlockingMeshes()` — 무너지는 참호 제외 (변경)
  - `collapseTower(towerIndex)` — **제거** (`collapseStructure`로 대체)

- [ ] **Step 1: 상수와 참호 구조를 바꾼다**

`game/src/gameplay/obstacles.js` 상단 상수에 추가한다 (`COLLAPSE_DROP` 아래):

```js
// tools/measure-props.mjs 실측. 자루 참호는 로컬 y -0.0112 ~ 1.1829(높이 1.1941)라
// 중심은 원점보다 0.586 위다. 타워는 상자 2단 + 발판이 월드 y -1.0 ~ 1.229라 중심이 0.11.
// 그룹 원점이 아니라 이 중심으로 판정해야 "네모 안에 보이는데 안 부서지는" 문제가 없다.
const TRENCH_CENTER_Y = 0.586;
const TOWER_CENTER_Y = 0.11;
```

`GROUND_PLACEMENTS` 루프를 다음으로 교체한다 (기존 `for (const placement of GROUND_PLACEMENTS) {...}` 블록 전체):

```js
      const trenches = [];

      GROUND_PLACEMENTS.forEach((placement, trenchIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(group);

        const instance = sackTrenchGltf.scene.clone();
        instance.scale.setScalar(SACK_TRENCH_SCALE);
        group.add(instance);

        const meshes = [];
        const materials = [];
        instance.traverse((object) => {
          if (object.isMesh) {
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
            meshes.push(object);
            collectMaterials(object, materials);
          }
        });

        trenches.push({
          group,
          meshes,
          materials,
          baseY: GROUND_Y,
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          center: new THREE.Vector3(placement.x, GROUND_Y + TRENCH_CENTER_Y, placement.z),
        });
      });
```

`blockingMeshes` 배열 선언은 더 이상 필요 없으므로 지운다 (`const blockingMeshes = [];`).

- [ ] **Step 2: 타워에도 baseY와 center를 넣는다**

`towers.push({...})` 블록에 두 필드를 추가한다:

```js
          baseY: 0,
          center: new THREE.Vector3(placement.x, TOWER_CENTER_Y, placement.z),
```

- [ ] **Step 3: 붕괴 애니메이션을 공유하고 API를 바꾼다**

`update`와 `reset`, 그리고 반환 객체를 다음으로 교체한다:

```js
      function advanceCollapse(structure, dt) {
        if (!structure.collapsing || structure.collapsed) return;
        structure.collapseElapsed += dt;
        const t = Math.min(structure.collapseElapsed / COLLAPSE_DURATION, 1);
        structure.group.rotation.z = t * COLLAPSE_TILT;
        // 타워는 y=0, 참호는 y=GROUND_Y에 있다. 각자의 기준 높이에서 떨어뜨려야
        // 참호가 순간이동하지 않는다.
        structure.group.position.y = structure.baseY - t * COLLAPSE_DROP;
        for (const material of structure.materials) {
          material.transparent = true;
          material.opacity = 1 - t;
        }
        if (t >= 1) {
          structure.collapsed = true;
          structure.group.visible = false;
        }
      }

      function update(dt) {
        for (const tower of towers) advanceCollapse(tower, dt);
        for (const trench of trenches) advanceCollapse(trench, dt);
      }

      function resetStructure(structure) {
        structure.collapsing = false;
        structure.collapsed = false;
        structure.collapseElapsed = 0;
        structure.group.visible = true;
        structure.group.rotation.z = 0;
        structure.group.position.y = structure.baseY;
        for (const material of structure.materials) {
          material.opacity = 1;
        }
      }

      function reset() {
        for (const tower of towers) resetStructure(tower);
        for (const trench of trenches) resetStructure(trench);
      }

      function listOf(kind) {
        return kind === 'tower' ? towers : trenches;
      }

      return {
        getBlockingMeshes() {
          return trenches
            .filter((trench) => !trench.collapsing)
            .flatMap((trench) => trench.meshes);
        },
        getPillarMeshes() {
          return towers.filter((tower) => !tower.collapsing).flatMap((tower) => tower.pillarMeshes);
        },
        getTowerSlots() {
          return towers.map((tower) => tower.monkeySlot);
        },
        findStructuresInBox(isInBox) {
          const found = [];
          towers.forEach((tower, index) => {
            if (!tower.collapsing && isInBox(tower.center)) {
              found.push({ kind: 'tower', index });
            }
          });
          trenches.forEach((trench, index) => {
            if (!trench.collapsing && isInBox(trench.center)) {
              found.push({ kind: 'trench', index });
            }
          });
          return found;
        },
        collapseStructure({ kind, index }) {
          const structure = listOf(kind)[index];
          if (!structure || structure.collapsing) return;
          structure.collapsing = true;
        },
        update,
        reset,
      };
```

- [ ] **Step 4: 죽은 참조를 확인하고 테스트한다**

```bash
grep -rn "collapseTower\|getBlockingMeshes" game/src
```

Expected: `collapseTower`는 `game.js`에 아직 남아 있다 (Task 3에서 고친다). `getBlockingMeshes`는 `obstacles.js` 정의와 `game.js` 사용 각 1곳.

```bash
npm test
```

Expected: 107개 그대로 통과 (`obstacles.js`는 단위 테스트가 없으므로 숫자가 변하지 않는다).

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/obstacles.js
git commit -m "feat: make sandbag trenches destructible and unify structure collapse"
```

---

### Task 3: 바주카가 구조물을 파괴 + 점수를 원숭이로 일원화

**Files:**
- Modify: `game/src/gameplay/game.js`
- Modify: `game/src/config.js`

**Interfaces:**
- Consumes: `isPointInScreenBox` (Task 1), `obstacles.findStructuresInBox` / `collapseStructure` (Task 2)
- Produces: 없음 (최종 통합)

- [ ] **Step 1: config에서 보너스를 제거한다**

`game/src/config.js`의 `score` 블록에서 `towerCollapseBonus: 200,` 줄을 삭제한다.

- [ ] **Step 2: `applyTowerCollapse`가 점수를 더하지 않고 죽은 원숭이를 반환하게 한다**

`game.js`의 `applyTowerCollapse` 전체를 다음으로 교체한다:

```js
  // 붕괴로 죽은 원숭이를 반환한다. 점수는 여기서 더하지 않고 호출부가 일반
  // 사격과 같은 경로(killedHits)로 계산한다 — 구조물 자체는 점수를 주지 않는다.
  function applyTowerCollapse(hitTowerIndex) {
    obstacles.collapseStructure({ kind: 'tower', index: hitTowerIndex });
    const towerMonkey = targetManager.findMonkeyAtTower(hitTowerIndex);
    if (!towerMonkey || towerMonkey.isDying()) return null;
    const worldPos = towerMonkey.getWorldPosition();
    effects.spawnHitBurst(worldPos);
    if (!towerMonkey.kill()) return null;
    return { monkeyId: towerMonkey.id, worldPos: worldPos.clone() };
  }
```

- [ ] **Step 3: 일반 사격 경로를 고친다**

`handleWeaponShot` 안에서, 기존의 이 블록:

```js
    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
    const effectiveOutcome = isPureTowerHit
      ? { isMiss: false, penetrationCount: 0, hits: [] }
      : resolveKillOutcome(outcome, killedHits);
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    if (hitTowerIndex !== null) {
      applyTowerCollapse(hitTowerIndex);
    }
```

을 다음으로 교체한다. 붕괴가 점수 계산보다 **먼저** 일어나야 죽은 원숭이가 `killedHits`에 들어간다:

```js
    if (hitTowerIndex !== null) {
      const towerKill = applyTowerCollapse(hitTowerIndex);
      if (towerKill) {
        killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
        if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
      }
    }

    // 기둥만 맞힌 경우 resolveShot이 isMiss를 주지만 미스가 아니다. 붕괴로 죽은
    // 원숭이가 있으면 그것도 점수에 포함되어야 하므로 결과를 직접 만든다.
    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
    const effectiveOutcome = isPureTowerHit
      ? { isMiss: false, penetrationCount: killedHits.length, hits: killedHits }
      : resolveKillOutcome(outcome, killedHits);
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);
```

- [ ] **Step 4: 바주카가 구조물을 캡처하고 파괴하게 한다**

`game.js` 상단 import에서 `screenTargeting`에서 `isPointInScreenBox`도 가져온다:

```js
import { computeBlastRadiusPx, findMonkeysInScreenBox, isPointInScreenBox } from './screenTargeting.js';
```

`handleBazookaShot`에서 원숭이를 캡처하는 부분 바로 다음에 구조물 캡처를 추가한다:

```js
    const capturedStructures = obstacles.findStructuresInBox((point) =>
      isPointInScreenBox(point, engine.camera, rect, blastRadiusPx)
    );
```

(`rect`와 `blastRadiusPx`는 원숭이 캡처에 이미 쓰이고 있다. 지역 변수로 뽑혀 있지 않다면 뽑아서 두 곳이 같은 값을 쓰게 한다.)

`projectiles.spawn(...)` 콜백에 넘기는 객체에 `capturedStructures`를 추가한다:

```js
    projectiles.spawn(muzzle, impactPoint, CONFIG.bazooka.flightSeconds, () => {
      resolveBazookaImpact({ impactPoint, captured, capturedStructures, hitTowerIndex });
    });
```

- [ ] **Step 5: 착탄 시 구조물을 무너뜨린다**

`resolveBazookaImpact`의 시그니처와 타워 처리 부분을 바꾼다. 기존의:

```js
    if (hitTowerIndex !== null) {
      applyTowerCollapse(hitTowerIndex);
    }

    const killedHits = [];
    let popupWorldPosition = null;
```

을 다음으로 교체한다 (함수 시그니처도 `capturedStructures`를 받도록 바꾼다):

```js
    const killedHits = [];
    let popupWorldPosition = null;

    // 직접 맞힌 타워와 상자 안에 들어온 구조물을 합쳐서 중복 없이 무너뜨린다.
    const structures = [...capturedStructures];
    if (hitTowerIndex !== null && !structures.some((s) => s.kind === 'tower' && s.index === hitTowerIndex)) {
      structures.push({ kind: 'tower', index: hitTowerIndex });
    }

    for (const structure of structures) {
      if (structure.kind === 'tower') {
        const towerKill = applyTowerCollapse(structure.index);
        if (towerKill) {
          killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
          if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
        }
        continue;
      }
      obstacles.collapseStructure(structure);
    }
```

그 아래 `for (const monkey of captured) {...}` 루프는 그대로 둔다. `monkey.kill()`이 멱등이므로 타워 붕괴로 이미 죽은 원숭이는 `false`를 반환해 중복 집계되지 않는다.

`isPureTowerHit` 계산도 구조물이 무너졌으면 미스가 아니도록 바꾼다. 기존:

```js
    const effectiveOutcome = {
      isMiss: killedHits.length === 0 && hitTowerIndex === null,
      penetrationCount: killedHits.length,
      hits: killedHits,
    };
```

을 다음으로 교체한다:

```js
    const effectiveOutcome = {
      isMiss: killedHits.length === 0 && structures.length === 0,
      penetrationCount: killedHits.length,
      hits: killedHits,
    };
```

그리고 `finishShot({...})`에 넘기는 `isPureTowerHit: hitTowerIndex !== null` 을 `isPureTowerHit: killedHits.length === 0 && structures.length > 0` 으로 바꾼다 — 구조물만 부순 경우 명중음이 나야 하고, 원숭이도 죽었으면 원숭이 쪽 효과음이 우선한다.

- [ ] **Step 6: 죽은 참조를 확인하고 테스트한다**

```bash
grep -rn "towerCollapseBonus\|collapseTower" game/src test
```

Expected: 출력 없음

```bash
npm test
```

Expected: 107개 그대로 통과

- [ ] **Step 7: Commit**

```bash
git add game/src/gameplay/game.js game/src/config.js
git commit -m "feat: destroy structures inside the bazooka blast box"
```

---

## 구현 후 사용자 확인

이 세션의 브라우저 프리뷰는 rAF가 돌지 않아 자동 시각 검증이 불가능하다. 사용자가 직접 확인한다.

```js
localStorage.setItem('shootshoot.bazooka','5'); location.reload()
```

확인할 것:

1. 상자 안에 타워가 들어오면 무너지는가 — 직접 조준해 맞히지 않아도
2. 상자 안에 모래주머니 참호가 들어오면 무너지는가
3. 부서진 참호 자리로 총알이 통과하는가 (부서졌는데 계속 막으면 버그)
4. 참호가 무너질 때 순간이동하지 않고 제자리에서 기울며 떨어지는가 (`baseY` 처리 확인)
5. 라운드가 넘어가면 구조물이 전부 복구되는가
6. 타워 위 원숭이를 일반 총기로 떨어뜨렸을 때 점수가 붙는가 (고정 200점이 아니라 콤보·연속 배율이 적용된 값)
