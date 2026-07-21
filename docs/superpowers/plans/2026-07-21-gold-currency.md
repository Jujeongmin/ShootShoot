# Gold Currency System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert each game-over's final score into permanently-saved gold (10 score = 1 gold), shown on the main menu, with the game-over screen's button now returning to the menu (showing the updated total) instead of restarting immediately.

**Architecture:** A new pure `currencyStore.js` module (mirrors the existing `createHighScoreStore`/`createSettingsStore` pattern) persists a running gold total to `localStorage`. `game.js` awards gold in `endGame()` and threads the current total into `screens.showMenu` every time the menu is (re)shown.

**Tech Stack:** No new dependencies.

**Spec:** [docs/superpowers/specs/2026-07-21-gold-currency-design.md](../specs/2026-07-21-gold-currency-design.md)

## Global Constraints

- Language is JavaScript (ES modules) only — no TypeScript.
- Conversion rate: `CONFIG.scorePerGold = 10` — gold awarded is `Math.floor(score / scorePerGold)`.
- `createCurrencyStore(storage, key)` never touches `window`/`localStorage` directly — storage is injected (same pattern as `createHighScoreStore`/`createSettingsStore`).
- The two pre-existing bugfixes in `game.js` (round-clear check inside the tick callback's `else` branch, not `handleShot`; `endGame()` reading `highScoreStore.get()` before `.submit()`) must survive this task's full rewrite of the file.
- Gold is awarded exactly once per game-over, based on that run's final score — never awarded mid-round.

---

### Task 1: Currency store module (pure, tested)

**Files:**
- Create: `game/src/gameplay/currencyStore.js`
- Test: `test/currencyStore.test.js`

**Interfaces:**
- Produces: `createCurrencyStore(storage, key) -> { get() -> number, earn(amount) -> number }`. `get()` returns `0` when nothing is stored. `earn(amount)` adds `amount` to the stored total, persists it, and returns the new total.

- [ ] **Step 1: Write the failing tests**

Create `test/currencyStore.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createCurrencyStore } from '../game/src/gameplay/currencyStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createCurrencyStore', () => {
  it('returns 0 when nothing stored', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    expect(store.get()).toBe(0);
  });

  it('earn() adds to the stored total and returns the new total', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    expect(store.earn(50)).toBe(50);
    expect(store.get()).toBe(50);
  });

  it('earn() accumulates across multiple calls', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(30);
    store.earn(20);
    expect(store.get()).toBe(50);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const store1 = createCurrencyStore(storage, 'test.gold');
    store1.earn(75);
    const store2 = createCurrencyStore(storage, 'test.gold');
    expect(store2.get()).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/currencyStore.test.js
```

Expected: FAIL — `game/src/gameplay/currencyStore.js` does not exist.

- [ ] **Step 3: Create `game/src/gameplay/currencyStore.js`**

```js
export function createCurrencyStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      const value = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isNaN(value) ? 0 : value;
    },
    earn(amount) {
      const next = this.get() + amount;
      storage.setItem(key, String(next));
      return next;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/currencyStore.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS (24 tests — the existing 20 plus these 4).

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/currencyStore.js test/currencyStore.test.js
git commit -m "feat: add currency store for persisted gold"
```

---

### Task 2: Menu gold display + game-over "return to menu" button

**Files:**
- Modify: `game/src/ui/screens.js`

**Interfaces:**
- Modifies: `showMenu(onStart, onSettings)` becomes `showMenu(onStart, onSettings, gold)` — displays "보유 골드: {gold}" text. `showGameOver({ score, highScore, isNewHighScore }, onRestart)` becomes `showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu)` — button label changes from "다시하기" to "메인 메뉴로"; the callback parameter is now expected to show the menu, not restart the round directly (Task 3 wires this).

- [ ] **Step 1: Modify `game/src/ui/screens.js`'s `showMenu` function**

Replace the existing `showMenu` function with this (everything else in the file — `overlay` setup, `clear`, `show`, `hide`, `button`, `showLoading`, the final `return` statement — stays exactly as it is; `showGameOver` is modified separately in Step 2):

```js
  function showMenu(onStart, onSettings, gold) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    const goldEl = document.createElement('p');
    goldEl.textContent = `보유 골드: ${gold}`;
    overlay.appendChild(goldEl);
    overlay.appendChild(button('시작하기', onStart));
    overlay.appendChild(button('설정', onSettings));
    show();
  }
```

- [ ] **Step 2: Modify `game/src/ui/screens.js`'s `showGameOver` function**

Replace the existing `showGameOver` function with this:

```js
  function showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '게임 종료';
    overlay.appendChild(title);
    const scoreEl = document.createElement('p');
    scoreEl.textContent = `점수: ${score}`;
    overlay.appendChild(scoreEl);
    const highScoreEl = document.createElement('p');
    highScoreEl.textContent = isNewHighScore ? `🎉 신기록! 최고점수: ${highScore}` : `최고점수: ${highScore}`;
    overlay.appendChild(highScoreEl);
    overlay.appendChild(button('메인 메뉴로', onReturnToMenu));
    show();
  }
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors. Note: `game.js` still calls the old `showMenu(startGame, openSettingsFromMenu)` (2 args) and `showGameOver({...}, startGame)` at this point — that's fine, JavaScript doesn't enforce arity, so `gold` will just be `undefined` (rendering "보유 골드: undefined") and clicking "메인 메뉴로" will call `startGame` directly (old behavior) until Task 3 rewires `game.js`. This is expected and will be fixed in Task 3 — don't try to fix it in this task.

- [ ] **Step 4: Commit**

```bash
git add game/src/ui/screens.js
git commit -m "feat: show gold on main menu, change game-over button to return to menu"
```

---

### Task 3: Wire gold earning and menu-return flow into `game.js`

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js` (full rewrite)

**Interfaces:**
- Consumes: `createCurrencyStore` (Task 1), the updated `showMenu(onStart, onSettings, gold)` / `showGameOver({...}, onReturnToMenu)` (Task 2).

- [ ] **Step 1: Add gold-related constants to `game/src/config.js`**

Add these two lines to the existing `CONFIG` object — `scorePerGold` as a new top-level field (alongside `missLimit`), and `currencyStorageKey` alongside `highScoreStorageKey`/`settingsStorageKey` (do not change anything else in the file):

```js
  scorePerGold: 10,
```

```js
  currencyStorageKey: 'shootshoot.gold',
```

- [ ] **Step 2: Replace `game/src/gameplay/game.js` entirely**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
import { createSettingsStore } from './settingsStore.js';
import { createCurrencyStore } from './currencyStore.js';
import { createEffects } from './effects.js';
import { loadMonkeyModel } from './monkeyModel.js';
import { loadRifleViewmodel } from './rifleViewmodel.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { createScreens } from '../ui/screens.js';
import { createScopeOverlay } from '../ui/scopeOverlay.js';
import { createSettingsPanel } from '../ui/settingsPanel.js';
import { CONFIG } from '../config.js';

function worldToScreen(position, camera, container) {
  const vector = position.clone().project(camera);
  const rect = container.getBoundingClientRect();
  return {
    x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
  };
}

function clampToUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const effects = createEffects(engine.scene);
  const hud = createHud(container);
  const screens = createScreens(container);
  const scopeOverlay = createScopeOverlay(container);
  const settingsPanel = createSettingsPanel(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const settingsStore = createSettingsStore(window.localStorage, CONFIG.settingsStorageKey);
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const raycaster = new THREE.Raycaster();

  let targetManager = null;
  let rifleViewmodel = null;
  let phase = 'menu';
  let scoreState = createScoreState();
  let round = 1;
  let timeRemaining = 0;
  let sensitivity = settingsStore.get().sensitivity;
  let settingsOpen = false;
  let settingsOrigin = null;

  function beginRound(roundNumber) {
    round = roundNumber;
    const roundParams = targetManager.spawnRound(roundNumber);
    timeRemaining = roundParams.timeLimit;
  }

  function startGame() {
    scoreState = createScoreState();
    phase = 'playing';
    beginRound(1);
    screens.hide();
    updateHud();
  }

  function returnToMenu() {
    screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
  }

  function endGame() {
    phase = 'gameover';
    targetManager.clear();
    const previousHighScore = highScoreStore.get();
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = scoreState.score > previousHighScore && scoreState.score > 0;
    const goldEarned = Math.floor(scoreState.score / CONFIG.scorePerGold);
    currencyStore.earn(goldEarned);
    screens.showGameOver({ score: scoreState.score, highScore, isNewHighScore }, returnToMenu);
  }

  function updateHud() {
    hud.render({
      score: scoreState.score,
      streak: scoreState.streak,
      round,
      timeRemaining: Math.max(timeRemaining, 0),
    });
  }

  function handleSensitivityChange(value) {
    sensitivity = value;
    settingsStore.set({ sensitivity });
  }

  function openSettingsFromMenu() {
    settingsOrigin = 'menu';
    screens.hide();
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings);
  }

  function openSettingsFromPlay() {
    if (phase !== 'playing' || settingsOpen) return;
    settingsOrigin = 'playing';
    settingsOpen = true;
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings);
  }

  function closeSettings() {
    settingsPanel.hide();
    if (settingsOrigin === 'menu') {
      screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
    } else {
      settingsOpen = false;
    }
    settingsOrigin = null;
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p') return;
    openSettingsFromPlay();
  });

  function handleShot() {
    if (phase !== 'playing') return;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
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

    const outcome = resolveShot(hits);
    const gained = calculateShotScore(outcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    let popupWorldPosition = null;
    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) {
        const worldPos = monkey.getWorldPosition();
        if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
        effects.spawnHitBurst(worldPos);
        monkey.hit(hit.part);
      }
    }

    if (outcome.isMiss) {
      sfx.miss();
    } else if (outcome.penetrationCount > 1) {
      sfx.combo();
    } else if (outcome.hits[0].part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }

    if (!outcome.isMiss && popupWorldPosition) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y);
    }

    updateHud();

    if (scoreState.misses >= CONFIG.missLimit) {
      endGame();
      return;
    }
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    screens.showLoading('로딩 중...');

    engine.start((dt) => {
      if (targetManager) {
        targetManager.update(dt);
      }
      if (rifleViewmodel) {
        rifleViewmodel.update(dt);
        rifleViewmodel.setVisible(!input.isAiming());
      }
      effects.update(dt);

      if (input.isAiming()) {
        const ndc = input.getNdc();
        const effectiveX = clampToUnit(ndc.x * sensitivity);
        const effectiveY = clampToUnit(ndc.y * sensitivity);
        engine.camera.rotation.y = -effectiveX * CONFIG.aim.lookLimitX;
        engine.camera.rotation.x = effectiveY * CONFIG.aim.lookLimitY;
        scopeOverlay.show();
      } else {
        engine.camera.rotation.set(0, 0, 0);
        scopeOverlay.hide();
      }

      if (phase === 'playing' && !settingsOpen) {
        timeRemaining -= dt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            beginRound(round + 1);
            updateHud();
          }
        }
      }

      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });

    Promise.all([loadMonkeyModel(), loadRifleViewmodel(engine.camera)]).then(
      ([monkeyModel, resolvedRifleViewmodel]) => {
        targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
        rifleViewmodel = resolvedRifleViewmodel;
        screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
      }
    );
  }

  return { start };
}
```

**Note on what changed vs. the pre-existing `game.js`:** (a) new import for `createCurrencyStore`; (b) `const currencyStore = createCurrencyStore(...)`; (c) new `returnToMenu()` function; (d) `endGame()` now computes `goldEarned` and calls `currencyStore.earn(goldEarned)` before showing the game-over screen, and passes `returnToMenu` instead of `startGame` as the game-over screen's callback; (e) all three `screens.showMenu(...)` call sites (initial load, `closeSettings`'s menu branch, and the new `returnToMenu`) now pass `currencyStore.get()` as the third argument. The round-clear check (inside the tick's `else` branch) and `endGame`'s high-score-tie fix are both preserved exactly as before — do not alter them.

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 4: Verify the full test suite still passes**

```bash
npm test
```

Expected: PASS (24 tests).

- [ ] **Step 5: Manually verify — full flow**

Run `npm run dev`. Confirm, in order:
1. On the start menu, "보유 골드: 0" is shown (first-ever visit, nothing earned yet).
2. Click "시작하기", play until game-over (let the timer run out or miss 5 shots). Note the final score shown.
3. Click "메인 메뉴로" — confirm you land back on the START MENU (not immediately back in a new round), and the gold total shown is `Math.floor(score / 10)` more than before (e.g. a 235-point run should add 23 gold).
4. Click "시작하기" again to start a fresh round from the menu — confirm score/round reset to a clean state.
5. Reload the page (full browser refresh) — confirm the gold total on the menu matches what was earned (persisted across reload).
6. Confirm settings (menu button and in-play P key) still work correctly (this task didn't touch that logic — just verify nothing regressed).

- [ ] **Step 6: Commit**

```bash
git add game/src/config.js game/src/gameplay/game.js
git commit -m "feat: award gold on game-over and return to menu instead of instant restart"
```

---

## Self-Review Notes

- **Spec coverage:** 전환 규칙(10점=골드1) → Task 3 (`Math.floor(scoreState.score / CONFIG.scorePerGold)`). 저장(`currencyStore.js`) → Task 1. 메인 메뉴 골드 표시 → Task 2 (`showMenu`) + Task 3 (wiring). 게임오버 버튼을 메인 메뉴로 변경 → Task 2 (`showGameOver`) + Task 3 (`returnToMenu`). — all covered.
- **Type consistency checked:** `createCurrencyStore(storage, key)`'s `{ get, earn }` (Task 1) is consumed with those exact method names in Task 3. `showMenu(onStart, onSettings, gold)` / `showGameOver({...}, onReturnToMenu)` (Task 2) match Task 3's call sites exactly (three-argument `showMenu` calls, `returnToMenu` passed as the game-over callback).
- **No placeholders:** every constant (conversion rate, storage key) has a concrete value. Task 2's intentional temporary inconsistency (old 2-arg `game.js` calling the new 3-arg `showMenu`) is explicitly called out with its expected (harmless) symptom, not left as an unexplained gap.
