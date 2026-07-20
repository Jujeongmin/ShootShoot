# Scope Aim Camera & UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While aiming (holding the mouse to fire), the camera actually rotates toward the mouse position (within a limited range), a scope-style vignette + center reticle overlay appears, and shots always fire from screen-center (the reticle), not the raw mouse position.

**Architecture:** A new `scopeOverlay.js` DOM module renders the vignette/reticle, toggled by the same `input.isAiming()` poll `game.js` already uses for FOV zoom and rifle visibility. Camera rotation is derived directly from `input.getNdc()` (already tracked) each frame while aiming, clamped by two new config constants, and reset to zero the instant aiming stops. `handleShot` drops its `ndcX`/`ndcY` parameters and always raycasts from NDC `(0, 0)`, since the camera itself now points wherever the player aimed.

**Tech Stack:** No new dependencies — pure Three.js camera transforms + DOM/CSS for the overlay.

**Spec:** [docs/superpowers/specs/2026-07-20-scope-aim-camera-design.md](../specs/2026-07-20-scope-aim-camera-design.md)

## Global Constraints

- Language is JavaScript (ES modules) only — no TypeScript.
- Camera rotation while aiming is clamped to a fixed range (starting values: yaw `±0.3` rad, pitch `±0.2` rad) and resets to `(0, 0, 0)` the instant aiming stops — no smoothing/interpolation (YAGNI, per spec).
- Shots always raycast from screen-center NDC `(0, 0)` — `handleShot` no longer takes mouse-coordinate parameters.
- The two pre-existing bugfixes in `game.js` (round-clear check inside the tick callback's `else` branch, not `handleShot`; `endGame()` reading `highScoreStore.get()` before `.submit()`) must survive this task's full rewrite of the file — copy them forward exactly as they currently are.

---

### Task 1: Config constants + scope overlay UI module

**Files:**
- Modify: `game/src/config.js`
- Create: `game/src/ui/scopeOverlay.js`
- Modify (temporary): `game/src/main.js` — for visual verification only, replaced in Task 2

**Interfaces:**
- Produces: `createScopeOverlay(container) -> { show(), hide() }`. `CONFIG.aim.lookLimitX` / `CONFIG.aim.lookLimitY` (radians).

- [ ] **Step 1: Add look-limit constants to `game/src/config.js`**

Modify the existing `aim` block (do not touch anything else in the file):

```js
  aim: {
    normalFov: 60,
    aimFov: 35,
    lookLimitX: 0.3,
    lookLimitY: 0.2,
  },
```

- [ ] **Step 2: Create `game/src/ui/scopeOverlay.js`**

```js
export function createScopeOverlay(container) {
  const vignette = document.createElement('div');
  vignette.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; border-radius: 50%;
    box-shadow: 0 0 0 9999px #000;
    pointer-events: none; display: none; z-index: 12;
  `;
  container.appendChild(vignette);

  const reticle = document.createElement('div');
  reticle.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 24px; height: 24px; pointer-events: none; display: none; z-index: 13;
  `;
  reticle.innerHTML = `
    <div style="position:absolute; top:0; left:11px; width:2px; height:24px; background:#f00;"></div>
    <div style="position:absolute; left:0; top:11px; height:2px; width:24px; background:#f00;"></div>
  `;
  container.appendChild(reticle);

  function show() {
    vignette.style.display = 'block';
    reticle.style.display = 'block';
  }

  function hide() {
    vignette.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 3: Temporarily wire the overlay into `game/src/main.js` to verify visually**

```js
import { createScopeOverlay } from './ui/scopeOverlay.js';

const container = document.getElementById('app');
container.style.background = '#1a1a2e';
const scope = createScopeOverlay(container);

let visible = false;
setInterval(() => {
  visible = !visible;
  if (visible) scope.show();
  else scope.hide();
}, 1000);
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 5: Manually verify**

Run `npm run dev`, open the local URL in a browser. Confirm: every second, a black circular vignette (covering everything outside a centered circle roughly 70% of the viewport's shorter dimension) appears with a red crosshair (plus-sign) exactly at the center of the screen, then disappears, on a 1-second cycle. Confirm the crosshair stays centered regardless of browser window size/shape (resize the window and check it re-centers).

- [ ] **Step 6: Commit**

```bash
git add game/src/config.js game/src/ui/scopeOverlay.js game/src/main.js
git commit -m "feat: add scope vignette/reticle overlay UI and aim look-limit config"
```

---

### Task 2: Camera-follows-mouse aiming, center-screen shooting, scope overlay wiring

**Files:**
- Modify: `game/src/gameplay/game.js` (full rewrite)
- Modify: `game/src/main.js` (restore to final form)

**Interfaces:**
- Consumes: `createScopeOverlay` from `game/src/ui/scopeOverlay.js` (Task 1), `CONFIG.aim.lookLimitX`/`lookLimitY` (Task 1), `input.getNdc()` (pre-existing, `game/src/core/input.js`).

- [ ] **Step 1: Replace `game/src/gameplay/game.js` entirely**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
import { createEffects } from './effects.js';
import { loadMonkeyModel } from './monkeyModel.js';
import { loadRifleViewmodel } from './rifleViewmodel.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { createScreens } from '../ui/screens.js';
import { createScopeOverlay } from '../ui/scopeOverlay.js';
import { CONFIG } from '../config.js';

function worldToScreen(position, camera, container) {
  const vector = position.clone().project(camera);
  const rect = container.getBoundingClientRect();
  return {
    x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
  };
}

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const effects = createEffects(engine.scene);
  const hud = createHud(container);
  const screens = createScreens(container);
  const scopeOverlay = createScopeOverlay(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const raycaster = new THREE.Raycaster();

  let targetManager = null;
  let rifleViewmodel = null;
  let phase = 'menu';
  let scoreState = createScoreState();
  let round = 1;
  let timeRemaining = 0;

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
        engine.camera.rotation.y = -ndc.x * CONFIG.aim.lookLimitX;
        engine.camera.rotation.x = ndc.y * CONFIG.aim.lookLimitY;
        scopeOverlay.show();
      } else {
        engine.camera.rotation.set(0, 0, 0);
        scopeOverlay.hide();
      }

      if (phase === 'playing') {
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
        screens.showMenu(startGame);
      }
    );
  }

  return { start };
}
```

**Note on the camera rotation sign convention:** `rotation.y = -ndc.x * lookLimitX` and `rotation.x = ndc.y * lookLimitY` are derived from Three.js's standard rotation-matrix convention for a camera whose default forward is `-Z` (increasing `rotation.y` turns the view toward `-X`; increasing `rotation.x` tilts the view toward `+Y`, i.e. upward). **This must be visually confirmed in Step 3 below** — if moving the mouse right makes the view turn left (or moving it up makes the view turn down), both signs are backwards; flip the sign on the corresponding line (`rotation.y = ndc.x * ...` or `rotation.x = -ndc.y * ...`) and re-verify. Do not skip this check.

**Note on what changed vs. the pre-existing `game.js`:** (a) new `createScopeOverlay` import/instance; (b) `handleShot` no longer takes `ndcX`/`ndcY` parameters (they're unused now — `input.onAimUp(handleShot)` still passes them, but `handleShot` simply doesn't declare them) and its raycast always uses NDC `(0, 0)`; (c) the tick callback gains the aim-camera-rotation + scope-overlay-show/hide block, placed after the FOV-independent updates and before the round-timer logic. The round-clear check (inside the tick's `else` branch) and `endGame`'s high-score-tie fix are both carried forward unchanged — do not alter them.

- [ ] **Step 2: Restore `game/src/main.js` to its final form**

```js
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 4: Verify the existing Vitest suite is unaffected**

```bash
npm test
```

Expected: PASS (16 tests — this task touches no pure-logic module).

- [ ] **Step 5: Manually verify — full playthrough with camera aiming**

Run `npm run dev`. Confirm, in order:
1. Start a round. Hold the mouse down (without moving it) over the center of the screen — the scope vignette + reticle appear, the rifle disappears, FOV narrows.
2. While still holding, move the mouse to the right — **the 3D view should visibly turn/pan to the right** (revealing more of the scene to the right of where you started). Move it left, up, down and confirm the view pans in the matching direction each time. If any direction is reversed, fix the sign per the note in Step 1 and re-verify.
3. Move the mouse to an extreme corner while still holding — confirm the view stops rotating past a limited point (doesn't spin freely) — this is the clamp from `lookLimitX`/`lookLimitY`.
4. Release the mouse over a monkey — confirm the shot registers against whatever is under the center reticle at that moment (not wherever the raw cursor happens to be), the rifle reappears with recoil, and the view snaps back to center (no rotation) now that aiming has stopped.
5. Confirm scoring, headshot bonus, round advancement, and game-over/high-score flow all still work as before (this task didn't touch that logic, just verify nothing regressed).

If the look-limit range (`0.3`/`0.2` rad) feels too tight or too loose, adjust the constants in `config.js`'s `aim` block and re-verify — record whatever final values you land on.

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/game.js game/src/main.js
git commit -m "feat: camera follows mouse while aiming, center-screen shooting, scope overlay"
```

---

### Task 3: Final verification pass

**Files:** none created; verification only.

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all 16 tests PASS.

- [ ] **Step 2: Verify the production build**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 3: Verify the production build actually runs**

```bash
npm run preview
```

Open the printed local URL and repeat the Task 2 Step 5 playthrough checklist against the production build.

- [ ] **Step 4: Final commit (if any working-tree changes remain)**

```bash
git status
```

If clean, no commit needed.

---

## Self-Review Notes

- **Spec coverage:** 조준 카메라 회전(제한 범위) → Task 2. 조준 해제 시 즉시 복귀 → Task 2 (`else` branch resets to `(0,0,0)`). 발사 판정 화면 중앙 기준 → Task 2 (`handleShot`'s NDC `(0,0)` raycast). 스코프 UI(비넷+레티클) → Task 1. 총 뷰모델과의 관계(조준 중 숨김) → unchanged, already correct in the pre-existing code, verified still present in Task 2's full rewrite. — all covered.
- **Type consistency checked:** `createScopeOverlay(container)`'s returned `{ show, hide }` (Task 1) is consumed with those exact method names in Task 2's `game.js`. `CONFIG.aim.lookLimitX`/`lookLimitY` (Task 1) are read with those exact property names in Task 2.
- **No placeholders:** every constant has a concrete starting value. The one genuine uncertainty (rotation sign convention, look-limit feel) is called out explicitly as a required manual verification step with a precise pass/fail check ("does the view turn the same direction you moved the mouse"), not an open-ended "figure it out."
