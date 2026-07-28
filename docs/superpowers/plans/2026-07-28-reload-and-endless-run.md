# 장전과 무한 플레이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임오버를 없애 판이 무한히 이어지게 하고 골드를 라운드마다 정산하며, 한 발 쏠 때마다 장전을 거치게 한다.

**Architecture:** 게임오버 제거를 먼저 한다 — 그러면 "장전 도중 게임오버" 예외가 아예 생기지 않는다. 장전 상태는 `game.js` 나 `weaponViewmodel` 이 아니라 순수 타이머 모듈이 들고, 조준 차단은 `input.js` 한 곳에서 한다. 정산 계산도 순수 함수로 떼어 프레임 루프 밖에서 테스트한다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), three.js 0.166, 바닐라 DOM.

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 125개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- 장전 시간은 모든 무기가 같은 값을 쓴다: `CONFIG.reload.seconds = 0.8`.
- 장전 중에는 조준 자체가 막힌다. 확대도, 레티클도, 발사도 안 된다.
- 라운드 정산 나머지(`pending % scorePerGold`)는 버린다. 이월하지 않는다.
- 라운드 도중 퇴장하면 미정산 점수는 버린다.
- 퇴장 시 골드를 주지 않는다. 골드는 라운드 정산에서만 나온다.
- UI 모듈은 `game/src/ui/theme.css` 의 클래스와 `kit.js` 팩토리를 쓴다. 색·테두리를 인라인으로 하드코딩하지 않는다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- 발사는 **누르면 조준, 떼면 발사**다. `input.onAimDown` 이 조준을 켜고 `input.onAimUp(handleShot)` 이 쏜다.
- 조준 중에는 뷰모델이 숨는다 (`setVisible(!input.isAiming())`).
- `handleShot` 첫머리에 `if (phase !== 'playing') return;` 과 `if (!aimApplied) return;` 가드가 있다.
- 게임오버의 유일한 조건은 `scoreState.misses >= CONFIG.missLimit` 이다.
- 라운드는 `beginRound(round + 1)` 로 무한히 이어진다.
- `endGame()` 이 골드가 들어오는 유일한 통로다.
- 플레이 중 메뉴로 나갈 방법이 없다. `P` 로 설정을 열 수 있지만 닫으면 게임으로 돌아간다.
- `scoreState` 는 `localStorage` 에 저장되지 않는다. 매 판 `createScoreState()` 로 새로 만든다.
- `swapWeaponViewmodel(weapon)` 은 로드 성공 시에만 기존 뷰모델을 `dispose()` 하고 교체한다.

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/reloadState.js` | 장전 남은 시간만 들고 있는 순수 타이머 |
| `test/reloadState.test.js` | 위 모듈 테스트 |

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/gameplay/scoring.js` | `misses` 제거, `settlementGold` 추가 |
| `test/scoring.test.js` | `misses` 단언 수정, `settlementGold` 테스트 추가 |
| `game/src/config.js` | `missLimit` 제거, `reload` 추가 |
| `game/src/core/input.js` | `setEnabled` 추가 |
| `game/src/gameplay/weaponViewmodel.js` | `triggerReload` 와 장전 모션 |
| `game/src/ui/settingsPanel.js` | `onExit` 를 받아 `메뉴로` 버튼 |
| `game/src/ui/screens.js` | 게임오버 화면 제목 문구 |
| `game/src/gameplay/game.js` | 미스 제한 제거, 라운드 정산, 퇴장, 장전 배선 |

**건드리지 않는 파일**

`targetManager.js`, `bazookaStore.js`, `bazookaProjectile.js`, `obstacles.js`, `difficulty.js`, `kit.js`, `theme.css`.

---

### Task 1: 미스 제한 제거와 정산 계산

게임오버가 사라지므로 `scoreState.misses` 는 읽는 곳이 없어진다. 같은 파일에 라운드 정산 계산을 순수 함수로 넣는다 — 정산이 일어나는 자리는 프레임 루프 안이라 테스트가 닿지 않으므로, 계산만이라도 떼어 놓아야 검증할 수 있다.

**Files:**
- Modify: `game/src/gameplay/scoring.js`
- Modify: `test/scoring.test.js`
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `createScoreState() -> { score: number, streak: number }` — `misses` 가 사라진다
  - `applyShot(scoreState, shotOutcome, config) -> { score, streak }`
  - `settlementGold(pendingScore: number, scorePerGold: number) -> number` — Task 2 가 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`test/scoring.test.js` 의 import 목록에 `settlementGold` 를 더한다:

```js
import {
  createScoreState,
  calculateShotScore,
  applyShot,
  settlementGold,
  createHighScoreStore,
} from '../game/src/gameplay/scoring.js';
```

파일 끝의 `createHighScoreStore` describe 블록 바로 앞에 새 describe 를 넣는다:

```js
describe('settlementGold', () => {
  it('converts a whole multiple of the rate', () => {
    expect(settlementGold(500, 10)).toBe(50);
  });

  it('drops the remainder rather than carrying it', () => {
    expect(settlementGold(509, 10)).toBe(50);
    expect(settlementGold(9, 10)).toBe(0);
  });

  it('pays nothing for a round that scored nothing', () => {
    expect(settlementGold(0, 10)).toBe(0);
  });

  it('pays nothing rather than negative gold if the pending score is below zero', () => {
    expect(settlementGold(-100, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/scoring.test.js`
Expected: FAIL — `settlementGold is not a function`

- [ ] **Step 3: `settlementGold` 구현**

`game/src/gameplay/scoring.js` 의 `applyShot` 아래에 넣는다:

```js
// 라운드를 클리어할 때 미정산 점수를 골드로 바꾼다. 나머지는 버린다 —
// 이월을 만들면 상태가 하나 더 늘고 체감 차이가 없다.
export function settlementGold(pendingScore, scorePerGold) {
  if (pendingScore <= 0) return 0;
  return Math.floor(pendingScore / scorePerGold);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/scoring.test.js`
Expected: PASS

- [ ] **Step 5: `misses` 를 `scoring.js` 에서 제거**

`createScoreState` 와 `applyShot` 두 곳이다. `calculateShotScore` 는 손대지 않는다.

기존:
```js
export function createScoreState() {
  return { score: 0, streak: 0, misses: 0 };
}
```
변경 후:
```js
export function createScoreState() {
  return { score: 0, streak: 0 };
}
```

기존:
```js
  if (shotOutcome.isMiss) {
    return { score: scoreState.score, streak: 0, misses: scoreState.misses + 1 };
  }
  const gained = calculateShotScore(shotOutcome, scoreState.streak, config);
  return { score: scoreState.score + gained, streak: scoreState.streak + 1, misses: scoreState.misses };
```
변경 후:
```js
  if (shotOutcome.isMiss) {
    return { score: scoreState.score, streak: 0 };
  }
  const gained = calculateShotScore(shotOutcome, scoreState.streak, config);
  return { score: scoreState.score + gained, streak: scoreState.streak + 1 };
```

`applyShot` 위의 주석 중 "미스로 세지도 않는다" 는 이제 셀 미스가 없으므로 다음으로 바꾼다:

```js
  // 구조물만 부순 발사처럼 명중도 빗나감도 아닌 경우. 연속 배율을 올리지도,
  // 끊지도 않는다.
```

- [ ] **Step 6: `misses` 를 쓰는 테스트 단언 수정**

`test/scoring.test.js` 에서 네 군데다. 상태 객체에서 `misses` 를 빼고, `misses` 를 보는 단언을 지운다. 연속 배율이 끊기는지 보는 단언은 남긴다.

`'scores nothing for a hit that killed nobody, and keeps the streak alive'`:
```js
    const next = applyShot({ score: 500, streak: 3 }, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
```

`'increments score and streak on hit'`: `expect(next.misses).toBe(0);` 줄을 지운다.

`'resets streak and increments misses on miss'` → 이름을 `'resets the streak on a miss'` 로 바꾸고:
```js
  it('resets the streak on a miss', () => {
    const state = { score: 500, streak: 4 };
    const outcome = { isMiss: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(0);
  });
```

`'leaves score, streak, and misses all unchanged on a neutral outcome'` → 이름을 `'leaves score and streak unchanged on a neutral outcome'` 로 바꾸고:
```js
  it('leaves score and streak unchanged on a neutral outcome', () => {
    const state = { score: 500, streak: 4 };
    const outcome = { isMiss: false, isNeutral: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
  });
```

- [ ] **Step 7: `CONFIG.missLimit` 제거**

`game/src/config.js` 에서 `  missLimit: 5,` 줄을 지운다. 앞뒤 줄(`roundsPerMonkeyHpIncrease` 를 닫는 `},` 와 `scorePerGold: 10,`)은 그대로 둔다.

- [ ] **Step 8: 게임오버 판정 제거**

`game/src/gameplay/game.js` 에서 이 세 줄을 지운다:

```js
    if (scoreState.misses >= CONFIG.missLimit) {
      endGame();
    }
```

바로 위의 `updateHud();` 는 남긴다. 이 시점에서 `endGame` 은 호출되는 곳이 없어진다 — Task 3 에서 `exitRun` 으로 바뀐다.

- [ ] **Step 9: 전체 테스트와 빌드**

Run: `npm test`
Expected: 129 tests passed (기존 125 + settlementGold 4)

Run: `npm run build`
Expected: 성공

- [ ] **Step 10: 남은 참조가 없는지 확인**

Run: `grep -rn "missLimit\|\.misses" game/src test`
Expected: 출력 없음 (exit 1)

- [ ] **Step 11: 커밋**

```bash
git add game/src/gameplay/scoring.js test/scoring.test.js game/src/config.js game/src/gameplay/game.js
git commit -m "feat: drop the miss limit and add the round settlement rate

misses existed only to end the run at five, so it goes with the limit.
The streak still breaks on a miss — that is a separate branch in
applyShot and it stays.

settlementGold lands in the same file because the place it will be
called from is inside the frame loop, where no test can reach it."
```

---

### Task 2: 라운드 정산

Task 1 이후 골드가 들어오는 통로가 없다. 라운드를 클리어할 때마다 그 라운드에서 번 점수를 골드로 바꾼다.

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `settlementGold(pendingScore, scorePerGold) -> number`
- Produces: 없음 (game.js 내부 상태)

- [ ] **Step 1: `settlementGold` 를 import 에 추가**

`game/src/gameplay/game.js:7` 의 한 줄짜리 import 다. 기존:

```js
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
```
변경 후:
```js
import { createScoreState, applyShot, calculateShotScore, settlementGold, createHighScoreStore } from './scoring.js';
```

- [ ] **Step 2: `settledScore` 상태 추가**

`game/src/gameplay/game.js` 의 상태 선언 묶음, `let scoreState = createScoreState();` 바로 아래에 넣는다:

```js
  // 이미 골드로 바꾼 점수. 라운드 정산은 score 와 이 값의 차이만 지급한다.
  let settledScore = 0;
```

- [ ] **Step 3: 판 시작 시 초기화**

`startGame()` 에서 `scoreState = createScoreState();` 바로 아래에 넣는다:

```js
    settledScore = 0;
```

- [ ] **Step 4: 라운드 클리어 지점에서 정산**

프레임 루프의 라운드 클리어 분기다. 기존:

```js
        if (targetManager.allCleared() && !projectiles.hasPending()) {
          sfx.roundClear();
          stageBanner.show(round + 1);
          beginRound(round + 1);
          updateHud();
        }
```

변경 후:

```js
        if (targetManager.allCleared() && !projectiles.hasPending()) {
          // 이 라운드에서 번 만큼만 지급한다. 도중에 나가면 정산을 안 하므로
          // 그 라운드 점수는 그대로 버려진다.
          currencyStore.earn(settlementGold(scoreState.score - settledScore, CONFIG.scorePerGold));
          settledScore = scoreState.score;
          sfx.roundClear();
          stageBanner.show(round + 1);
          beginRound(round + 1);
          updateHud();
        }
```

- [ ] **Step 5: 테스트와 빌드**

Run: `npm test`
Expected: 129 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: pay gold for each round cleared

Removing the miss limit left the run endless and endGame was the only
place gold was ever paid, so the economy had no source at all. Gold now
settles as each round clears.

settledScore tracks what has already been converted, which is also what
makes leaving mid-round forfeit that round without any extra branch."
```

---

### Task 3: 퇴장 경로

판이 끝나지 않으므로 나갈 길을 만든다. 설정 패널에 `메뉴로` 버튼을 붙이고, `endGame` 을 `exitRun` 으로 바꾼다.

**Files:**
- Modify: `game/src/ui/settingsPanel.js`
- Modify: `game/src/ui/screens.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createSettingsPanel(container).show(sensitivity, onChange, onClose, onExit?)` — `onExit` 가 함수일 때만 `메뉴로` 버튼이 붙는다

- [ ] **Step 1: 설정 패널에 퇴장 버튼**

`game/src/ui/settingsPanel.js` 의 `show` 시그니처와 본문 끝을 바꾼다.

기존:
```js
  function show(sensitivity, onChange, onClose) {
```
변경 후:
```js
  // onExit 는 플레이 중에 열렸을 때만 넘어온다. 메뉴에서 연 설정에
  // '메뉴로' 가 있으면 말이 안 된다.
  function show(sensitivity, onChange, onClose, onExit) {
```

기존:
```js
    const doneBtn = button('닫기', onClose, 'ghost');
    doneBtn.style.cssText += 'display: block; margin: 16px auto 0;';
    box.appendChild(doneBtn);
```
변경 후:
```js
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; justify-content: center; gap: 12px; margin-top: 16px;';
    if (typeof onExit === 'function') {
      actions.appendChild(button('메뉴로', onExit, 'ghost'));
    }
    actions.appendChild(button('닫기', onClose, 'ghost'));
    box.appendChild(actions);
```

- [ ] **Step 2: 게임오버 화면 제목 변경**

판이 끝난 게 아니라 그만둔 것이므로 `game/src/ui/screens.js` 의 `showGameOver` 안에서:

```js
    card.appendChild(title('게임 종료'));
```
를 다음으로 바꾼다:
```js
    card.appendChild(title('기록'));
```

- [ ] **Step 3: `endGame` 을 `exitRun` 으로 교체**

`game/src/gameplay/game.js` 의 `endGame` 함수 전체를 지우고 그 자리에 넣는다:

```js
  // 판이 끝나는 유일한 길이다. 골드는 라운드 정산에서 이미 줬으므로 여기서는
  // 주지 않는다. 미정산 점수는 그대로 버려진다.
  function exitRun() {
    settingsPanel.hide();
    settingsOpen = false;
    settingsOrigin = null;
    phase = 'gameover';
    targetManager.clear();
    projectiles.clear();
    const previousHighScore = highScoreStore.get();
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = scoreState.score > previousHighScore && scoreState.score > 0;
    screens.showGameOver({ score: scoreState.score, highScore, isNewHighScore }, returnToMenu);
  }
```

`phase = 'gameover'` 를 유지하는 이유: 프레임 루프의 `if (phase === 'playing' && ...)` 가드들이 그대로 동작해서 요약 화면이 떠 있는 동안 사격과 라운드 진행이 멈춘다.

- [ ] **Step 4: 플레이 중 설정에 퇴장 핸들러 연결**

`openSettingsFromPlay` 안의 호출에 네 번째 인자를 더한다:

```js
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings, exitRun);
```

`openSettingsFromMenu` 안의 호출은 **그대로 둔다** (인자 세 개).

- [ ] **Step 5: 테스트와 빌드**

Run: `npm test`
Expected: 129 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: `endGame` 이 남아 있지 않은지 확인**

Run: `grep -rn "endGame" game/src`
Expected: 출력 없음 (exit 1)

- [ ] **Step 7: 커밋**

```bash
git add game/src/ui/settingsPanel.js game/src/ui/screens.js game/src/gameplay/game.js
git commit -m "feat: let the player leave a run from the settings panel

With the miss limit gone a run has no end, and the only way to the menu
used to be dying. The settings panel already opens mid-play on P, so the
exit goes there rather than adding another thing to the screen.

The panel takes onExit only when opened from play — a menu-opened
settings screen with a 'back to menu' button would be nonsense. The game
over screen is reused as the summary, retitled since nothing ended."
```

---

### Task 4: 장전 타이머 모듈

**Files:**
- Create: `game/src/gameplay/reloadState.js`
- Create: `test/reloadState.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createReloadState(seconds) -> { start(), tick(dt), isReloading(), remaining(), reset() }` — Task 7 이 쓴다

상태를 `weaponViewmodel` 에 두지 않는 이유가 있다. `swapWeaponViewmodel` 이 뷰모델을 파괴하고 다시 만드는데, 그게 일어나는 시점이 하필 **바주카 마지막 발을 쏜 직후**다. 뷰모델이 상태를 들고 있으면 장전이 통째로 사라져 즉시 다시 쏠 수 있게 된다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/reloadState.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createReloadState } from '../game/src/gameplay/reloadState.js';

describe('createReloadState', () => {
  it('starts idle', () => {
    const reload = createReloadState(0.8);
    expect(reload.isReloading()).toBe(false);
    expect(reload.remaining()).toBe(0);
  });

  it('is reloading for the full duration after start', () => {
    const reload = createReloadState(0.8);
    reload.start();
    expect(reload.isReloading()).toBe(true);
    expect(reload.remaining()).toBeCloseTo(0.8);
  });

  it('counts down by the frame delta', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(0.3);
    expect(reload.remaining()).toBeCloseTo(0.5);
    expect(reload.isReloading()).toBe(true);
  });

  it('finishes exactly at zero rather than going negative on a long frame', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(5);
    expect(reload.remaining()).toBe(0);
    expect(reload.isReloading()).toBe(false);
  });

  it('stays finished when ticked again', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(1);
    reload.tick(1);
    expect(reload.remaining()).toBe(0);
  });

  it('restarts from the full duration', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.tick(0.6);
    reload.start();
    expect(reload.remaining()).toBeCloseTo(0.8);
  });

  it('reset clears an in-progress reload', () => {
    const reload = createReloadState(0.8);
    reload.start();
    reload.reset();
    expect(reload.isReloading()).toBe(false);
    expect(reload.remaining()).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/reloadState.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/reloadState.js"`

- [ ] **Step 3: 구현**

Create `game/src/gameplay/reloadState.js`:

```js
// 장전 남은 시간만 들고 있는다. 뷰모델이 아니라 여기 두는 이유는,
// 바주카 마지막 발을 쏘면 뷰모델이 교체되면서 장전 상태가 사라지기 때문이다.
export function createReloadState(seconds) {
  let remainingSeconds = 0;

  return {
    start() {
      remainingSeconds = seconds;
    },
    // 프레임이 길어도 0 아래로 내려가지 않는다.
    tick(dt) {
      remainingSeconds = Math.max(0, remainingSeconds - dt);
    },
    isReloading() {
      return remainingSeconds > 0;
    },
    remaining() {
      return remainingSeconds;
    },
    reset() {
      remainingSeconds = 0;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/reloadState.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: 전체 테스트**

Run: `npm test`
Expected: 136 tests passed (129 + 7)

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/reloadState.js test/reloadState.test.js
git commit -m "feat: add the reload timer

The timer lives outside the viewmodel on purpose. swapWeaponViewmodel
disposes and rebuilds the viewmodel, and it does so exactly when the last
bazooka round is spent — state held there would vanish mid-reload and let
the player fire again immediately."
```

---

### Task 5: 입력 차단 스위치

**Files:**
- Modify: `game/src/core/input.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createInputController(domElement).setEnabled(enabled: boolean)` — Task 7 이 매 프레임 부른다

`mousedown` 을 무시하면 `aiming` 이 false 로 유지되고, 확대·레티클·발사가 한 번에 막힌다. `onMouseUp` 에 이미 `if (!aiming) return;` 이 있어서 뗄 때도 아무 일이 없다. `game.js` 의 `input.isAiming()` 사용처 네 곳은 손대지 않는다 — 거기서 막으려 하면 한 곳만 빠뜨려도 티가 안 나고, 장전이 끝나는 순간 버튼을 누르고 있던 플레이어의 조준이 갑자기 켜진다.

- [ ] **Step 1: `enabled` 플래그 추가**

`game/src/core/input.js` 의 상태 선언에 한 줄을 더한다. 초기값은 켜짐이다 — 컨트롤러를 만들자마자 입력이 죽어 있으면 안 된다.

기존:
```js
  const ndc = { x: 0, y: 0 };
  let aiming = false;
```
변경 후:
```js
  const ndc = { x: 0, y: 0 };
  let aiming = false;
  let enabled = true;
```

- [ ] **Step 2: `onMouseDown` 에서 차단**

기존:
```js
  function onMouseDown(event) {
    if (event.button !== 0) return;
```
변경 후:
```js
  function onMouseDown(event) {
    if (!enabled) return;
    if (event.button !== 0) return;
```

- [ ] **Step 3: `setEnabled` 노출**

반환 객체의 `isAiming` 아래에 넣는다. 매 프레임 불리므로 대입 말고는 아무 일도 하지 않는다:

```js
    setEnabled(value) {
      enabled = value;
    },
```

- [ ] **Step 4: 테스트와 빌드**

Run: `npm test`
Expected: 136 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add game/src/core/input.js
git commit -m "feat: let the input controller be switched off

Blocking at mousedown keeps aiming false, which takes out the zoom, the
reticle and the shot in one place. Gating instead at the four
isAiming() call sites in game.js would silently miss one, and would snap
the zoom on the instant a reload ended under a held button."
```

---

### Task 6: 장전 모션

**Files:**
- Modify: `game/src/gameplay/weaponViewmodel.js`

**Interfaces:**
- Consumes: 없음
- Produces: `loadWeaponViewmodel(camera, weapon)` 이 반환하는 객체에 `triggerReload(seconds)` 추가

반동은 0.15초, 장전은 0.8초라 두 모션이 겹친다. 지금 `updateRecoil` 은 `position.z` 와 `rotation.x` 에 절대값을 대입하는데, 장전도 `rotation.x` 를 건드리므로 그대로 두면 서로 덮어쓴다. 두 모션이 각자 오프셋을 내고 마지막에 한 번만 적용하도록 바꾼다.

- [ ] **Step 1: 장전 상수 추가**

`game/src/gameplay/weaponViewmodel.js` 위쪽 상수 묶음에 더한다:

```js
const RELOAD_DIP_DISTANCE = 0.12;
const RELOAD_TILT_ANGLE = 0.5;
```

- [ ] **Step 2: 상태 변수 추가**

기존:
```js
    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;
```
변경 후:
```js
    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;
    let reloadElapsed = 0;
    let reloadDuration = 0;
    let isReloading = false;
```

- [ ] **Step 3: `updateRecoil` 을 오프셋 계산으로 바꾸기**

기존 `updateRecoil` 전체를 지우고 다음으로 바꾼다. 반환값이 `{ z, rotX }` 오프셋이다:

```js
    // 절대값을 대입하는 대신 오프셋을 낸다. 장전도 rotation.x 를 건드리므로
    // 둘이 서로 덮어쓰지 않으려면 마지막에 한 번만 적용해야 한다.
    function recoilOffset(dt) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      if (t >= 1) {
        isRecoiling = false;
      }
      return { z: kick * RECOIL_KICK_DISTANCE, rotX: -kick * RECOIL_KICK_ANGLE };
    }
```

- [ ] **Step 4: 장전 오프셋 추가**

`recoilOffset` 아래에 넣는다. 총을 내리고 기울였다가 다시 올린다:

```js
    // 0 ~ 0.25 내리기, 0.25 ~ 0.7 유지, 0.7 ~ 1 올리기.
    function reloadAmount(t) {
      if (t < 0.25) return t / 0.25;
      if (t < 0.7) return 1;
      return 1 - (t - 0.7) / 0.3;
    }

    function reloadOffset(dt) {
      reloadElapsed += dt;
      const t = reloadDuration > 0 ? Math.min(reloadElapsed / reloadDuration, 1) : 1;
      const amount = reloadAmount(t);
      if (t >= 1) {
        isReloading = false;
      }
      return { y: -amount * RELOAD_DIP_DISTANCE, rotX: -amount * RELOAD_TILT_ANGLE };
    }
```

- [ ] **Step 5: `update` 와 `triggerReload` 배선**

반환 객체의 `triggerRecoil` 아래에 `triggerReload` 를 더하고, `update` 를 바꾼다.

기존:
```js
      triggerRecoil() {
        recoilElapsed = 0;
        isRecoiling = true;
      },
      update(dt) {
        updateIdleSway(dt);
        if (isRecoiling) {
          updateRecoil(dt);
        }
      },
```
변경 후:
```js
      triggerRecoil() {
        recoilElapsed = 0;
        isRecoiling = true;
      },
      // seconds 를 받는 이유: 무기를 바꾸면 뷰모델이 새로 만들어지는데, 그때
      // 남은 시간으로 다시 걸어야 총이 혼자 멀쩡히 서 있지 않는다.
      triggerReload(seconds) {
        reloadElapsed = 0;
        reloadDuration = seconds;
        isReloading = seconds > 0;
      },
      update(dt) {
        updateIdleSway(dt);
        let yOffset = 0;
        let zOffset = 0;
        let rotXOffset = 0;
        if (isRecoiling) {
          const recoil = recoilOffset(dt);
          zOffset += recoil.z;
          rotXOffset += recoil.rotX;
        }
        if (isReloading) {
          const reload = reloadOffset(dt);
          yOffset += reload.y;
          rotXOffset += reload.rotX;
        }
        group.position.y += yOffset;
        group.position.z = basePosition.z + zOffset;
        group.rotation.x = baseRotation.x + rotXOffset;
      },
```

`updateIdleSway` 가 `position.y` 를 먼저 세우므로 `+=` 로 더한다. `position.z` 와 `rotation.x` 는 흔들림이 안 건드리므로 기준값에서 대입한다.

- [ ] **Step 6: 테스트와 빌드**

Run: `npm test`
Expected: 136 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/gameplay/weaponViewmodel.js
git commit -m "feat: add a reload motion to the weapon viewmodel

Recoil runs 0.15s and reload 0.8s, so they overlap. Recoil used to assign
rotation.x outright, which reload also wants, so both now return offsets
and update applies them once. Idle sway still owns position.y, so the
reload dip adds to it rather than replacing it."
```

---

### Task 7: 장전 배선

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes:
  - Task 4 의 `createReloadState(seconds) -> { start(), tick(dt), isReloading(), remaining(), reset() }`
  - Task 5 의 `input.setEnabled(enabled)`
  - Task 6 의 `weaponViewmodel.triggerReload(seconds)`
- Produces: 없음

- [ ] **Step 1: `CONFIG.reload` 추가**

`game/src/config.js` 에서 `scorePerGold: 10,` 바로 아래에 넣는다:

```js
  reload: {
    // 일반 총과 바주카포가 같은 값을 쓴다.
    seconds: 0.8,
  },
```

- [ ] **Step 2: 모듈 import 와 상태 생성**

`game/src/gameplay/game.js` 의 import 묶음에 더한다:

```js
import { createReloadState } from './reloadState.js';
```

그리고 Task 2 에서 넣은 `let settledScore = 0;` 바로 아래에:

```js
  const reload = createReloadState(CONFIG.reload.seconds);
```

- [ ] **Step 3: 발사할 때 장전 시작**

`handleShot` 의 끝, 무기별 분기 다음이다. 이 지점은 `phase !== 'playing'` 과 `!aimApplied` 가드를 이미 통과한 뒤라 실제로 발사가 일어난 경우에만 걸린다.

기존:
```js
    if (bazookaStore.getRounds() > 0) {
      handleBazookaShot(intersections);
    } else {
      handleWeaponShot(intersections);
    }
  }
```
변경 후:
```js
    if (bazookaStore.getRounds() > 0) {
      handleBazookaShot(intersections);
    } else {
      handleWeaponShot(intersections);
    }

    reload.start();
    weaponViewmodel.triggerReload(CONFIG.reload.seconds);
  }
```

`handleBazookaShot` 이 마지막 발에서 뷰모델을 교체하지만, 그 교체는 비동기(`swapWeaponViewmodel` 이 Promise 다)라 여기서는 아직 기존 뷰모델이다. 교체된 뒤의 처리는 Step 5 에서 한다.

- [ ] **Step 4: 프레임 루프에서 시간 깎고 입력 잠그기**

프레임 루프 콜백 `engine.start((dt) => {` 안, `lastKillEffect.update(dt);` 바로 아래에 넣는다:

```js
      reload.tick(dt);
      input.setEnabled(phase === 'playing' && !settingsOpen && !reload.isReloading());
```

설정이 열려 있을 때도 막는 게 맞다 — 패널 뒤로 조준이 걸리면 안 된다.

- [ ] **Step 5: 뷰모델 교체 시 남은 시간으로 다시 걸기**

`swapWeaponViewmodel` 을 바꾼다. 기존:

```js
  function swapWeaponViewmodel(weapon) {
    return loadWeaponViewmodel(engine.camera, weapon).then((next) => {
      if (weaponViewmodel) weaponViewmodel.dispose();
      weaponViewmodel = next;
    });
  }
```
변경 후:
```js
  function swapWeaponViewmodel(weapon) {
    return loadWeaponViewmodel(engine.camera, weapon).then((next) => {
      if (weaponViewmodel) weaponViewmodel.dispose();
      weaponViewmodel = next;
      // 바주카 마지막 발을 쏘면 여기가 장전 도중에 불린다. 남은 시간으로 다시
      // 걸지 않으면 새 총이 혼자 멀쩡히 서 있는다.
      if (reload.isReloading()) {
        weaponViewmodel.triggerReload(reload.remaining());
      }
    });
  }
```

- [ ] **Step 6: 판 시작 시 초기화**

`startGame()` 의 `settledScore = 0;` 아래에 넣는다:

```js
    reload.reset();
```

- [ ] **Step 7: 테스트와 빌드**

Run: `npm test`
Expected: 136 tests passed

Run: `npm run build`
Expected: 성공

- [ ] **Step 8: 커밋**

```bash
git add game/src/config.js game/src/gameplay/game.js
git commit -m "feat: gate firing behind a reload

handleShot starts the timer after the shot has actually dispatched, past
the phase and aimApplied guards, so a suppressed press does not lock the
player out.

swapWeaponViewmodel re-triggers the motion with the time still left,
because spending the last bazooka round rebuilds the viewmodel in the
middle of a reload and the fresh weapon would otherwise stand there
idle."
```

- [ ] **Step 9: 사용자 육안 확인 요청**

이 세션 환경에서는 브라우저 스크린샷이 실패한다. 다음을 사용자에게 확인해 달라고 요청한다 (직접 브라우저를 열려고 하지 말 것):

1. 한 발 쏘면 총이 내려갔다 올라오는 장전 모션이 보이는가
2. 장전 중에 눌러도 **확대가 안 되고** 레티클도 안 뜨는가
3. 장전이 끝나면 다시 쏠 수 있는가
4. 바주카포도 장전을 하는가, 마지막 발을 쏴서 총이 바뀔 때 새 총도 장전 자세를 이어받는가
5. 라운드를 클리어할 때 골드가 늘어나는가
6. 빗맞힘을 5번 넘겨도 게임이 안 끝나는가
7. `P` → `메뉴로` 로 메뉴에 나갈 수 있고, 기록 화면에 점수가 뜨는가
8. 라운드 도중에 나가면 그 라운드 점수는 골드로 안 바뀌는가

LAN 링크: `http://127.0.0.1:5173/` (`localhost` 는 다른 프로젝트 서버가 IPv6 쪽 5173을 잡고 있어서 안 된다)
