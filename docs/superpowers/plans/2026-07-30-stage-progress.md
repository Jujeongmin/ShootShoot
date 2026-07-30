# 라운드 진행도와 이어하기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 깬 라운드를 판을 넘어 남기고, 메뉴에서 이어하기·라운드 선택·처음부터를 고를 수 있게 한다.

**Architecture:** 도달 라운드는 `localStorage` 스토어 하나가 갖고, 라운드 클리어 때 골드 정산과 같은 지점에서 저장된다. `startGame()` 이 시작 라운드를 인자로 받게 되고, 메뉴·라운드 선택 화면·새 게임이 각자 다른 값을 넘긴다. 새 게임은 최고점수와 설정 키만 남기고 스토리지를 비운 뒤 페이지를 새로고침한다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), 바닐라 DOM.

설계: [2026-07-30-stage-progress-design.md](../specs/2026-07-30-stage-progress-design.md)

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 180개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- UI는 `kit.js` 의 헬퍼(`scrim` `panel` `button` `iconButton` `title` `num` `TOKENS`)와 `theme.css` 클래스를 쓴다. **hex 를 손으로 박지 않는다.**
- 새 UI 모듈은 기존 모달 패턴(`settingsPanel.js`, `shopPanel.js`)을 따른다: `createXxx(container)` 가 `scrim()` 을 만들어 `container` 에 붙이고 `{ show, hide }` 를 돌려준다.
- **초반 라운드 반복 골드 파밍은 의도적으로 열어둔다.** 라운드 선택으로 낮은 라운드를 반복하는 것은 사용자가 택한 동작이다. 막지 말 것.
- 라운드에는 상한이 없다. 도달 라운드가 50, 100이 될 수 있다고 보고 UI를 만든다.
- 게임 화면·레이아웃은 이 환경에서 확인할 수 없다. 브라우저 창이 안 열린다. 육안 확인은 사용자가 한다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- 스토어 패턴: `createXStore(storage, key)` 가 객체를 돌려준다. **어떤 스토어도 메모리에 상태를 들고 있지 않다** — 호출할 때마다 `localStorage` 를 다시 읽는다.
- 스토리지 키는 `config.js` 맨 아래 여덟 줄(`highScoreStorageKey` ~ `tutorialStorageKey`)로 모여 있다.
- 스토어 테스트 패턴은 `test/currencyStore.test.js` 에 있다. 가짜 storage 를 `createMemoryStorage()` 로 만드는데 **`getItem`/`setItem` 만 있고 `removeItem` 이 없다.** 이 계획서의 스토어는 `removeItem` 을 쓰므로 가짜 storage 에 그것도 넣어야 한다.
- `kit.js` 의 `button(label, onClick, variant)` 은 `onClick` 을 `addEventListener('click', ...)` 으로 붙인다. **핸들러가 첫 인자로 `MouseEvent` 를 받는다.** 인자를 받는 함수를 그냥 넘기면 안 되고 화살표 함수로 감싸야 한다. variant 는 `'primary' | 'ghost' | 'off'` 셋뿐이고 모르는 값을 주면 던진다.
- `screens.js` 의 `showMenu(state, handlers)` 가 중앙에 `탭하여 시작` 버튼 하나와 힌트 한 줄을 그린다. 그 버튼의 인라인 스타일은 `width: 320px; font-size: 22px; padding: 14px 22px 10px;` 다.
- `game.js` 의 `menuHandlers` 객체가 `screens.showMenu` 로 넘어간다. `refreshMenu()` 가 `screens.showMenu(buildMenuState(), menuHandlers)` 를 부른다.
- `startGame()` 은 인자가 없고 `beginRound(1)` 로 고정돼 있다.
- 라운드 클리어 분기는 `if (targetManager.allCleared() && !projectiles.hasPending()) {` 이고 첫 줄이 `tutorial.handle('roundCleared');` 다. `currencyStore.earn(...)` 이 그 아래에 있다.
- `beginRound(roundNumber)` 가 `round = roundNumber` 로 모듈 변수 `round` 를 갱신한다.
- z-index: `screens.js` 20, `hud.js` 힌트 21, `settingsPanel.js`·`shopPanel.js` 25.
- 모달 닫기 버튼 패턴: `iconButton('cross', '닫기', onClose, 36)` 에 `position: absolute; top: -14px; right: -14px;` 를 얹는다.

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/progressStore.js` | 도달 라운드를 `localStorage` 에 남긴다 |
| `test/progressStore.test.js` | 위 모듈 테스트 |
| `game/src/gameplay/gameReset.js` | 새 게임이 지울 키 목록과 삭제 (순수) |
| `test/gameReset.test.js` | 위 모듈 테스트 |
| `game/src/ui/confirmPopup.js` | 되돌릴 수 없는 동작 앞에 세우는 얇은 모달 |
| `game/src/ui/roundSelect.js` | 라운드 숫자 격자 |

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/config.js` | `progressStorageKey` 추가 |
| `game/src/gameplay/game.js` | 스토어 생성, `startGame(round)`, 저장 지점, 메뉴 핸들러, 새 게임, 라운드 선택 |
| `game/src/ui/screens.js` | `showMenu` 중앙 버튼을 도달 라운드에 따라 바꾼다 |

**건드리지 않는 파일**

`difficulty.js`, `targetManager.js`, `scoring.js`, `shooting.js`, `input.js`, `reloadState.js`, `hud.js`, `tutorialState.js`, `tutorialStore.js`, `tutorialPrompt.js`, `kit.js`, `theme.css`.

---

### Task 1: 진행도 스토어

**Files:**
- Create: `game/src/gameplay/progressStore.js`
- Create: `test/progressStore.test.js`
- Modify: `game/src/config.js` (키 한 줄 추가)

**Interfaces:**
- Consumes: 없음. 이 모듈은 `storage` 와 `key` 만 안다.
- Produces: `createProgressStore(storage, key)` 가 `{ getReachedRound(), submitCleared(round), clear() }` 를 돌려준다. `getReachedRound()` 는 정수(최소 1), `submitCleared(round)` 는 저장된 새 값을 돌려준다, `clear()` 는 아무것도 안 돌려준다. Task 3 이 쓴다.
- Produces: `CONFIG.progressStorageKey === 'shootshoot.progress'`. Task 2·3 이 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/progressStore.test.js` 를 새로 만든다. 가짜 storage 에 `removeItem` 이 있어야 한다 — `test/currencyStore.test.js` 의 것에는 없으니 복사해 오면 안 된다.

```js
import { describe, it, expect } from 'vitest';
import { createProgressStore } from '../game/src/gameplay/progressStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe('createProgressStore', () => {
  it('returns round 1 when nothing is stored', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    expect(store.getReachedRound()).toBe(1);
  });

  it('submitCleared(n) makes the next round the reached round', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    expect(store.submitCleared(3)).toBe(4);
    expect(store.getReachedRound()).toBe(4);
  });

  it('keeps the highest reached round when a lower round is cleared again', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    store.submitCleared(9);
    expect(store.submitCleared(1)).toBe(10);
    expect(store.getReachedRound()).toBe(10);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    createProgressStore(storage, 'test.progress').submitCleared(5);
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(6);
  });

  it('clear() drops back to round 1', () => {
    const store = createProgressStore(createMemoryStorage(), 'test.progress');
    store.submitCleared(7);
    store.clear();
    expect(store.getReachedRound()).toBe(1);
  });

  it('falls back to round 1 when the stored value is not a number', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.progress', 'abc');
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(1);
  });

  it('falls back to round 1 when the stored value is below the first round', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.progress', '0');
    expect(createProgressStore(storage, 'test.progress').getReachedRound()).toBe(1);
  });
});
```

- [ ] **Step 2: 실패하는 걸 확인한다**

Run: `npx vitest run test/progressStore.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/progressStore.js"`

- [ ] **Step 3: 스토어를 만든다**

`game/src/gameplay/progressStore.js`:

```js
// 도달한 라운드를 판을 넘어 남긴다. 최고점수 스토어와 같은 "더 큰 값만 쓴다"
// 규칙이라, 라운드 선택으로 낮은 라운드를 다시 깨도 도달 라운드가 깎이지 않는다.
const FIRST_ROUND = 1;

export function createProgressStore(storage, key) {
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return FIRST_ROUND;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value) || value < FIRST_ROUND) return FIRST_ROUND;
    return value;
  }

  return {
    getReachedRound() {
      return read();
    },
    // 깬 라운드를 넣으면 그 다음 라운드가 도달 라운드가 된다.
    submitCleared(round) {
      const next = Math.max(read(), round + 1);
      storage.setItem(key, String(next));
      return next;
    },
    clear() {
      storage.removeItem(key);
    },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는 걸 확인한다**

Run: `npx vitest run test/progressStore.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: 키를 추가한다**

`game/src/config.js` 에서 `tutorialStorageKey` 줄 **아래에** 한 줄 넣는다. 기존 키 줄들은 손대지 않는다.

```js
  tutorialStorageKey: 'shootshoot.tutorial',
  progressStorageKey: 'shootshoot.progress',
};
```

- [ ] **Step 6: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 187 tests (180 + 7)

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/gameplay/progressStore.js test/progressStore.test.js game/src/config.js
git commit -m "feat: remember the round the player reached" -m "Leaving a run always restarted at round 1 because nothing recorded progress. The store keeps the highest value it has seen, so replaying an earlier round later cannot push the player backwards."
```

---

### Task 2: 새 게임이 지울 키 목록

**Files:**
- Create: `game/src/gameplay/gameReset.js`
- Create: `test/gameReset.test.js`

**Interfaces:**
- Consumes: `CONFIG` 의 `*StorageKey` 줄들 (Task 1 이 추가한 `progressStorageKey` 포함). 이 모듈은 `config.js` 를 import 하지 않고 인자로 받는다 — 그래야 가짜 config 로 테스트할 수 있다.
- Produces: `dataKeysToClear(config)` 가 문자열 배열을 돌려준다. `clearGameData(storage, keys)` 는 아무것도 안 돌려준다. Task 4 가 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/gameReset.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { dataKeysToClear, clearGameData } from '../game/src/gameplay/gameReset.js';
import { CONFIG } from '../game/src/config.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe('dataKeysToClear', () => {
  it('picks every storage key out of a config', () => {
    const config = {
      scorePerGold: 10,
      goldStorageKey: 'test.gold',
      weaponStorageKey: 'test.weapons',
      highScoreStorageKey: 'test.highscore',
      settingsStorageKey: 'test.settings',
    };
    expect(dataKeysToClear(config).sort()).toEqual(['test.gold', 'test.weapons']);
  });

  it('never includes the high score key', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.highScoreStorageKey);
  });

  it('never includes the settings key', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.settingsStorageKey);
  });

  it('includes the real gold, weapon, upgrade, bazooka, tutorial and progress keys', () => {
    const keys = dataKeysToClear(CONFIG);
    expect(keys).toContain(CONFIG.currencyStorageKey);
    expect(keys).toContain(CONFIG.weaponStorageKey);
    expect(keys).toContain(CONFIG.upgradeStorageKey);
    expect(keys).toContain(CONFIG.bazookaStorageKey);
    expect(keys).toContain(CONFIG.tutorialStorageKey);
    expect(keys).toContain(CONFIG.progressStorageKey);
  });

  it('ignores config entries that are not storage keys', () => {
    expect(dataKeysToClear(CONFIG)).not.toContain(CONFIG.scorePerGold);
  });
});

describe('clearGameData', () => {
  it('removes every key it is given and leaves the rest alone', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.gold', '500');
    storage.setItem('test.highscore', '9000');
    clearGameData(storage, ['test.gold']);
    expect(storage.getItem('test.gold')).toBe(null);
    expect(storage.getItem('test.highscore')).toBe('9000');
  });

  it('does not throw when a key was never stored', () => {
    const storage = createMemoryStorage();
    expect(() => clearGameData(storage, ['test.missing'])).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패하는 걸 확인한다**

Run: `npx vitest run test/gameReset.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/gameReset.js"`

- [ ] **Step 3: 모듈을 만든다**

`game/src/gameplay/gameReset.js`:

```js
// 새 게임은 기록과 조작 설정만 남기고 전부 지운다. 어떤 키를 지울지를 손으로
// 나열하면 나중에 스토어가 하나 늘 때 여기를 고치는 걸 잊는다. config 의 키 이름
// 규칙에서 뽑고 남길 것만 뺀다.
//
// 민감도를 남기는 이유: 그건 게임 진행이 아니라 조작 환경이다. 새 게임을 한다고
// 손에 익은 값을 다시 맞추게 할 이유가 없다.
const KEY_SUFFIX = 'StorageKey';
const KEEP = ['highScoreStorageKey', 'settingsStorageKey'];

export function dataKeysToClear(config) {
  return Object.keys(config)
    .filter((name) => name.endsWith(KEY_SUFFIX) && !KEEP.includes(name))
    .map((name) => config[name]);
}

export function clearGameData(storage, keys) {
  for (const key of keys) storage.removeItem(key);
}
```

- [ ] **Step 4: 테스트가 통과하는 걸 확인한다**

Run: `npx vitest run test/gameReset.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 194 tests

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/gameReset.js test/gameReset.test.js
git commit -m "feat: list the keys a new game wipes" -m "Naming the keys by hand would rot the moment another store is added, so the list is derived from the StorageKey suffix in config and only the high score is held back."
```

---

### Task 3: 시작 라운드를 인자로 받고 진행도를 저장한다

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `createProgressStore(storage, key)` 와 `CONFIG.progressStorageKey`.
- Produces: `startGame(round)` 가 라운드 번호를 받는다. Task 4·5 가 이 시그니처에 의존한다.

이 태스크에는 새 테스트가 없다. DOM·프레임 루프 배선이라 `hud.js`·`screens.js` 와 같은 취급이다 — 위 파일 구조표에 명시돼 있다. 기존 194개가 그대로 통과해야 한다.

- [ ] **Step 1: 스토어를 import 하고 만든다**

`game/src/gameplay/game.js` 의 import 블록에서 `createTutorialStore` 줄 **아래에** 넣는다:

```js
import { createTutorialStore } from './tutorialStore.js';
import { createProgressStore } from './progressStore.js';
```

스토어 생성부에서 `tutorialStore` 줄 **아래**, `tutorial` 줄 **위에** 넣는다. 기존 두 줄은 손대지 않는다.

before:
```js
  const tutorialStore = createTutorialStore(window.localStorage, CONFIG.tutorialStorageKey);
  const tutorial = createTutorialState();
```

after:
```js
  const tutorialStore = createTutorialStore(window.localStorage, CONFIG.tutorialStorageKey);
  const progressStore = createProgressStore(window.localStorage, CONFIG.progressStorageKey);
  const tutorial = createTutorialState();
```

- [ ] **Step 2: `startGame` 이 라운드를 받게 한다**

before:
```js
  function startGame() {
    projectiles.clear();
    scoreState = createScoreState();
    settledScore = 0;
    reload.reset();
    if (!tutorialStore.isDone()) tutorial.reset();
    phase = 'playing';
    beginRound(1);
    screens.hide();
    updateHud();
  }
```

after:
```js
  // 시작 라운드는 부르는 쪽이 정한다 — 이어하기는 도달 라운드를, 라운드 선택은
  // 고른 라운드를, 새 게임은 1을 넘긴다.
  function startGame(round) {
    projectiles.clear();
    scoreState = createScoreState();
    settledScore = 0;
    reload.reset();
    if (!tutorialStore.isDone()) tutorial.reset();
    phase = 'playing';
    beginRound(round);
    screens.hide();
    updateHud();
  }
```

- [ ] **Step 3: 메뉴의 시작 핸들러를 감싼다**

`menuHandlers` 의 `onStart` 는 지금 `startGame` 을 그대로 넘긴다. **`kit.js` 의 `button` 이 핸들러에 `MouseEvent` 를 넘기므로 그대로 두면 `round` 자리에 이벤트 객체가 들어간다.** 화살표 함수로 감싼다.

before:
```js
  const menuHandlers = {
    onStart: startGame,
```

after:
```js
  const menuHandlers = {
    // button() 이 핸들러에 MouseEvent 를 넘긴다. 감싸지 않으면 그게 라운드 번호
    // 자리로 들어간다.
    onStart: () => startGame(progressStore.getReachedRound()),
```

- [ ] **Step 4: 라운드 클리어에서 저장한다**

라운드 클리어 분기에서 `currencyStore.earn(...)` 줄 **바로 위에** 한 줄 넣는다. 골드 정산과 같은 순간이라 규칙이 하나가 된다.

before:
```js
          // 이 라운드에서 번 만큼만 지급한다. 도중에 나가면 정산을 안 하므로
          // 그 라운드 점수는 그대로 버려진다.
          currencyStore.earn(settlementGold(scoreState.score - settledScore, CONFIG.scorePerGold));
```

after:
```js
          // 골드 정산과 같은 순간에 진행도를 남긴다. 브라우저를 그냥 닫아도
          // 깬 라운드는 남는다.
          progressStore.submitCleared(round);
          // 이 라운드에서 번 만큼만 지급한다. 도중에 나가면 정산을 안 하므로
          // 그 라운드 점수는 그대로 버려진다.
          currencyStore.earn(settlementGold(scoreState.score - settledScore, CONFIG.scorePerGold));
```

- [ ] **Step 5: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 194 tests (변동 없음)

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: start from the round the player reached" -m "startGame hardcoded round 1, so every entry point had to begin there. Taking the round as an argument lets continue, round select and a new game each pick their own, and progress is written where gold already settles so closing the tab keeps it."
```

---

### Task 4: 메뉴의 이어하기와 처음부터

**Files:**
- Create: `game/src/ui/confirmPopup.js`
- Modify: `game/src/ui/screens.js` (`showMenu` 중앙 블록)
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `progressStore`, Task 2 의 `dataKeysToClear`/`clearGameData`, Task 3 의 `startGame(round)`.
- Produces: `createConfirmPopup(container)` 가 `{ show(text, onConfirm, onCancel), hide() }` 를 돌려준다. `text` 는 `{ heading, message, confirmLabel }`.
- Produces: `showMenu` 의 `state` 에 `reachedRound` 가, `handlers` 에 `onContinue`·`onNewGame` 이 생긴다. Task 5 가 같은 자리에 `onRoundSelect` 를 더한다.

이 태스크에도 새 테스트가 없다 — DOM 모듈이다.

- [ ] **Step 1: 확인 팝업 모듈을 만든다**

`game/src/ui/confirmPopup.js`:

```js
import { scrim, panel, button, title, TOKENS } from './kit.js';

// 되돌릴 수 없는 동작 앞에 세우는 얇은 모달. 무엇을 확인하는지는 부르는 쪽이
// 문구로 넘긴다 — 이 모듈은 새 게임을 모른다.
export function createConfirmPopup(container) {
  const overlay = scrim();
  // 메뉴(20)와 설정·상점(25) 위에 떠야 한다.
  overlay.style.zIndex = '30';
  container.appendChild(overlay);

  function show({ heading, message, confirmLabel }, onConfirm, onCancel) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'text-align: center; max-width: 360px;';
    box.appendChild(title(heading));

    const text = document.createElement('div');
    text.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 15px; margin: 10px 0 6px;`;
    text.textContent = message;
    box.appendChild(text);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; justify-content: center; gap: 12px; margin-top: 16px;';
    actions.appendChild(button(confirmLabel, onConfirm, 'primary'));
    actions.appendChild(button('취소', onCancel, 'ghost'));
    box.appendChild(actions);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 2: 메뉴 중앙 블록을 바꾼다**

`game/src/ui/screens.js` 의 `showMenu` 를 고친다. 구조 분해에 `reachedRound` 를 더하고 중앙 블록을 갈래로 나눈다. `topBar`·카드 세 줄은 손대지 않는다.

before:
```js
  function showMenu(state, handlers) {
    const {
      gold, damageLevel, damageCost, canAffordDamage,
      offlineLevel, offlineCost, canAffordOffline, bazookaRounds,
    } = state;
    clear();

    overlay.appendChild(topBar(gold, handlers));

    const centre = document.createElement('div');
    centre.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 14px;';
    const startBtn = button('탭하여 시작', handlers.onStart, 'primary');
    startBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
    centre.appendChild(startBtn);
    const hint = document.createElement('div');
    hint.textContent = '클릭하여 조준, 놓아서 발사!';
    hint.style.cssText = `color: ${TOKENS.grey}; font-size: 15px;`;
    centre.appendChild(hint);
    overlay.appendChild(centre);
```

after:
```js
  function showMenu(state, handlers) {
    const {
      gold, damageLevel, damageCost, canAffordDamage,
      offlineLevel, offlineCost, canAffordOffline, bazookaRounds, reachedRound,
    } = state;
    clear();

    overlay.appendChild(topBar(gold, handlers));

    const centre = document.createElement('div');
    centre.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 14px;';
    // 아직 아무것도 못 깬 플레이어에게 '이어하기'는 뜻이 없다. 그때는 예전처럼
    // 큰 버튼 하나만 둔다.
    if (reachedRound > 1) {
      const continueBtn = button(`이어하기 (라운드 ${reachedRound})`, handlers.onContinue, 'primary');
      continueBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
      centre.appendChild(continueBtn);
      const newGameBtn = button('처음부터', handlers.onNewGame, 'ghost');
      newGameBtn.style.cssText += 'width: 320px;';
      centre.appendChild(newGameBtn);
    } else {
      const startBtn = button('탭하여 시작', handlers.onStart, 'primary');
      startBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
      centre.appendChild(startBtn);
    }
    const hint = document.createElement('div');
    hint.textContent = '클릭하여 조준, 놓아서 발사!';
    hint.style.cssText = `color: ${TOKENS.grey}; font-size: 15px;`;
    centre.appendChild(hint);
    overlay.appendChild(centre);
```

- [ ] **Step 3: `game.js` 에 팝업과 리셋을 배선한다**

import 블록에서 `createSettingsPanel` 줄 **아래에** 넣는다:

```js
import { createConfirmPopup } from '../ui/confirmPopup.js';
```

`gameReset` 은 gameplay 쪽 import 들과 같이 둔다. `createProgressStore` 줄 **아래에**:

```js
import { dataKeysToClear, clearGameData } from './gameReset.js';
```

`settingsPanel` 을 만드는 줄 **아래에** 한 줄 넣는다:

before:
```js
  const settingsPanel = createSettingsPanel(container);
```

after:
```js
  const settingsPanel = createSettingsPanel(container);
  const confirmPopup = createConfirmPopup(container);
```

- [ ] **Step 4: 새 게임 함수 세 개를 더한다**

`returnToMenu` 함수 **아래에** 넣는다:

```js
  // 최고점수만 남기고 전부 지운다. 스토어들은 호출할 때마다 localStorage 를 다시
  // 읽지만 장착 무기 모델은 game.js 가 이미 로드해 들고 있다. 새로고침 한 줄이
  // 무기 재장착·HUD 갱신을 손으로 배선하는 것보다 확실하다.
  function wipeAndRestart() {
    clearGameData(window.localStorage, dataKeysToClear(CONFIG));
    window.location.reload();
  }

  function cancelNewGame() {
    confirmPopup.hide();
    refreshMenu();
  }

  // 되돌릴 수 없으므로 한 번 막는다.
  function askNewGame() {
    screens.hide();
    confirmPopup.show(
      {
        heading: '처음부터',
        message: '골드, 무기, 업그레이드, 라운드 진행도가 모두 지워집니다. 최고점수와 설정은 남습니다.',
        confirmLabel: '지우고 새로 시작',
      },
      wipeAndRestart,
      cancelNewGame
    );
  }
```

- [ ] **Step 5: 메뉴 핸들러와 상태에 연결한다**

`menuHandlers` 에 두 줄 더한다. `onStart` 는 도달 라운드가 1일 때만 쓰이지만 그대로 둔다.

before:
```js
  const menuHandlers = {
    // button() 이 핸들러에 MouseEvent 를 넘긴다. 감싸지 않으면 그게 라운드 번호
    // 자리로 들어간다.
    onStart: () => startGame(progressStore.getReachedRound()),
    onSettings: openSettingsFromMenu,
```

after:
```js
  const menuHandlers = {
    // button() 이 핸들러에 MouseEvent 를 넘긴다. 감싸지 않으면 그게 라운드 번호
    // 자리로 들어간다.
    onStart: () => startGame(progressStore.getReachedRound()),
    onContinue: () => startGame(progressStore.getReachedRound()),
    onNewGame: askNewGame,
    onSettings: openSettingsFromMenu,
```

`buildMenuState()` 가 돌려주는 객체에 한 줄 더한다.

before:
```js
      bazookaRounds: bazookaStore.getRounds(),
    };
  }
```

after:
```js
      bazookaRounds: bazookaStore.getRounds(),
      reachedRound: progressStore.getReachedRound(),
    };
  }
```

- [ ] **Step 6: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 194 tests (변동 없음)

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/ui/confirmPopup.js game/src/ui/screens.js game/src/gameplay/game.js
git commit -m "feat: offer continue and a fresh start on the menu" -m "The menu only ever had one start button, so a saved round had nowhere to appear. A player past round 1 now sees where they left off, and wiping is guarded by a confirm step because it cannot be undone. The wipe reloads the page since the equipped weapon model is already held in memory."
```

---

### Task 5: 라운드 선택 화면

**Files:**
- Create: `game/src/ui/roundSelect.js`
- Modify: `game/src/ui/screens.js` (`showMenu` 중앙 블록에 버튼 하나)
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1 의 `progressStore`, Task 3 의 `startGame(round)`, Task 4 가 만든 `showMenu` 의 `reachedRound`·`onContinue`·`onNewGame`.
- Produces: `createRoundSelect(container)` 가 `{ show(reachedRound, onPick, onClose), hide() }` 를 돌려준다. `onPick` 은 라운드 번호(정수)를 받는다.

이 태스크에도 새 테스트가 없다 — DOM 모듈이다.

- [ ] **Step 1: 라운드 선택 모듈을 만든다**

`game/src/ui/roundSelect.js`:

```js
import { scrim, panel, button, iconButton, title, TOKENS } from './kit.js';

const COLUMNS = 5;

// 깬 라운드를 다시 고를 수 있게 한다. 라운드에 상한이 없어서 도달 라운드까지만
// 그린다 — 잠긴 칸을 몇 개 보여줄지 정할 기준이 없다.
export function createRoundSelect(container) {
  const overlay = scrim();
  // 설정·상점과 같은 층이다.
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(reachedRound, onPick, onClose) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center; width: 420px; max-width: 90vw;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('라운드 선택'));

    const hint = document.createElement('div');
    hint.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 15px; margin: 8px 0 4px;`;
    hint.textContent = '깬 라운드를 다시 고를 수 있습니다.';
    box.appendChild(hint);

    // 라운드가 100개를 넘어도 패널은 화면에 고정돼야 한다. 격자 안에서만 스크롤한다.
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(${COLUMNS}, 1fr); gap: 8px;
      margin-top: 12px; max-height: 46vh; overflow-y: auto; padding: 4px;
    `;
    for (let round = 1; round <= reachedRound; round += 1) {
      // 지금 이어할 라운드만 채운 색으로 눈에 띄게 둔다.
      const variant = round === reachedRound ? 'primary' : 'ghost';
      grid.appendChild(button(String(round), () => onPick(round), variant));
    }
    box.appendChild(grid);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 2: 메뉴에 버튼을 더한다**

`game/src/ui/screens.js` 의 `showMenu` 안, Task 4 가 만든 `reachedRound > 1` 갈래에서 `newGameBtn` 을 붙이기 **전에** 넣는다.

before:
```js
      const newGameBtn = button('처음부터', handlers.onNewGame, 'ghost');
      newGameBtn.style.cssText += 'width: 320px;';
      centre.appendChild(newGameBtn);
```

after:
```js
      const selectBtn = button('라운드 선택', handlers.onRoundSelect, 'ghost');
      selectBtn.style.cssText += 'width: 320px;';
      centre.appendChild(selectBtn);
      const newGameBtn = button('처음부터', handlers.onNewGame, 'ghost');
      newGameBtn.style.cssText += 'width: 320px;';
      centre.appendChild(newGameBtn);
```

- [ ] **Step 3: `game.js` 에 배선한다**

import 블록에서 `createConfirmPopup` 줄 **아래에**:

```js
import { createRoundSelect } from '../ui/roundSelect.js';
```

`confirmPopup` 을 만드는 줄 **아래에**:

before:
```js
  const confirmPopup = createConfirmPopup(container);
```

after:
```js
  const confirmPopup = createConfirmPopup(container);
  const roundSelect = createRoundSelect(container);
```

- [ ] **Step 4: 라운드 선택 함수 세 개를 더한다**

Task 4 가 만든 `askNewGame` 함수 **아래에** 넣는다:

```js
  function openRoundSelect() {
    screens.hide();
    roundSelect.show(progressStore.getReachedRound(), pickRound, closeRoundSelect);
  }

  function pickRound(round) {
    roundSelect.hide();
    startGame(round);
  }

  function closeRoundSelect() {
    roundSelect.hide();
    refreshMenu();
  }
```

- [ ] **Step 5: 핸들러를 연결한다**

`menuHandlers` 의 `onNewGame` 줄 **아래에** 한 줄 더한다.

before:
```js
    onNewGame: askNewGame,
```

after:
```js
    onNewGame: askNewGame,
    onRoundSelect: openRoundSelect,
```

- [ ] **Step 6: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 194 tests (변동 없음)

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/ui/roundSelect.js game/src/ui/screens.js game/src/gameplay/game.js
git commit -m "feat: let the player pick a cleared round" -m "Continue only ever offers the furthest round, which leaves no way back to an easier one. The grid draws rounds up to the one reached and stops there, because rounds have no upper bound and there is no basis for deciding how many locked cells to show."
```

---

## 사용자 육안 확인 항목

이 환경에서는 브라우저 창이 안 열린다. 아래는 사용자가 `http://127.0.0.1:5174/` 에서 직접 본다.

- 새 플레이어(진행도 없음)에게 메뉴가 예전 그대로 `탭하여 시작` 하나만 보이는지
- 라운드를 하나 깨고 나갔을 때 `이어하기 (라운드 2)` 로 바뀌는지, 눌러서 라운드 2에서 시작하는지
- 세 버튼이 겹치거나 좌우 카드(상점·바주카·업그레이드)와 부딪히지 않는지
- `라운드 선택` 격자가 도달 라운드까지만 나오는지, 도달 라운드 칸만 색이 다른지, 라운드가 많아졌을 때 격자 안에서만 스크롤되는지
- `처음부터` → 확인 팝업 → `지우고 새로 시작` 이 골드·무기·업그레이드를 지우고 튜토리얼을 다시 띄우는지, 최고점수와 마우스 민감도는 남는지
- 확인 팝업의 `취소` 가 메뉴로 되돌아가는지
