# Aim Sensitivity Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player adjust aim (mouse-look) sensitivity via a slider, persisted across sessions, accessible from the main menu and via the P key during play (which pauses the round timer while open).

**Architecture:** A new pure `settingsStore.js` module (mirrors the existing `createHighScoreStore` pattern) persists `{ sensitivity }` to `localStorage`. A new DOM-only `settingsPanel.js` module renders the slider UI. `game.js` multiplies the mouse's NDC position by the current sensitivity (clamped back to `[-1, 1]`) before applying it to the existing look-limit-clamped camera rotation, so sensitivity changes how quickly the max look angle is reached without changing the max angle itself.

**Tech Stack:** No new dependencies.

**Spec:** [docs/superpowers/specs/2026-07-21-aim-sensitivity-settings-design.md](../specs/2026-07-21-aim-sensitivity-settings-design.md)

## Global Constraints

- Language is JavaScript (ES modules) only — no TypeScript.
- Sensitivity range: `0.5` to `2.0`, default `1.0`, slider step `0.1`.
- `createSettingsStore(storage, key)` never touches `window`/`localStorage` directly — storage is injected (same pattern as `createHighScoreStore`), keeping it pure and Vitest-testable.
- The two pre-existing bugfixes in `game.js` (round-clear check inside the tick callback's `else` branch, not `handleShot`; `endGame()` reading `highScoreStore.get()` before `.submit()`) must survive this task's full rewrite of the file.
- P key opens the settings panel only while `phase === 'playing'` — not from the menu (already has a button) or game-over screen (out of scope, YAGNI).

---

### Task 1: Settings store module (pure, tested)

**Files:**
- Create: `game/src/gameplay/settingsStore.js`
- Test: `test/settingsStore.test.js`

**Interfaces:**
- Produces: `createSettingsStore(storage, key) -> { get() -> { sensitivity: number }, set({ sensitivity }) }`. `get()` returns `{ sensitivity: 1.0 }` when nothing is stored, when the stored value is corrupted JSON, or when the stored `sensitivity` isn't a number.

- [ ] **Step 1: Write the failing tests**

Create `test/settingsStore.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createSettingsStore } from '../game/src/gameplay/settingsStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createSettingsStore', () => {
  it('returns default sensitivity when nothing stored', () => {
    const store = createSettingsStore(createMemoryStorage(), 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });

  it('persists and retrieves a set sensitivity', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage, 'test.settings');
    store.set({ sensitivity: 1.5 });
    expect(store.get()).toEqual({ sensitivity: 1.5 });
  });

  it('falls back to default when stored value is corrupted JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.settings', 'not valid json{{{');
    const store = createSettingsStore(storage, 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });

  it('falls back to default sensitivity when stored value has the wrong type', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.settings', JSON.stringify({ sensitivity: 'fast' }));
    const store = createSettingsStore(storage, 'test.settings');
    expect(store.get()).toEqual({ sensitivity: 1.0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/settingsStore.test.js
```

Expected: FAIL — `game/src/gameplay/settingsStore.js` does not exist.

- [ ] **Step 3: Create `game/src/gameplay/settingsStore.js`**

```js
const DEFAULT_SETTINGS = { sensitivity: 1.0 };

export function createSettingsStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      if (raw === null) return { ...DEFAULT_SETTINGS };
      try {
        const parsed = JSON.parse(raw);
        const sensitivity = typeof parsed.sensitivity === 'number' ? parsed.sensitivity : DEFAULT_SETTINGS.sensitivity;
        return { sensitivity };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },
    set(settings) {
      storage.setItem(key, JSON.stringify(settings));
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/settingsStore.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS (20 tests — the existing 16 plus these 4).

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/settingsStore.js test/settingsStore.test.js
git commit -m "feat: add settings store for persisted aim sensitivity"
```

---

### Task 2: Settings panel UI + menu button

**Files:**
- Create: `game/src/ui/settingsPanel.js`
- Modify: `game/src/ui/screens.js`
- Modify (temporary): `game/src/main.js` — for visual verification only, replaced in Task 3

**Interfaces:**
- Produces: `createSettingsPanel(container) -> { show(sensitivity, onChange, onClose), hide() }`.
- Modifies: `createScreens(container)`'s `showMenu(onStart)` becomes `showMenu(onStart, onSettings)` — adds a second "설정" button next to "시작하기".

- [ ] **Step 1: Create `game/src/ui/settingsPanel.js`**

```js
export function createSettingsPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function show(sensitivity, onChange, onClose) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '설정';
    overlay.appendChild(title);

    const label = document.createElement('p');
    label.textContent = `마우스 민감도: ${sensitivity.toFixed(1)}x`;
    overlay.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.5';
    slider.max = '2.0';
    slider.step = '0.1';
    slider.value = String(sensitivity);
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      label.textContent = `마우스 민감도: ${value.toFixed(1)}x`;
      onChange(value);
    });
    overlay.appendChild(slider);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    closeBtn.addEventListener('click', onClose);
    overlay.appendChild(closeBtn);

    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 2: Modify `game/src/ui/screens.js`'s `showMenu` function**

Replace the existing `showMenu` function with this (everything else in the file — `overlay` setup, `clear`, `show`, `hide`, `button`, `showGameOver`, `showLoading`, the final `return` statement — stays exactly as it is):

```js
  function showMenu(onStart, onSettings) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    overlay.appendChild(button('시작하기', onStart));
    overlay.appendChild(button('설정', onSettings));
    show();
  }
```

- [ ] **Step 3: Temporarily wire the panel into `game/src/main.js` to verify visually**

```js
import { createSettingsPanel } from './ui/settingsPanel.js';

const container = document.getElementById('app');
container.style.background = '#1a1a2e';
const panel = createSettingsPanel(container);

let sensitivity = 1.0;
panel.show(
  sensitivity,
  (value) => {
    sensitivity = value;
    console.log('sensitivity changed to', value);
  },
  () => {
    console.log('closed');
    panel.hide();
  }
);
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 5: Manually verify**

Run `npm run dev`, open the local URL. Confirm: a "설정" title, a "마우스 민감도: 1.0x" label, a slider, and a "닫기" button appear centered on screen. Drag the slider — confirm the label text updates live (e.g. to "마우스 민감도: 1.5x") and the browser console logs `sensitivity changed to <value>` for each change. Click "닫기" — confirm the console logs `closed` and the panel disappears.

- [ ] **Step 6: Commit**

```bash
git add game/src/ui/settingsPanel.js game/src/ui/screens.js game/src/main.js
git commit -m "feat: add settings panel UI and menu settings button"
```

---

### Task 3: Wire sensitivity and settings flow into `game.js`

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js` (full rewrite)
- Modify: `game/src/main.js` (restore to final form)

**Interfaces:**
- Consumes: `createSettingsStore` (Task 1), `createSettingsPanel` (Task 2), `showMenu(onStart, onSettings)` (Task 2).

- [ ] **Step 1: Add a settings storage key to `game/src/config.js`**

Add this one line to the existing `CONFIG` object, alongside `highScoreStorageKey` (do not change anything else in the file):

```js
  settingsStorageKey: 'shootshoot.settings',
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

  function endGame() {
    phase = 'gameover';
    targetManager.clear();
    const previousHighScore = highScoreStore.get();
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = scoreState.score > previousHighScore && scoreState.score > 0;
    screens.showGameOver({ score: scoreState.score, highScore, isNewHighScore }, startGame);
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
      screens.showMenu(startGame, openSettingsFromMenu);
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
        screens.showMenu(startGame, openSettingsFromMenu);
      }
    );
  }

  return { start };
}
```

**Note on what changed vs. the pre-existing `game.js`:** (a) new imports for `createSettingsStore`/`createSettingsPanel`; (b) `settingsPanel`/`settingsStore` instances, `sensitivity`/`settingsOpen`/`settingsOrigin` state; (c) `handleSensitivityChange`/`openSettingsFromMenu`/`openSettingsFromPlay`/`closeSettings` functions and a `keydown` listener for the `p` key; (d) the aim-camera-rotation block now multiplies `ndc.x`/`ndc.y` by `sensitivity` and clamps back to `[-1, 1]` via `clampToUnit` before applying the look-limit; (e) the round-timer block's condition gained `&& !settingsOpen`; (f) `screens.showMenu(startGame, openSettingsFromMenu)` passes the new second argument. The round-clear check (inside the tick's `else` branch) and `endGame`'s high-score-tie fix are both preserved exactly as before — do not alter them.

- [ ] **Step 3: Restore `game/src/main.js` to its final form**

```js
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 5: Verify the full test suite still passes**

```bash
npm test
```

Expected: PASS (20 tests).

- [ ] **Step 6: Manually verify — full flow**

Run `npm run dev`. Confirm, in order:
1. On the start menu, both "시작하기" and "설정" buttons are visible. Click "설정" — the settings panel appears (menu is hidden). Drag the slider, confirm the label updates. Click "닫기" — the menu reappears (not the game).
2. Click "시작하기" to start a round. Press the **P key** — the settings panel appears, the round timer visibly stops counting down (check the HUD), and you can't shoot (clicking does nothing while the panel is up). Click "닫기" — you're back in the round, the timer resumes counting down from where it paused.
3. Adjust sensitivity to a low value (e.g. 0.5x) via the menu settings, start a round, hold to aim, and move the mouse — confirm you need to move it much closer to the screen edge to reach the same maximum look angle as before. Set it to a high value (e.g. 2.0x) and confirm the opposite — reaching max rotation with much less mouse movement.
4. Reload the page (full browser refresh) — open settings again and confirm the sensitivity value you last set is still there (persisted).
5. Confirm round-advance-after-kill and the game-over/high-score flow both still work (this task didn't touch that logic — just verify nothing regressed).

- [ ] **Step 7: Commit**

```bash
git add game/src/config.js game/src/gameplay/game.js game/src/main.js
git commit -m "feat: wire aim sensitivity settings into game (menu + in-play P key)"
```

---

## Self-Review Notes

- **Spec coverage:** 민감도 적용 방식(클램프된 ndc 곱) → Task 3. 저장(`settingsStore.js`) → Task 1. 설정 패널 UI → Task 2. 메뉴 "설정" 버튼 → Task 2. P 키로 플레이 중 열기 + 일시정지 → Task 3. — all covered.
- **Type consistency checked:** `createSettingsStore(storage, key)`'s `{ get, set }` (Task 1) is consumed with those exact method names in Task 3. `createSettingsPanel(container)`'s `{ show(sensitivity, onChange, onClose), hide }` (Task 2) matches Task 3's call sites exactly (`settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings)`, `settingsPanel.hide()`). `showMenu(onStart, onSettings)`'s new second parameter (Task 2) is passed as `openSettingsFromMenu` in Task 3.
- **No placeholders:** every constant (range, default, storage key) has a concrete value. No open-ended "figure it out" steps.
