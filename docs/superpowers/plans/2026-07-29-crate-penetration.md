# 나무상자 관통 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타워 기둥 상자를 사격 방향으로 납작하게 만들고, 총알이 그것을 뚫고 지나가 뒤 원숭이까지 맞히게 한다. 기둥을 뚫으면 타워는 지금처럼 무너진다.

**Architecture:** 총알을 무엇이 멈추는지 판단하는 규칙(원숭이 통과 / 상자 통과 / 참호 정지)을 `shooting.js` 의 순수 함수로 떼어 테스트하고, `game.js` 는 three.js 교차 결과를 그 함수가 먹는 모양으로 바꿔 넘긴다. 상자 모양은 `obstacles.js` 의 스케일 한 줄이다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), three.js 0.166.

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 145개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- 상자의 **x·y 스케일은 절대 건드리지 않는다.** 단 높이(`CRATE_UNIT_HEIGHT`), 발판 높이, `monkeySlot` 이 전부 y 기준이라 y를 만지면 원숭이가 공중에 뜨거나 파묻힌다.
- 모래자루 참호는 지금처럼 총알을 멈춘다.
- 바주카 경로(`resolveBazookaImpact`, `findStructuresInBox`)는 건드리지 않는다.
- 관통해도 피해량은 줄지 않는다. 관통 횟수 제한도 두지 않는다.
- 붕괴 연출(`advanceCollapse`)은 건드리지 않는다. 별도 스펙이다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- 나무상자(`/models/crate.glb`)는 타워 기둥에만 쓰인다. 땅 엄폐물은 모래자루 참호다.
- 타워 하나는 상자 2단 × 2줄 = 4개다. 각 상자 메시의 `userData` 는 `{ towerIndex }`.
- 참호 메시는 `userData` 가 비어 있다 — `monkeyId` 도 `towerIndex` 도 없다.
- 원숭이 메시의 `userData` 는 `{ monkeyId }` 이고, 한 원숭이가 메시 여러 개다.
- `handleWeaponShot(intersections)` 은 `game.js:386` 에서 시작한다. 교차는 이미 거리순이다.
- `applyTowerCollapse(hitTowerIndex, burstColor)` 는 붕괴를 걸고, 그 타워 위 원숭이가 살아 있으면 죽이고 `{ monkeyId, worldPos }` 를 준다. 없으면 `null`. 이미 무너지는 중이면 `collapseStructure` 가 알아서 무시한다.
- `finishShot({ effectiveOutcome, gained, popupWorldPosition, isPureTowerHit })` 이 효과음과 점수 팝업을 낸다.
- `test/shooting.test.js` 는 `import { describe, it, expect } from 'vitest';` 로 시작하고 `describe`/`it` 로 묶는다.

## 파일 구조

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/gameplay/shooting.js` | `partitionShotPath` 추가 |
| `test/shooting.test.js` | 위 함수 테스트 8개 |
| `game/src/gameplay/obstacles.js` | 상자 깊이 스케일 |
| `game/src/gameplay/game.js` | `handleWeaponShot` 이 새 함수를 쓰고, 타워를 목록으로 처리 |

**건드리지 않는 파일**

`targetManager.js`, `bazookaProjectile.js`, `scoring.js`, `weaponViewmodel.js`, `world.js`, `skyDecor.js`, `config.js`.

---

### Task 1: 멈춤 규칙 순수 함수

총알을 무엇이 멈추는지가 세 갈래가 된다. 프레임 루프 안에서는 테스트가 닿지 않으므로 규칙만 떼어낸다.

**Files:**
- Modify: `game/src/gameplay/shooting.js`
- Modify: `test/shooting.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `partitionShotPath(entries) -> { monkeyIds: string[], towerIndices: number[] }` — Task 3 이 쓴다. `entries` 는 거리순 교차를 `{ monkeyId, towerIndex }` 로 단순화한 목록이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/shooting.test.js` 의 import 줄에 `partitionShotPath` 를 더한다:

```js
import { resolveShot, computeHitDamage, resolveKillOutcome, partitionShotPath } from '../game/src/gameplay/shooting.js';
```

파일 맨 끝에 새 describe 블록을 더한다:

```js
describe('partitionShotPath', () => {
  it('returns empty lists for an empty path', () => {
    expect(partitionShotPath([])).toEqual({ monkeyIds: [], towerIndices: [] });
  });

  it('passes through two monkeys and keeps their order', () => {
    const path = partitionShotPath([{ monkeyId: 'a' }, { monkeyId: 'b' }]);
    expect(path.monkeyIds).toEqual(['a', 'b']);
    expect(path.towerIndices).toEqual([]);
  });

  it('counts a monkey once even when several of its meshes are hit', () => {
    const path = partitionShotPath([{ monkeyId: 'a' }, { monkeyId: 'a' }, { monkeyId: 'b' }]);
    expect(path.monkeyIds).toEqual(['a', 'b']);
  });

  it('passes through a crate and still reaches the monkey behind it', () => {
    const path = partitionShotPath([{ towerIndex: 1 }, { monkeyId: 'a' }]);
    expect(path.towerIndices).toEqual([1]);
    expect(path.monkeyIds).toEqual(['a']);
  });

  it('counts a tower once even when several of its crates are hit', () => {
    const path = partitionShotPath([{ towerIndex: 1 }, { towerIndex: 1 }, { monkeyId: 'a' }]);
    expect(path.towerIndices).toEqual([1]);
    expect(path.monkeyIds).toEqual(['a']);
  });

  it('collects both towers when one shot crosses two of them', () => {
    const path = partitionShotPath([{ towerIndex: 0 }, { towerIndex: 1 }]);
    expect(path.towerIndices).toEqual([0, 1]);
  });

  it('treats tower index 0 as a real tower rather than as absent', () => {
    const path = partitionShotPath([{ towerIndex: 0 }]);
    expect(path.towerIndices).toEqual([0]);
  });

  it('stops at anything that is neither a monkey nor a crate', () => {
    const path = partitionShotPath([{ monkeyId: 'a' }, {}, { monkeyId: 'b' }, { towerIndex: 1 }]);
    expect(path.monkeyIds).toEqual(['a']);
    expect(path.towerIndices).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/shooting.test.js`
Expected: FAIL — `partitionShotPath is not a function`

- [ ] **Step 3: 구현**

`game/src/gameplay/shooting.js` 의 `resolveShot` 위에 넣는다:

```js
// 거리순 교차를 훑어 총알이 실제로 지나간 것들을 모은다. 원숭이와 나무상자는
// 뚫고 지나가고, 그 밖의 것(모래자루 참호)은 총알을 거기서 멈춘다.
// 같은 원숭이의 메시 여러 개, 한 타워의 상자 여러 개가 걸리므로 각각 한 번만 담는다.
export function partitionShotPath(entries) {
  const monkeyIds = [];
  const towerIndices = [];
  const seenMonkeys = new Set();
  const seenTowers = new Set();

  for (const entry of entries) {
    if (entry.monkeyId) {
      if (!seenMonkeys.has(entry.monkeyId)) {
        seenMonkeys.add(entry.monkeyId);
        monkeyIds.push(entry.monkeyId);
      }
      continue;
    }
    // towerIndex 는 0 일 수 있다. 참/거짓으로 보면 첫 타워가 통째로 사라진다.
    if (entry.towerIndex !== undefined) {
      if (!seenTowers.has(entry.towerIndex)) {
        seenTowers.add(entry.towerIndex);
        towerIndices.push(entry.towerIndex);
      }
      continue;
    }
    break;
  }

  return { monkeyIds, towerIndices };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/shooting.test.js`
Expected: PASS, 16 tests (기존 8 + 새 8)

- [ ] **Step 5: 전체 테스트와 빌드**

Run: `npm test`
Expected: 153 tests passed (145 + 8)

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/shooting.js test/shooting.test.js
git commit -m "feat: add the shot path partition rule

What stops a bullet is about to have three branches rather than two, and
the loop that decides it sits inside the frame loop where no test can
reach it. The rule comes out on its own so the cases can be pinned down.

towerIndex is compared against undefined rather than tested for truth,
because tower 0 is a real tower and would otherwise vanish."
```

---

### Task 2: 상자를 납작하게

**Files:**
- Modify: `game/src/gameplay/obstacles.js`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (시각 변경)

- [ ] **Step 1: 깊이 비율 상수 추가**

`game/src/gameplay/obstacles.js` 의 `const CRATE_SCALE = 6;` 바로 아래에 넣는다:

```js
// 상자를 사격 방향(z)으로만 납작하게 만든다. 총알이 뚫고 지나가는 널빤지로
// 보여야 하는데, x·y 까지 줄이면 단 높이와 그 위 원숭이 발판이 같이 내려간다.
const CRATE_DEPTH_RATIO = 0.22;
```

- [ ] **Step 2: 스케일을 비균등으로**

같은 파일에서 상자 인스턴스의 스케일 한 줄을 바꾼다. 기존:

```js
            crateInstance.scale.setScalar(CRATE_SCALE);
```
변경 후:
```js
            crateInstance.scale.set(CRATE_SCALE, CRATE_SCALE, CRATE_SCALE * CRATE_DEPTH_RATIO);
```

`sackTrenchGltf` 쪽 `setScalar(SACK_TRENCH_SCALE)` 호출 두 곳은 **그대로 둔다.** 참호와 타워 발판은 상자가 아니다.

- [ ] **Step 3: y 축이 안 바뀌었는지 확인**

Run: `grep -n "CRATE_UNIT_HEIGHT\|CRATE_ORIGIN_TO_BOTTOM\|pillarTopY\|monkeySlot" game/src/gameplay/obstacles.js`
Expected: 이 줄들이 변경 전과 같다. 상자 위치 계산(`position.set`)과 `pillarTopY`, `monkeySlot` 어디에도 `CRATE_DEPTH_RATIO` 가 들어가면 안 된다.

- [ ] **Step 4: 테스트와 빌드**

Run: `npm test`
Expected: 153 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add game/src/gameplay/obstacles.js
git commit -m "feat: flatten the tower crates along the firing axis

A shot is about to pass through these, and a full-depth crate that
bullets sail through reads as a bug rather than as thin cover.

Only z is scaled. The stack height, the platform height and the monkey
slot are all measured on y, so touching y would leave the monkey floating
above its platform or sunk into it."
```

---

### Task 3: 총알이 기둥을 통과

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `partitionShotPath(entries) -> { monkeyIds: string[], towerIndices: number[] }`
- Produces: 없음

- [ ] **Step 1: import 에 `partitionShotPath` 추가**

`game/src/gameplay/game.js:6` 의 import 다. 기존:

```js
import { resolveShot, computeHitDamage, resolveKillOutcome } from './shooting.js';
```
변경 후:
```js
import { resolveShot, computeHitDamage, resolveKillOutcome, partitionShotPath } from './shooting.js';
```

- [ ] **Step 2: 교차 훑기를 새 함수로 교체**

`handleWeaponShot` 첫머리다. 기존:

```js
  function handleWeaponShot(intersections) {
    const seen = new Set();
    const hits = [];
    let hitTowerIndex = null;
    for (const intersection of intersections) {
      const { monkeyId, towerIndex } = intersection.object.userData;
      if (monkeyId) {
        if (seen.has(monkeyId)) continue;
        seen.add(monkeyId);
        const monkey = targetManager.findMonkey(monkeyId);
        if (!monkey) continue;
        hits.push({ monkeyId, part: monkey.classifyHit(intersection.point) });
        continue;
      }
      if (towerIndex !== undefined) {
        hitTowerIndex = towerIndex;
      }
      break;
    }
```
변경 후:
```js
  function handleWeaponShot(intersections) {
    // 부위 판정에는 교차점이 필요한데 멈춤 규칙은 그걸 안 본다. 규칙은 순수 함수에
    // 맡기고, 여기서는 원숭이마다 가장 가까운 교차점만 따로 챙겨 둔다.
    const firstPointByMonkey = new Map();
    const entries = intersections.map((intersection) => {
      const { monkeyId, towerIndex } = intersection.object.userData;
      if (monkeyId && !firstPointByMonkey.has(monkeyId)) {
        firstPointByMonkey.set(monkeyId, intersection.point);
      }
      return { monkeyId, towerIndex };
    });
    const { monkeyIds, towerIndices } = partitionShotPath(entries);

    const hits = [];
    for (const monkeyId of monkeyIds) {
      const monkey = targetManager.findMonkey(monkeyId);
      if (!monkey) continue;
      hits.push({ monkeyId, part: monkey.classifyHit(firstPointByMonkey.get(monkeyId)) });
    }
```

- [ ] **Step 3: 지나간 타워를 전부 무너뜨리기**

같은 함수 안, `killedHits` 를 채운 다음이다. 기존:

```js
    if (hitTowerIndex !== null) {
      const towerKill = applyTowerCollapse(hitTowerIndex);
      if (towerKill) {
        killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
        if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
      }
    }
```
변경 후:
```js
    // 한 발이 앞 타워를 뚫고 뒤 타워까지 닿을 수 있다. 지나간 타워는 전부 무너진다.
    for (const towerIndex of towerIndices) {
      const towerKill = applyTowerCollapse(towerIndex);
      if (towerKill) {
        killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
        if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
      }
    }
```

- [ ] **Step 4: `isPureTowerHit` 판정 고치기**

같은 함수 안이다. 기존:

```js
    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
```
변경 후:
```js
    const isPureTowerHit = hits.length === 0 && towerIndices.length > 0;
```

- [ ] **Step 5: `finishShot` 인자 고치기**

같은 함수 끝이다. 기존:

```js
      isPureTowerHit: hitTowerIndex !== null,
```
변경 후:
```js
      isPureTowerHit,
```

`isPureTowerHit` 는 Step 4 에서 이미 같은 값으로 계산돼 있다. 기존 코드가 같은 판정을 두 번 쓰고 있었다.

- [ ] **Step 6: `hitTowerIndex` 가 이 함수에서 사라졌는지 확인**

Run: `grep -n "hitTowerIndex" game/src/gameplay/game.js`
Expected: `resolveBazookaImpact` 와 `handleBazookaShot` 쪽에만 남는다. `handleWeaponShot` 안에는 한 줄도 없어야 한다. 바주카 경로의 `hitTowerIndex` 는 별개이므로 건드리지 않는다.

- [ ] **Step 7: 테스트와 빌드**

Run: `npm test`
Expected: 153 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 8: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: let a shot pass through the tower crates

A monkey behind cover could not be reached at all, which left the crates
as a wall rather than as a choice.

Because the shot no longer stops at the first crate it can cross two
towers, so the single hitTowerIndex becomes a list and every tower the
shot passed through collapses.

The hit part still needs the intersection point, which the stop rule does
not care about, so the nearest point per monkey is kept aside and the
rule itself works on plain ids."
```

- [ ] **Step 9: 사용자 육안 확인 요청**

이 세션 환경에서는 브라우저 스크린샷이 실패한다 (`the Browser pane is not displayed`). 다음을 사용자에게 확인해 달라고 요청한다 (직접 브라우저를 열려고 하지 말 것):

1. 타워 기둥이 널빤지처럼 얇아 보이는가
2. 원숭이 발판 높이와 그 위 원숭이 위치가 그대로인가
3. 기둥을 쏘면 타워가 무너지는가 (지금과 같음)
4. 기둥 뒤에 있는 원숭이가 기둥 너머로 맞는가
5. 모래자루 참호는 여전히 총알을 막는가
6. 한 발로 타워 둘을 관통하면 둘 다 무너지는가

개발 서버 주소는 `http://127.0.0.1:5174/` 다. 5173은 다른 프로젝트(TowerWar)가 잡고 있다.
