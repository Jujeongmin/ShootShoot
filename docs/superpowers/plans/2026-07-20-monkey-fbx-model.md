# Monkey FBX Model Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the procedurally-built primitive monkey (`game/src/gameplay/monkey.js`) with the user-supplied rigged/animated `monkey.FBX` model, while keeping every other module's interface with `monkey.js` unchanged (except one additive method, `classifyHit`).

**Architecture:** A new `monkeyModel.js` module loads the FBX + textures once (memoized async load) and produces independent clones (via `SkeletonUtils.clone` + explicit material cloning) on demand. `monkey.js` keeps its existing animation-state-machine (idle bob/sway/taunt, hit knockback/fade) applied to a wrapping `group`, but now also drives a `THREE.AnimationMixer` playing the model's own baked-in animation clip, and determines headshot/bodyshot by the local-space height of the raycast hit point (not by pre-tagged mesh names, since the model is a single multi-material `SkinnedMesh`). `game.js` gains a loading gate (shows a "로딩 중..." screen until the model is ready) before the menu appears.

**Tech Stack:** Three.js `FBXLoader` + `SkeletonUtils` (both already ship inside the installed `three` package's `examples/jsm/`), new npm dependency `fflate` (required by `FBXLoader` for compressed binary FBX parsing).

**Spec:** [docs/superpowers/specs/2026-07-20-monkey-fbx-model-design.md](../specs/2026-07-20-monkey-fbx-model-design.md)

## Global Constraints

- The asset lives at `game/public/textures/Monkey_animated/` (already present: `monkey.FBX`, `body_u1_v1.png`, `body_u2_v1.png`, `head_u1_v1.png`, `eyes_u2_v1.png`, `NormalMap.png`, `NormalMap2.png`, `NormalMap3.png`) — this is a one-time exception to the original project's "no external asset files" constraint, scoped to the monkey model only.
- `game/public/textures/Monkey/` (the redundant static, non-animated duplicate) must be deleted.
- Language is JavaScript (ES modules) only — no TypeScript.
- `createMonkey(...)`'s existing return interface (`{ id, group, getRaycastMeshes(), update(dt), hit(part), isDead(), getWorldPosition(target?) }`) must be preserved; this plan only *adds* `classifyHit(worldPoint)` to it.
- **Verified technical facts this plan's code depends on** (established by directly loading the FBX with `FBXLoader` in a throwaway Node script before writing this plan — see spec's "열린 위험" section, now resolved):
  - The model is a single `SkinnedMesh` with 4 materials: `"ee"` (map: `eyes_u2_v1.png`), `"tail2"` (map: `body_u2_v1.png`, bumpMap: `NormalMap3.png`), `"matd"` (map: `body_u1_v1.png`, bumpMap: `NormalMap2.png`), `"monkey_head"` (map: `head_u1_v1.png`, bumpMap: `NormalMap.png`).
  - `FBXLoader` resolves these textures automatically by filename relative to the FBX's own URL — since the texture files sit in the same folder as `monkey.FBX`, **no manual texture reassignment is needed**; a plain `loader.loadAsync('/textures/Monkey_animated/monkey.FBX')` wires every material correctly.
  - Exactly one animation clip exists: name `"Take 001"`, duration `3.1667`s.
  - Native (pre-scale) bounding box: `min = {x: -82.087, y: -0.5295, z: -105.222}`, `max = {x: 73.455, y: 175.376, z: 54.959}`, `size = {x: 155.541, y: 175.906, z: 160.180}`.
  - The model is authored in centimeters; `scale = 0.01` converts it to the game's meter-scale world (final height ≈ 1.759m).
  - The skeleton's `b_Neck` bone sits at native Y ≈ 129.14, which is ≈73% of the model's total native height (175.906) measured from its native minimum Y (-0.5295) — this fixes the head/body raycast cutoff at native local Y `127.88` (derivation: `-0.5295 + 0.73 * 175.906 ≈ 127.88`).

---

### Task 1: Add `fflate` dependency, remove redundant static asset folder

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Delete: `game/public/textures/Monkey/` (entire folder — 8 files: `monkey.FBX`, `body_u1_v1.png`, `body_u2_v1.png`, `head_u1_v1.png`, `eyes_u2_v1.png`, `NormalMap.png`, `NormalMap2.png`, `NormalMap3.png`)

**Interfaces:** none (no code yet)

- [ ] **Step 1: Install `fflate`**

```bash
npm install fflate
```

Expected: `package.json` gains a `"fflate": "^..."` line under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Delete the redundant static (non-animated) monkey folder**

```bash
git rm -r game/public/textures/Monkey
```

Expected: removes the 8 files under `game/public/textures/Monkey/`. Confirm `game/public/textures/Monkey_animated/` (the one this plan actually uses) is untouched:

```bash
ls game/public/textures/Monkey_animated/
```

Expected output: `NormalMap.png  NormalMap2.png  NormalMap3.png  body_u1_v1.png  body_u2_v1.png  eyes_u2_v1.png  head_u1_v1.png  monkey.FBX`

- [ ] **Step 3: Verify build still succeeds**

```bash
npm run build
```

Expected: succeeds with no errors (this task doesn't touch any source module, just deps/assets).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fflate dependency, remove redundant static monkey asset"
```

(The `git rm` from Step 2 is already staged; include it in the same commit.)

---

### Task 2: Monkey model loader/cache module

**Files:**
- Create: `game/src/gameplay/monkeyModel.js`

**Interfaces:**
- Produces: `loadMonkeyModel() -> Promise<{ template: THREE.Group, clip: THREE.AnimationClip }>` (memoized — repeated calls return the same cached promise, only fetches once). `cloneMonkeyModel(template) -> THREE.Group` (returns an independent clone: cloned skeleton/bones via `SkeletonUtils.clone`, independently-cloned materials on every mesh, positioned/scaled so the character's feet sit at local `(0,0,0)` and it's horizontally centered).

- [ ] **Step 1: Create `game/src/gameplay/monkeyModel.js`**

```js
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MODEL_URL = '/textures/Monkey_animated/monkey.FBX';
const MODEL_SCALE = 0.01;
const RECENTER_OFFSET = { x: 0.0432, y: 0.0053, z: 0.2513 };

let cachedModelPromise = null;

export function loadMonkeyModel() {
  if (!cachedModelPromise) {
    const loader = new FBXLoader();
    cachedModelPromise = loader.loadAsync(MODEL_URL).then((fbx) => {
      return { template: fbx, clip: fbx.animations[0] };
    });
  }
  return cachedModelPromise;
}

export function cloneMonkeyModel(template) {
  const cloned = cloneSkeleton(template);
  cloned.traverse((child) => {
    if (child.isMesh) {
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone();
    }
  });
  cloned.scale.setScalar(MODEL_SCALE);
  cloned.position.set(RECENTER_OFFSET.x, RECENTER_OFFSET.y, RECENTER_OFFSET.z);
  return cloned;
}
```

- [ ] **Step 2: Temporarily wire one clone into `game/src/main.js` to verify visually**

```js
import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadMonkeyModel, cloneMonkeyModel } from './gameplay/monkeyModel.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let mixer = null;

loadMonkeyModel().then(({ template, clip }) => {
  const instance = cloneMonkeyModel(template);
  instance.position.z = -4;
  engine.scene.add(instance);

  mixer = new THREE.AnimationMixer(instance);
  if (clip) mixer.clipAction(clip).play();
});

engine.start((dt) => {
  if (mixer) mixer.update(dt);
});
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors (confirms the `FBXLoader`/`SkeletonUtils` import paths resolve correctly under Vite).

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open the local URL in a browser. Confirm:
- The monkey model renders (textured, not a missing-texture magenta/checkerboard placeholder) standing on/near the front platform, at a plausible size (roughly human-to-large-primate scale, clearly visible, not microscopic or gigantic).
- Its embedded animation plays (some part of the body moves — even if it's a walk/idle cycle you didn't design, confirm *something* is animating via the skeleton, not a frozen static pose).
- No console errors (especially no 404s for the texture files — if you see 404s for `body_u1_v1.png` etc., the `MODEL_URL` path or the files' actual location under `game/public/` doesn't match; double check `game/public/textures/Monkey_animated/` exists with all 8 files after Task 1's cleanup).

If the model appears at a wildly wrong scale or orientation (e.g., sideways, upside down, or absurdly large/small), note the specific problem in your task report — do not silently "fix" it by guessing; this task's job is to confirm the computed `MODEL_SCALE`/`RECENTER_OFFSET` constants (derived from real inspection data, see this plan's Global Constraints) produce a reasonable result, and flag it if they don't.

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/monkeyModel.js game/src/main.js
git commit -m "feat: add monkey FBX model loader/cache module"
```

---

### Task 3: Rewrite `monkey.js` to use the loaded model

**Files:**
- Modify: `game/src/gameplay/monkey.js` (full rewrite)

**Interfaces:**
- Consumes: `cloneMonkeyModel` from `game/src/gameplay/monkeyModel.js` (Task 2).
- Produces: `createMonkey({ id, position, scale, speed, template, clip }) -> { id, group, getRaycastMeshes(), classifyHit(worldPoint), update(dt), hit(part), isDead(), getWorldPosition(target?) }`. New in this task: the `template`/`clip` parameters (the resolved object from `loadMonkeyModel()`, threaded in by the caller — Task 4 wires this from `targetManager.js`) and the `classifyHit(worldPoint)` method (takes a **world-space** `THREE.Vector3`, typically a raycast intersection's `.point`, and returns `'head'` or `'body'`).

- [ ] **Step 1: Replace `game/src/gameplay/monkey.js` entirely**

```js
import * as THREE from 'three';
import { cloneMonkeyModel } from './monkeyModel.js';

const HIT_ANIMATION_DURATION = 0.6;
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;
const HEAD_CUTOFF_LOCAL_Y = 127.88;

export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip }) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.scale.setScalar(scale);

  const model = cloneMonkeyModel(template);
  group.add(model);

  let raycastMesh = null;
  const materials = [];
  model.traverse((child) => {
    if (child.isMesh) {
      raycastMesh = child;
      child.userData = { monkeyId: id };
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      materials.push(...mats);
    }
  });

  const mixer = new THREE.AnimationMixer(model);
  if (clip) {
    mixer.clipAction(clip).play();
  }

  const state = {
    phase: 'idle',
    phaseOffset: Math.random() * Math.PI * 2,
    elapsed: 0,
    hitElapsed: 0,
    nextTauntAt: TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN),
    tauntElapsed: 0,
    isTaunting: false,
    dead: false,
  };

  function updateIdle(dt) {
    state.elapsed += dt;

    const bob = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.08;
    group.position.y = position.y + bob;

    const sway = Math.sin(state.elapsed * speed + state.phaseOffset) * 0.5;
    group.position.x = position.x + sway;

    if (state.isTaunting) {
      state.tauntElapsed += dt;
      group.rotation.y = Math.sin(state.tauntElapsed * 10) * 0.6;
      if (state.tauntElapsed > 0.8) {
        state.isTaunting = false;
        state.tauntElapsed = 0;
        state.nextTauntAt = state.elapsed + TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN);
      }
    } else {
      group.rotation.y = Math.sin(state.elapsed * 0.7 + state.phaseOffset) * 0.15;
      if (state.elapsed >= state.nextTauntAt) {
        state.isTaunting = true;
      }
    }
  }

  function updateHit(dt) {
    state.hitElapsed += dt;
    const t = Math.min(state.hitElapsed / HIT_ANIMATION_DURATION, 1);
    group.position.y = position.y + t * 1.5;
    group.position.z = position.z - t * 1.2;
    group.rotation.x = t * Math.PI * 2;
    group.rotation.z = t * Math.PI;
    const fade = 1 - t;
    for (const material of materials) {
      material.transparent = true;
      material.opacity = fade;
    }
    if (t >= 1) {
      state.dead = true;
    }
  }

  return {
    id,
    group,
    getRaycastMeshes() {
      return raycastMesh ? [raycastMesh] : [];
    },
    classifyHit(worldPoint) {
      const local = raycastMesh.worldToLocal(worldPoint.clone());
      return local.y > HEAD_CUTOFF_LOCAL_Y ? 'head' : 'body';
    },
    update(dt) {
      mixer.update(dt);
      if (state.phase === 'hit') {
        updateHit(dt);
      } else {
        updateIdle(dt);
      }
    },
    hit(part) {
      if (state.phase === 'hit') return;
      state.phase = 'hit';
      state.hitElapsed = 0;
      state.lastHitPart = part;
    },
    isDead() {
      return state.dead;
    },
    getWorldPosition(target = new THREE.Vector3()) {
      return group.getWorldPosition(target);
    },
  };
}
```

- [ ] **Step 2: Temporarily wire one monkey into `game/src/main.js` to verify visually**

```js
import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadMonkeyModel } from './gameplay/monkeyModel.js';
import { createMonkey } from './gameplay/monkey.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let monkey = null;

loadMonkeyModel().then(({ template, clip }) => {
  monkey = createMonkey({
    id: 'preview',
    position: { x: 0, y: -1, z: -6 },
    scale: 1,
    speed: 0.5,
    template,
    clip,
  });
  engine.scene.add(monkey.group);
});

engine.start((dt) => {
  if (monkey) monkey.update(dt);
});
```

(No `THREE` import needed here — `monkey.js`'s own `update(dt)` internally drives its `AnimationMixer`, this file never touches `THREE` directly.)

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 4: Manually verify**

Run `npm run dev`. Confirm: the monkey (textured, animated per Task 2's check) also bobs/sways per the existing idle logic (position/rotation oscillation layered on top of its own skeletal animation), and occasionally does the taunt head-wiggle every few seconds. If you have a way to trigger `monkey.hit('body')` from the console (e.g. via browser devtools, since `monkey` is not exposed globally — you can temporarily add `window.monkey = monkey;` inside the `.then()` callback for this manual check only, and remove it before committing), confirm it knocks back, spins, and fades out over about 0.6s, then `monkey.isDead()` becomes `true`.

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/monkey.js game/src/main.js
git commit -m "feat: rewrite monkey.js to use loaded FBX model instead of primitives"
```

---

### Task 4: Wire the model through `targetManager.js` and `game.js`, add loading screen

**Files:**
- Modify: `game/src/gameplay/targetManager.js`
- Modify: `game/src/ui/screens.js`
- Modify: `game/src/gameplay/game.js` (full rewrite)
- Modify: `game/src/main.js` (final form — delegates to `createGame`, same as before Task 2/3's temporary wiring)

**Interfaces:**
- Consumes: `loadMonkeyModel` from `game/src/gameplay/monkeyModel.js` (Task 2), `createMonkey`'s new `template`/`clip` params and `classifyHit` method (Task 3).
- Produces: `createTargetManager(scene, config, monkeyModel)` (added third parameter — `monkeyModel: { template, clip }`, the already-resolved object from `loadMonkeyModel()`). `createScreens(container)` gains `showLoading(text)` in its returned object (in addition to the existing `showMenu`, `showGameOver`, `hide`, `dispose`).

- [ ] **Step 1: Modify `game/src/gameplay/targetManager.js`**

Change the `createTargetManager` signature to accept and thread through `monkeyModel`, and pass `template`/`clip` into every `createMonkey(...)` call:

```js
import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';

function computeSpawnPosition(index, count) {
  const spread = 8;
  const x = count === 1 ? 0 : (index - (count - 1) / 2) * (spread / (count - 1));
  const z = -14 - Math.random() * 4;
  const y = -1.0;
  return { x, y, z };
}

export function createTargetManager(scene, config, monkeyModel) {
  let monkeys = [];
  let nextId = 0;

  function clear() {
    for (const monkey of monkeys) scene.remove(monkey.group);
    monkeys = [];
  }

  function spawnRound(roundNumber) {
    clear();
    const params = getRoundParams(roundNumber, config);
    for (let i = 0; i < params.monkeyCount; i++) {
      const position = computeSpawnPosition(i, params.monkeyCount);
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position,
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
    }
    return params;
  }

  function update(dt) {
    for (const monkey of monkeys) monkey.update(dt);
    monkeys = monkeys.filter((monkey) => {
      if (monkey.isDead()) {
        scene.remove(monkey.group);
        return false;
      }
      return true;
    });
  }

  function getRaycastMeshes() {
    return monkeys.flatMap((monkey) => monkey.getRaycastMeshes());
  }

  function findMonkey(id) {
    return monkeys.find((monkey) => monkey.id === id);
  }

  function allCleared() {
    return monkeys.length === 0;
  }

  return { spawnRound, update, getRaycastMeshes, findMonkey, allCleared, clear };
}
```

(Only the function signature and the two new fields inside the `createMonkey({...})` call changed from the previous version — `computeSpawnPosition`, `update`, `getRaycastMeshes`, `findMonkey`, `allCleared`, `clear` are byte-identical to before.)

- [ ] **Step 2: Add `showLoading` to `game/src/ui/screens.js`**

Add this function inside `createScreens`, alongside the existing `showMenu`/`showGameOver`:

```js
  function showLoading(text) {
    clear();
    const p = document.createElement('p');
    p.textContent = text;
    overlay.appendChild(p);
    show();
  }
```

And update the return statement to include it:

```js
  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
```

(Everything else in `screens.js` — `overlay` setup, `clear`, `show`, `hide`, `button`, `showMenu`, `showGameOver` — is unchanged.)

- [ ] **Step 3: Replace `game/src/gameplay/game.js` entirely**

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

    loadMonkeyModel().then((monkeyModel) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
      screens.showMenu(startGame);
    });
  }

  return { start };
}
```

**Note on what changed vs. the pre-existing `game.js`:** (a) `targetManager` is now `let targetManager = null;`, assigned only after `loadMonkeyModel()` resolves; (b) `engine.start`'s tick callback guards `targetManager.update(dt)` behind `if (targetManager)` (since the render loop starts immediately, before the model finishes loading, so the world/lighting is visible under the loading screen); (c) `handleShot`'s hit-collection loop now calls `monkey.classifyHit(intersection.point)` instead of reading `intersection.object.userData.part` directly (since each monkey now contributes exactly one raycastable mesh, not six pre-tagged ones); (d) `start()` shows a loading screen first, then transitions to the menu once the model resolves. The round-clear check (inside the tick callback's `else` branch, not inside `handleShot`) and the `endGame` high-score-tie fix (`highScoreStore.get()` read before `submit()`) are both preserved exactly as before — do not move or alter them.

- [ ] **Step 4: Restore `game/src/main.js` to its final form (undo Task 2/3's temporary wiring)**

```js
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();
```

- [ ] **Step 5: Verify build succeeds**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 6: Verify the existing Vitest suite is unaffected**

```bash
npm test
```

Expected: PASS (16 tests — this task doesn't touch any pure-logic module).

- [ ] **Step 7: Manually verify — full playthrough with the real model**

Run `npm run dev`. Confirm, in order:
1. On load, a "로딩 중..." message appears (briefly — the model is ~10MB, so this may take a moment depending on connection speed) instead of the menu.
2. Once loading finishes, the normal start menu appears.
3. Clicking "시작하기" spawns a round of textured, animated monkeys (not primitives).
4. Shooting a monkey in its upper-head region (visually near the head/eyes) produces a headshot (check the HUD score jump matches the headshot bonus, or if you added a temporary `console.log` for debugging, confirm `part === 'head'`) — and shooting lower on the body produces a body hit.
5. Killing the last monkey in a round still correctly advances to the next round shortly after the death animation finishes (this is the Task 13 fix — confirm it still works with the new model's hit reaction).
6. A full run to game-over (timeout or miss-limit) still shows the correct game-over screen and high-score behavior.

- [ ] **Step 8: Commit**

```bash
git add game/src/gameplay/targetManager.js game/src/ui/screens.js game/src/gameplay/game.js game/src/main.js
git commit -m "feat: wire FBX monkey model through targetManager and game state machine"
```

---

### Task 5: Final verification pass

**Files:** none created; verification only.

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all 16 tests still PASS (this feature touched no pure-logic module).

- [ ] **Step 2: Verify the production build**

```bash
npm run build
```

Expected: succeeds with no errors. Note the output bundle size — the monkey textures (public assets) are NOT bundled into the JS output (Vite copies `public/` files as-is into `dist/`), so check that `dist/textures/Monkey_animated/` exists after the build:

```bash
ls dist/textures/Monkey_animated/
```

Expected: the same 8 files as `game/public/textures/Monkey_animated/`.

- [ ] **Step 3: Verify the production build actually runs**

```bash
npm run preview
```

Open the printed local URL and repeat the Task 4 Step 7 playthrough checklist against the production build (not the dev server) — confirm the model loads and the game is fully playable.

- [ ] **Step 4: Confirm the redundant static asset folder is gone and the used one is tracked**

```bash
git ls-files game/public/textures/
```

Expected output: only files under `game/public/textures/Monkey_animated/` (8 files) — no `game/public/textures/Monkey/` entries.

- [ ] **Step 5: Final commit (if any working-tree changes remain)**

```bash
git status
```

If clean, no commit needed.

---

## Self-Review Notes

- **Spec coverage:** 로딩 전략(한 번 로드, 인스턴스마다 복제) → Task 2. 재질 독립 복제 → Task 2 (`cloneMonkeyModel`). 텍스처 매핑 → resolved as "no manual mapping needed" during pre-plan investigation (documented in Global Constraints), so no separate task required — `FBXLoader`'s automatic resolution handles it. 애니메이션(AnimationMixer) → Task 3. 피격 반응 일반화(재질 순회) → Task 3. 헤드샷 판정(로컬 높이 기준) → Task 3 (`classifyHit`, using the data-derived `HEAD_CUTOFF_LOCAL_Y`). 스케일/방향 보정 → Task 2 (`MODEL_SCALE`, `RECENTER_OFFSET`, both derived from real inspection data), with an explicit visual-check step in case the derived values need adjustment. 인터페이스 유지 → Task 3/4 (only additive `classifyHit`). 정적 에셋 폴더 삭제 → Task 1. `fflate` 의존성 → Task 1. — all covered.
- **Type consistency checked:** `createMonkey`'s parameter object gains `template`/`clip` (Task 3), and `targetManager.js`'s `spawnRound` (Task 4) passes exactly those two field names through from its own new `monkeyModel` parameter — names match. `classifyHit(worldPoint)` is defined in Task 3 and consumed with that exact name and a `THREE.Vector3`-shaped argument (`intersection.point`) in Task 4's `game.js`. `loadMonkeyModel()`'s resolved shape `{ template, clip }` (Task 2) matches every consumer: Task 3's manual-verification snippet, Task 4's `targetManager` call site.
- **No placeholders:** every numeric constant (`MODEL_SCALE`, `RECENTER_OFFSET`, `HEAD_CUTOFF_LOCAL_Y`) is a concrete value derived from directly loading and inspecting the actual FBX file before this plan was written (see Global Constraints) — none are marked TBD or left for the implementer to guess. Where true empirical uncertainty remains (does the derived scale/orientation actually look right once rendered?), the plan includes an explicit manual visual-check step with concrete pass/fail criteria, not an open-ended "figure it out" instruction.
