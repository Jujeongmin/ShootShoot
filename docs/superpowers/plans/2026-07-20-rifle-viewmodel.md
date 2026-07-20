# Rifle Viewmodel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a screen-fixed first-person rifle viewmodel: visible bottom-right during normal play, hidden while aiming (holding to look through the scope), with idle sway and a firing-recoil animation.

**Architecture:** A new `rifleViewmodel.js` module loads the rifle GLB once (in parallel with the monkey model, at game bootstrap) and attaches it as a child of the camera — since the camera never moves (only its FOV changes for aim-zoom), a camera-child object stays screen-fixed automatically, with no separate overlay scene/camera needed. `game.js` polls `input.isAiming()` every frame (the same pattern it already uses for the FOV zoom) to toggle the viewmodel's visibility, and triggers its recoil animation from inside `handleShot`.

**Tech Stack:** Three.js `GLTFLoader` (already ships inside the installed `three` package's `examples/jsm/` — this GLB uses no Draco/meshopt compression, so no extra decoder setup is needed). No new npm dependencies.

**Spec:** [docs/superpowers/specs/2026-07-20-rifle-viewmodel-design.md](../specs/2026-07-20-rifle-viewmodel-design.md)

## Global Constraints

- The asset is currently at `game/public/Rifle by Quaternius - cCAgiMOQow.glb` (untracked, user-provided) and must be moved to `game/public/models/rifle.glb` as part of this work.
- Language is JavaScript (ES modules) only — no TypeScript.
- Exactly one rifle viewmodel instance ever exists (no cloning/pooling needed, unlike the monkey model).
- **Verified technical facts this plan's code depends on** (established by loading the GLB with `GLTFLoader.parse()` in a throwaway Node script before writing this plan):
  - 5 static meshes (materials: `Detail`, `ScopeHandle`, `Main`, `Barrel`, `Glass`), zero animations.
  - Native bounding box: `min = {x:-0.315, y:-0.669, z:-6.584}`, `max = {x:0.315, y:1.800, z:2.270}`, `size = {x:0.630, y:2.469, z:8.854}`.
  - No Draco/meshopt compression extensions — a plain `new GLTFLoader().loadAsync(url)` works with no extra decoder configuration.
  - **Unlike the monkey model, there is no reliable real-world-unit anchor for this asset's scale** (no skeleton/bones to cross-reference). The starting `SCALE`/position constants below are a reasoned estimate, not a verified measurement, and this plan includes an explicit visual-tuning checkpoint for them.

---

### Task 1: Rifle viewmodel module (load, position, idle sway, recoil)

**Files:**
- Move: `game/public/Rifle by Quaternius - cCAgiMOQow.glb` → `game/public/models/rifle.glb`
- Create: `game/src/gameplay/rifleViewmodel.js`
- Modify (temporary): `game/src/main.js` — for visual verification only, replaced in Task 2

**Interfaces:**
- Produces: `loadRifleViewmodel(camera: THREE.Camera) -> Promise<{ setVisible(visible: boolean), triggerRecoil(), update(dt) }>`. Internally attaches the loaded model as a child of `camera`, so callers don't need to add it to any scene themselves.

- [ ] **Step 1: Move the asset file**

```bash
mkdir -p game/public/models
mv "game/public/Rifle by Quaternius - cCAgiMOQow.glb" game/public/models/rifle.glb
ls game/public/models/
```

Expected output: `rifle.glb`

- [ ] **Step 2: Create `game/src/gameplay/rifleViewmodel.js`**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = '/models/rifle.glb';
const SCALE = 0.08;
const BASE_POSITION = { x: 0.4, y: -0.3, z: -0.7 };
const IDLE_SWAY_Y_AMPLITUDE = 0.01;
const IDLE_SWAY_X_AMPLITUDE = 0.005;
const RECOIL_DURATION = 0.15;
const RECOIL_KICK_DISTANCE = 0.08;
const RECOIL_KICK_ANGLE = 0.15;

export function loadRifleViewmodel(camera) {
  const loader = new GLTFLoader();
  return loader.loadAsync(MODEL_URL).then((gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);
    group.scale.setScalar(SCALE);
    group.position.set(BASE_POSITION.x, BASE_POSITION.y, BASE_POSITION.z);
    camera.add(group);

    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;

    function updateIdleSway(dt) {
      elapsed += dt;
      group.position.y = BASE_POSITION.y + Math.sin(elapsed * 1.5) * IDLE_SWAY_Y_AMPLITUDE;
      group.position.x = BASE_POSITION.x + Math.sin(elapsed * 0.8) * IDLE_SWAY_X_AMPLITUDE;
    }

    function updateRecoil(dt) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      group.position.z = BASE_POSITION.z + kick * RECOIL_KICK_DISTANCE;
      group.rotation.x = -kick * RECOIL_KICK_ANGLE;
      if (t >= 1) {
        isRecoiling = false;
      }
    }

    return {
      setVisible(visible) {
        group.visible = visible;
      },
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
    };
  });
}
```

- [ ] **Step 3: Temporarily wire the viewmodel into `game/src/main.js` to verify visually**

```js
import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadRifleViewmodel } from './gameplay/rifleViewmodel.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let rifle = null;
loadRifleViewmodel(engine.camera).then((viewmodel) => {
  rifle = viewmodel;
  window.rifle = viewmodel;
});

engine.start((dt) => {
  if (rifle) rifle.update(dt);
});
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 5: Manually verify — this is the scale/position tuning checkpoint**

Run `npm run dev`, open the local URL in a browser. Confirm:
- The rifle appears in the bottom-right area of the screen, at a plausible viewmodel size (clearly recognizable as a rifle, not microscopic or so huge it fills most of the screen).
- No console errors, no 404 for `/models/rifle.glb`.
- Very subtle idle sway is visible (don't expect much — the amplitudes are intentionally small).
- Open the browser devtools console and run `window.rifle.setVisible(false)` — the rifle should disappear. Run `window.rifle.setVisible(true)` — it reappears.
- Run `window.rifle.triggerRecoil()` — the rifle should kick back briefly (~0.15s) and return to its resting position.

**If the scale or position looks wrong** (too big/small, off-screen, barrel pointing the wrong way, etc.), adjust the `SCALE`, `BASE_POSITION`, and if needed add a `group.rotation.y = Math.PI;` line (180° turn, in case the model's "front" faces away from the camera) directly in `rifleViewmodel.js`, then repeat this step until it looks right. Record the final values you land on in your task report — the exact numbers matter less than the fact that it visually reads as "a rifle held in front of the camera, bottom-right."

- [ ] **Step 6: Commit**

```bash
git add game/public/models/rifle.glb game/src/gameplay/rifleViewmodel.js game/src/main.js
git commit -m "feat: add rifle viewmodel module with idle sway and recoil"
```

(Note: `git status` will also show `game/public/Rifle by Quaternius - cCAgiMOQow.glb` as deleted — since it was never tracked by git, there is nothing to stage for its removal; `mv` in Step 1 already made it disappear from the working tree.)

---

### Task 2: Wire the rifle viewmodel into `game.js`

**Files:**
- Modify: `game/src/gameplay/game.js` (full rewrite)
- Modify: `game/src/main.js` (restore to final form, undoing Task 1's temporary wiring)

**Interfaces:**
- Consumes: `loadRifleViewmodel` from `game/src/gameplay/rifleViewmodel.js` (Task 1).

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

  function handleShot(ndcX, ndcY) {
    if (phase !== 'playing') return;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, engine.camera);
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

**Note on what changed vs. the pre-existing `game.js`:** (a) new import for `loadRifleViewmodel`; (b) `let rifleViewmodel = null;` alongside the existing `targetManager` declaration; (c) `handleShot` calls `rifleViewmodel.triggerRecoil()` right after `sfx.shoot()` — no null-guard needed here, since `handleShot` can only run with `phase === 'playing'`, which is only reachable after both `Promise.all` loads resolve; (d) the tick callback gains a guarded block that updates the viewmodel and syncs its visibility to `!input.isAiming()` (mirroring the existing `engine.setFov(input.isAiming() ? ...)` line right below it); (e) `start()`'s loading step now `Promise.all`s both the monkey model and the rifle viewmodel before showing the menu. Everything else — the round-clear check placement, the `endGame` high-score-tie fix, `classifyHit`-based hit detection — is unchanged from the previous version; do not alter it.

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

- [ ] **Step 5: Manually verify — full playthrough**

Run `npm run dev`. Confirm, in order:
1. Loading screen, then menu (as before — rifle loading is now part of the same `Promise.all` gate, so the loading screen may take slightly longer).
2. Click "시작하기" — the rifle is visible bottom-right during normal play.
3. Hold the mouse to aim — the rifle disappears (scope zoom takes over), the crosshair/FOV narrows as before.
4. Release to fire — the rifle reappears already mid-recoil (kicks back, returns to rest), a monkey is hit or missed as before, scoring/SFX/particles/popup all work exactly as before.
5. Play through a full round transition and a game-over — confirm nothing from the monkey-model or state-machine work regressed.

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/game.js game/src/main.js
git commit -m "feat: wire rifle viewmodel into game state machine (aim-hide, recoil)"
```

---

## Self-Review Notes

- **Spec coverage:** 단일 인스턴스 로딩(원숭이와 병렬) → Task 2. 카메라 자식 오브젝트로 화면 고정 → Task 1. 배치/스케일(우하단, 실측 근거 없어 시각 조정 필요) → Task 1 Step 5. 조준 시 숨김(`input.isAiming()` 폴링, 기존 FOV 로직과 동일 패턴) → Task 2. 아이들 흔들림 & 발사 반동 → Task 1. 파일 이동(공백 제거) → Task 1 Step 1. — all covered.
- **Type consistency checked:** `loadRifleViewmodel(camera)`'s resolved shape `{ setVisible, triggerRecoil, update }` is defined in Task 1 and consumed with those exact method names in Task 2's `game.js`. `Promise.all([loadMonkeyModel(), loadRifleViewmodel(engine.camera)])`'s destructured result order (`[monkeyModel, resolvedRifleViewmodel]`) matches the array order.
- **No placeholders:** every constant has a concrete starting value; the one genuinely unverified area (scale/position "feel") is called out explicitly as a manual visual-tuning checkpoint with concrete pass/fail criteria (Task 1 Step 5), not left as an open-ended "figure it out."
