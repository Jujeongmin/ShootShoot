# ShootShoot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3D low-poly "monkey sniper" browser game (ShootZ-style aim-hold/release shooting with one-shot multi-hit) as a Vite project with `game/index.html` as the entry point, ready to upload to the Verse8 platform.

**Architecture:** Vanilla JS + Three.js for 3D rendering, Web Audio API for synthesized SFX (no external asset files), DOM overlay for HUD/menus. Pure game-logic modules (scoring, difficulty curve, shot interpretation) are isolated from rendering/input side effects and covered by Vitest unit tests. A single `gameplay/game.js` state machine wires all modules together.

**Tech Stack:** Vite (vanilla JS template), Three.js (npm, `^0.166.1`), Vitest, Web Audio API, no TypeScript.

**Spec:** [docs/superpowers/specs/2026-07-16-shootshoot-monkey-sniper-design.md](../specs/2026-07-16-shootshoot-monkey-sniper-design.md)

## Global Constraints

- Vite root **must** be `game/`, so `game/index.html` is the entry point and `package.json`/`vite.config.js` stay at the repo root (Verse8 expects a standard Vite project layout).
- No external asset files (models, images, audio files) — everything is generated (Three.js primitives, WebAudio synthesis).
- Language is JavaScript (ES modules) only — no TypeScript.
- Pure logic (`scoring.js`, `difficulty.js`, `shooting.js`) must have zero DOM/Three.js/browser API dependencies so it is testable under Vitest's `node` environment.
- High-score persistence uses `localStorage` via an **injected adapter** — the pure `scoring.js` module never touches `window` directly.
- Repo is not yet a git repository — Task 1 initializes it.

---

### Task 1: Project scaffolding (Vite + Three.js smoke test)

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `.gitignore`
- Create: `game/index.html`
- Create: `game/src/main.js`

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build` pipeline rooted at `game/`, with Three.js importable from `game/src/*`.

- [ ] **Step 1: Initialize git repository**

```bash
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
*.log
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "shootshoot",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "^0.166.1"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'game',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
```

- [ ] **Step 6: Create `game/index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShootShoot</title>
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }
      #app { position: relative; width: 100vw; height: 100vh; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `game/src/main.js` (smoke test — rotating cube)**

```js
import * as THREE from 'three';

const container = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
scene.add(cube);

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();
```

- [ ] **Step 8: Install dependencies**

```bash
npm install
```

- [ ] **Step 9: Verify dev server runs and build succeeds**

```bash
npm run build
```

Expected: `dist/index.html` and `dist/assets/*` produced, no errors.

Then run `npm run dev` and open the printed local URL (default `http://localhost:5173`) in a browser — confirm a rotating cube renders on a dark blue background.

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.js vitest.config.js .gitignore game/index.html game/src/main.js
git commit -m "chore: scaffold Vite project with game/ root and Three.js smoke test"
```

---

### Task 2: Config constants + difficulty curve (pure, tested)

**Files:**
- Create: `game/src/config.js`
- Create: `game/src/gameplay/difficulty.js`
- Test: `test/difficulty.test.js`

**Interfaces:**
- Produces: `CONFIG` object (used by every later gameplay module), `getRoundParams(roundNumber, config) -> { roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale }`.

- [ ] **Step 1: Create `game/src/config.js`**

```js
export const CONFIG = {
  score: {
    baseHit: 100,
    headshotBonus: 150,
    comboMultiplierPerPenetration: 0.5,
    streakMultiplierStep: 0.1,
    streakMultiplierCap: 2.0,
  },
  round: {
    baseTimeLimit: 30,
    timeLimitDecreasePerRound: 1,
    minTimeLimit: 12,
    baseMonkeyCount: 3,
    monkeyCountIncreasePerRound: 1,
    maxMonkeyCount: 10,
    baseMonkeySpeed: 0.5,
    monkeySpeedIncreasePerRound: 0.08,
    baseMonkeyScale: 1.0,
    monkeyScaleDecreasePerRound: 0.03,
    minMonkeyScale: 0.5,
  },
  missLimit: 5,
  aim: {
    normalFov: 60,
    aimFov: 35,
  },
  highScoreStorageKey: 'shootshoot.highscore',
};
```

- [ ] **Step 2: Write the failing test for `getRoundParams`**

Create `test/difficulty.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getRoundParams } from '../game/src/gameplay/difficulty.js';
import { CONFIG } from '../game/src/config.js';

describe('getRoundParams', () => {
  it('returns base values for round 1', () => {
    const params = getRoundParams(1, CONFIG);
    expect(params.monkeyCount).toBe(CONFIG.round.baseMonkeyCount);
    expect(params.timeLimit).toBe(CONFIG.round.baseTimeLimit);
    expect(params.monkeySpeed).toBe(CONFIG.round.baseMonkeySpeed);
    expect(params.monkeyScale).toBe(CONFIG.round.baseMonkeyScale);
  });

  it('increases monkey count and speed as rounds progress, capped at max', () => {
    const early = getRoundParams(2, CONFIG);
    const later = getRoundParams(20, CONFIG);
    expect(early.monkeyCount).toBeGreaterThan(CONFIG.round.baseMonkeyCount);
    expect(later.monkeyCount).toBe(CONFIG.round.maxMonkeyCount);
    expect(later.monkeySpeed).toBeGreaterThan(early.monkeySpeed);
  });

  it('decreases time limit and scale as rounds progress, clamped at minimums', () => {
    const later = getRoundParams(50, CONFIG);
    expect(later.timeLimit).toBe(CONFIG.round.minTimeLimit);
    expect(later.monkeyScale).toBe(CONFIG.round.minMonkeyScale);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run test/difficulty.test.js
```

Expected: FAIL — `game/src/gameplay/difficulty.js` does not exist / `getRoundParams` is not a function.

- [ ] **Step 4: Create `game/src/gameplay/difficulty.js`**

```js
export function getRoundParams(roundNumber, config) {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const timeLimit = Math.max(c.baseTimeLimit - n * c.timeLimitDecreasePerRound, c.minTimeLimit);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = Math.max(c.baseMonkeyScale - n * c.monkeyScaleDecreasePerRound, c.minMonkeyScale);
  return { roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run test/difficulty.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add game/src/config.js game/src/gameplay/difficulty.js test/difficulty.test.js
git commit -m "feat: add config constants and difficulty curve with tests"
```

---

### Task 3: Scoring module (pure, tested)

**Files:**
- Create: `game/src/gameplay/scoring.js`
- Test: `test/scoring.test.js`

**Interfaces:**
- Consumes: `CONFIG.score` from `config.js` (Task 2).
- Produces: `createScoreState() -> { score, streak, misses }`, `calculateShotScore(shotOutcome, streak, config) -> number`, `applyShot(scoreState, shotOutcome, config) -> { score, streak, misses }`, `createHighScoreStore(storage, key) -> { get(), submit(score) }`. `shotOutcome` shape (defined fully in Task 4): `{ isMiss: boolean, penetrationCount: number, hits: Array<{ monkeyId, part: 'head'|'body', penetrationIndex }> }`.

- [ ] **Step 1: Write the failing tests**

Create `test/scoring.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createScoreState,
  calculateShotScore,
  applyShot,
  createHighScoreStore,
} from '../game/src/gameplay/scoring.js';
import { CONFIG } from '../game/src/config.js';

describe('calculateShotScore', () => {
  it('awards base hit score for a single body hit with no streak', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit);
  });

  it('adds headshot bonus', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'head', penetrationIndex: 0 }] };
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(CONFIG.score.baseHit + CONFIG.score.headshotBonus);
  });

  it('multiplies score for multi-monkey penetration', () => {
    const outcome = {
      isMiss: false,
      penetrationCount: 2,
      hits: [
        { monkeyId: 'a', part: 'body', penetrationIndex: 0 },
        { monkeyId: 'b', part: 'body', penetrationIndex: 1 },
      ],
    };
    const single = CONFIG.score.baseHit * 2;
    const expected = Math.round(single * (1 + CONFIG.score.comboMultiplierPerPenetration));
    expect(calculateShotScore(outcome, 0, CONFIG)).toBe(expected);
  });

  it('applies streak multiplier, capped', () => {
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const highStreak = 100;
    const expected = Math.round(CONFIG.score.baseHit * CONFIG.score.streakMultiplierCap);
    expect(calculateShotScore(outcome, highStreak, CONFIG)).toBe(expected);
  });

  it('returns 0 for a miss', () => {
    expect(calculateShotScore({ isMiss: true, penetrationCount: 0, hits: [] }, 5, CONFIG)).toBe(0);
  });
});

describe('applyShot', () => {
  it('increments score and streak on hit', () => {
    const state = createScoreState();
    const outcome = { isMiss: false, penetrationCount: 1, hits: [{ monkeyId: 'a', part: 'body', penetrationIndex: 0 }] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(CONFIG.score.baseHit);
    expect(next.streak).toBe(1);
    expect(next.misses).toBe(0);
  });

  it('resets streak and increments misses on miss', () => {
    const state = { score: 500, streak: 4, misses: 1 };
    const outcome = { isMiss: true, penetrationCount: 0, hits: [] };
    const next = applyShot(state, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(0);
    expect(next.misses).toBe(2);
  });
});

describe('createHighScoreStore', () => {
  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    };
  }

  it('returns 0 when nothing stored', () => {
    const store = createHighScoreStore(createMemoryStorage(), 'test.key');
    expect(store.get()).toBe(0);
  });

  it('submits a new high score when higher than stored', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    expect(store.submit(100)).toBe(100);
    expect(store.get()).toBe(100);
  });

  it('keeps the existing high score when submitted score is lower', () => {
    const storage = createMemoryStorage();
    const store = createHighScoreStore(storage, 'test.key');
    store.submit(200);
    expect(store.submit(50)).toBe(200);
    expect(store.get()).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/scoring.test.js
```

Expected: FAIL — `game/src/gameplay/scoring.js` does not exist.

- [ ] **Step 3: Create `game/src/gameplay/scoring.js`**

```js
export function createScoreState() {
  return { score: 0, streak: 0, misses: 0 };
}

export function calculateShotScore(shotOutcome, streak, config) {
  if (shotOutcome.isMiss) return 0;
  const base = shotOutcome.hits.reduce((sum, hit) => {
    return sum + config.score.baseHit + (hit.part === 'head' ? config.score.headshotBonus : 0);
  }, 0);
  const comboMultiplier = 1 + (shotOutcome.penetrationCount - 1) * config.score.comboMultiplierPerPenetration;
  const streakMultiplier = Math.min(
    1 + streak * config.score.streakMultiplierStep,
    config.score.streakMultiplierCap
  );
  return Math.round(base * comboMultiplier * streakMultiplier);
}

export function applyShot(scoreState, shotOutcome, config) {
  if (shotOutcome.isMiss) {
    return { score: scoreState.score, streak: 0, misses: scoreState.misses + 1 };
  }
  const gained = calculateShotScore(shotOutcome, scoreState.streak, config);
  return { score: scoreState.score + gained, streak: scoreState.streak + 1, misses: scoreState.misses };
}

export function createHighScoreStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      const value = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isNaN(value) ? 0 : value;
    },
    submit(score) {
      const current = this.get();
      if (score > current) {
        storage.setItem(key, String(score));
        return score;
      }
      return current;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/scoring.test.js
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/scoring.js test/scoring.test.js
git commit -m "feat: add scoring module with streak/combo/highscore logic and tests"
```

---

### Task 4: Shot interpretation module (pure, tested)

**Files:**
- Create: `game/src/gameplay/shooting.js`
- Test: `test/shooting.test.js`

**Interfaces:**
- Produces: `resolveShot(sortedHits) -> { isMiss, penetrationCount, hits }` where `sortedHits: Array<{ monkeyId: string, part: 'head'|'body' }>` is pre-sorted by distance (closest first), and each returned hit gains a `penetrationIndex` (0 = closest).

- [ ] **Step 1: Write the failing tests**

Create `test/shooting.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveShot } from '../game/src/gameplay/shooting.js';

describe('resolveShot', () => {
  it('returns a miss when there are no hits', () => {
    const outcome = resolveShot([]);
    expect(outcome.isMiss).toBe(true);
    expect(outcome.penetrationCount).toBe(0);
    expect(outcome.hits).toEqual([]);
  });

  it('returns a single hit with penetrationIndex 0', () => {
    const outcome = resolveShot([{ monkeyId: 'a', part: 'head' }]);
    expect(outcome.isMiss).toBe(false);
    expect(outcome.penetrationCount).toBe(1);
    expect(outcome.hits).toEqual([{ monkeyId: 'a', part: 'head', penetrationIndex: 0 }]);
  });

  it('preserves order and assigns increasing penetrationIndex for multiple hits', () => {
    const outcome = resolveShot([
      { monkeyId: 'a', part: 'body' },
      { monkeyId: 'b', part: 'head' },
      { monkeyId: 'c', part: 'body' },
    ]);
    expect(outcome.penetrationCount).toBe(3);
    expect(outcome.hits.map((h) => h.penetrationIndex)).toEqual([0, 1, 2]);
    expect(outcome.hits.map((h) => h.monkeyId)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/shooting.test.js
```

Expected: FAIL — `game/src/gameplay/shooting.js` does not exist.

- [ ] **Step 3: Create `game/src/gameplay/shooting.js`**

```js
export function resolveShot(sortedHits) {
  if (sortedHits.length === 0) {
    return { isMiss: true, penetrationCount: 0, hits: [] };
  }
  const hits = sortedHits.map((hit, index) => ({ ...hit, penetrationIndex: index }));
  return { isMiss: false, penetrationCount: hits.length, hits };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/shooting.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite so far**

```bash
npm test
```

Expected: PASS (15 tests total across difficulty/scoring/shooting).

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/shooting.js test/shooting.test.js
git commit -m "feat: add shot interpretation (multi-hit penetration) module with tests"
```

---

### Task 5: Rendering engine core

**Files:**
- Create: `game/src/core/engine.js`
- Modify: `game/src/main.js` (replace smoke-test code with engine usage)

**Interfaces:**
- Produces: `createEngine(container) -> { scene, camera, renderer, domElement, start(onTick), stop(), setFov(fov), dispose() }`. `onTick(dt, elapsedSeconds)` is called once per frame before rendering.

- [ ] **Step 1: Create `game/src/core/engine.js`**

```js
import * as THREE from 'three';

export function createEngine(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  let running = false;
  let lastTime = 0;
  let tickCallback = null;

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);

  function loop(time) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (tickCallback) tickCallback(dt, time / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  return {
    scene,
    camera,
    renderer,
    domElement: renderer.domElement,
    start(onTick) {
      tickCallback = onTick;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    setFov(fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 2: Replace `game/src/main.js` with engine-based version**

```js
import { createEngine } from './core/engine.js';
import * as THREE from 'three';

const container = document.getElementById('app');
const engine = createEngine(container);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
cube.position.z = -3;
engine.scene.add(cube);

engine.start((dt) => {
  cube.rotation.x += dt;
  cube.rotation.y += dt;
});
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open the local URL in a browser. Confirm: the cube still rotates, and resizing the browser window keeps the cube correctly proportioned (no stretching).

- [ ] **Step 4: Commit**

```bash
git add game/src/core/engine.js game/src/main.js
git commit -m "feat: add rendering engine core (scene/camera/renderer/render loop)"
```

---

### Task 6: Mouse input controller (aim + hold/release)

**Files:**
- Create: `game/src/core/input.js`
- Modify: `game/src/main.js` (temporary console-log wiring to verify events; will be replaced in Task 10)

**Interfaces:**
- Produces: `createInputController(domElement) -> { getNdc(), isAiming(), onAimDown(cb), onAimUp(cb(ndcX, ndcY)), dispose() }`. `getNdc()` returns the current mouse position in normalized device coordinates (`{x, y}` each in `[-1, 1]`).

- [ ] **Step 1: Create `game/src/core/input.js`**

```js
export function createInputController(domElement) {
  const ndc = { x: 0, y: 0 };
  let aiming = false;
  const downListeners = [];
  const upListeners = [];

  function onMouseMove(event) {
    const rect = domElement.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    aiming = true;
    for (const cb of downListeners) cb();
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    if (!aiming) return;
    aiming = false;
    for (const cb of upListeners) cb(ndc.x, ndc.y);
  }

  domElement.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    getNdc: () => ({ ...ndc }),
    isAiming: () => aiming,
    onAimDown(cb) {
      downListeners.push(cb);
    },
    onAimUp(cb) {
      upListeners.push(cb);
    },
    dispose() {
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
```

- [ ] **Step 2: Wire temporary logging into `game/src/main.js`**

```js
import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import * as THREE from 'three';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
cube.position.z = -3;
engine.scene.add(cube);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  cube.rotation.x += dt;
  cube.rotation.y += dt;
});
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open the local URL, open the browser dev console. Hold left mouse button down on the canvas and release — confirm `"aim down"` logs on press and `"aim up, released at <x> <y>"` logs on release, with x/y roughly in `[-1, 1]` matching cursor position.

- [ ] **Step 4: Commit**

```bash
git add game/src/core/input.js game/src/main.js
git commit -m "feat: add mouse input controller (aim ndc + hold/release events)"
```

---

### Task 7: Game world (sky, lighting, floating platforms)

**Files:**
- Create: `game/src/gameplay/world.js`
- Modify: `game/src/main.js` (swap cube for world; keep input logging from Task 6)

**Interfaces:**
- Produces: `createWorld(scene) -> { platforms: THREE.Mesh[] }`.

- [ ] **Step 1: Create `game/src/gameplay/world.js`**

```js
import * as THREE from 'three';

export function createWorld(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 15, 40);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
  const platforms = [];
  const platformPositions = [
    { x: -4, y: -1.5, z: -14 },
    { x: 0, y: -1.5, z: -18 },
    { x: 4, y: -1.5, z: -14 },
  ];
  for (const pos of platformPositions) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), platformMaterial);
    platform.position.set(pos.x, pos.y, pos.z);
    scene.add(platform);
    platforms.push(platform);
  }

  return { platforms };
}
```

- [ ] **Step 2: Update `game/src/main.js`**

```js
import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start(() => {});
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Confirm: sky-blue background with fog, three brown floating platforms visible in the distance, lit from above.

- [ ] **Step 4: Commit**

```bash
git add game/src/gameplay/world.js game/src/main.js
git commit -m "feat: add game world (sky, lighting, floating platforms)"
```

---

### Task 8: Monkey target (mesh, idle/taunt animation, hit reaction)

**Files:**
- Create: `game/src/gameplay/monkey.js`
- Modify: `game/src/main.js` (temporary: spawn one monkey to visually verify animation)

**Interfaces:**
- Produces: `createMonkey({ id, position, scale, speed }) -> { id, group, getRaycastMeshes(), update(dt), hit(part), isDead(), getWorldPosition(target?) }`. `position: {x,y,z}` is the monkey's base world position (before idle-bob offsets). Each raycast mesh has `userData = { monkeyId, part: 'head'|'body' }`.

- [ ] **Step 1: Create `game/src/gameplay/monkey.js`**

```js
import * as THREE from 'three';

const BODY_COLOR = 0x8b5a2b;
const FACE_COLOR = 0xf0c39e;
const HIT_ANIMATION_DURATION = 0.6;
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;

export function createMonkey({ id, position, scale = 1, speed = 0.5 }) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);
  group.scale.setScalar(scale);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: FACE_COLOR });

  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 8), bodyMaterial);
  bodyMesh.position.y = 0.6;
  bodyMesh.userData = { monkeyId: id, part: 'body' };
  group.add(bodyMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyMaterial);
  headMesh.position.y = 1.25;
  headMesh.userData = { monkeyId: id, part: 'head' };
  group.add(headMesh);

  const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), faceMaterial);
  faceMesh.position.set(0, 1.22, 0.3);
  faceMesh.userData = { monkeyId: id, part: 'head' };
  group.add(faceMesh);

  const earGeometry = new THREE.SphereGeometry(0.12, 8, 8);
  const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
  leftEar.position.set(-0.3, 1.4, 0);
  leftEar.userData = { monkeyId: id, part: 'head' };
  group.add(leftEar);

  const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
  rightEar.position.set(0.3, 1.4, 0);
  rightEar.userData = { monkeyId: id, part: 'head' };
  group.add(rightEar);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.3, -0.3),
    new THREE.Vector3(0, 0.1, -0.6),
    new THREE.Vector3(0.15, 0.3, -0.8),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 12, 0.05, 6, false),
    bodyMaterial
  );
  tailMesh.userData = { monkeyId: id, part: 'body' };
  group.add(tailMesh);

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
    bodyMaterial.transparent = true;
    bodyMaterial.opacity = fade;
    faceMaterial.transparent = true;
    faceMaterial.opacity = fade;
    if (t >= 1) {
      state.dead = true;
    }
  }

  return {
    id,
    group,
    getRaycastMeshes() {
      return [bodyMesh, headMesh, faceMesh, leftEar, rightEar, tailMesh];
    },
    update(dt) {
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

- [ ] **Step 2: Temporarily spawn one monkey in `game/src/main.js` to verify visually**

```js
import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';
import { createMonkey } from './gameplay/monkey.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

const monkey = createMonkey({ id: 'preview', position: { x: 0, y: -1, z: -6 }, scale: 1, speed: 0.5 });
engine.scene.add(monkey.group);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  monkey.update(dt);
});
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Confirm: a brown low-poly monkey (capsule body, round head, two ears, face patch, curved tail) stands on/near the front platform, bobbing up and down and occasionally doing a head-shake "taunt" wiggle every few seconds.

- [ ] **Step 4: Commit**

```bash
git add game/src/gameplay/monkey.js game/src/main.js
git commit -m "feat: add monkey target with idle/taunt animation and hit reaction"
```

---

### Task 9: Target manager (round spawning/despawning)

**Files:**
- Create: `game/src/gameplay/targetManager.js`
- Modify: `game/src/main.js` (temporary: spawn round 1 via the manager)

**Interfaces:**
- Consumes: `getRoundParams` from `game/src/gameplay/difficulty.js` (Task 2), `createMonkey` from `game/src/gameplay/monkey.js` (Task 8).
- Produces: `createTargetManager(scene, config) -> { spawnRound(roundNumber) -> roundParams, update(dt), getRaycastMeshes(), findMonkey(id), allCleared(), clear() }`.

- [ ] **Step 1: Create `game/src/gameplay/targetManager.js`**

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

export function createTargetManager(scene, config) {
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

- [ ] **Step 2: Update `game/src/main.js` to spawn a round via the manager**

```js
import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';
import { createTargetManager } from './gameplay/targetManager.js';
import { CONFIG } from './config.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

const targetManager = createTargetManager(engine.scene, CONFIG);
targetManager.spawnRound(1);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  targetManager.update(dt);
});
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Confirm: `CONFIG.round.baseMonkeyCount` (3) monkeys spawn spread across the platforms, each independently bobbing/taunting (out of phase with each other since each has a random `phaseOffset`).

- [ ] **Step 4: Commit**

```bash
git add game/src/gameplay/targetManager.js game/src/main.js
git commit -m "feat: add target manager for round-based monkey spawning"
```

---

### Task 10: Raycast shooting integration (first playable loop)

**Files:**
- Create: `game/src/gameplay/game.js`
- Modify: `game/src/main.js` (final form — delegates to `createGame`)

**Interfaces:**
- Consumes: `createEngine` (Task 5), `createInputController` (Task 6), `createWorld` (Task 7), `createTargetManager` (Task 9), `resolveShot` (Task 4), `createScoreState`/`applyShot` (Task 3), `CONFIG` (Task 2).
- Produces: `createGame(container) -> { start() }`. This is the module later tasks (11-14) extend in place.

- [ ] **Step 1: Create `game/src/gameplay/game.js`**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot } from './scoring.js';
import { CONFIG } from '../config.js';

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const targetManager = createTargetManager(engine.scene, CONFIG);

  const raycaster = new THREE.Raycaster();
  let scoreState = createScoreState();

  targetManager.spawnRound(1);

  function handleShot(ndcX, ndcY) {
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, engine.camera);
    const intersections = raycaster.intersectObjects(targetManager.getRaycastMeshes(), false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
    }

    const outcome = resolveShot(hits);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) monkey.hit(hit.part);
    }

    console.log('score:', scoreState.score, 'streak:', scoreState.streak, 'misses:', scoreState.misses);
  }

  input.onAimUp(handleShot);

  function start() {
    engine.start((dt) => {
      targetManager.update(dt);
      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
```

- [ ] **Step 2: Replace `game/src/main.js` with final bootstrap**

```js
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open the browser dev console. Confirm:
- Holding the mouse button down and moving slightly narrows the field of view (zoom-in "aim" effect).
- Releasing over a monkey makes it fly backward, spin, and fade out, and the console logs an increasing score.
- Releasing over empty space logs the same score (no increase) and resets the streak.
- Releasing over two monkeys lined up in the same shot direction (reposition camera/monkeys if needed to confirm) knocks both out with one shot and a higher logged score than a single hit.

- [ ] **Step 4: Commit**

```bash
git add game/src/gameplay/game.js game/src/main.js
git commit -m "feat: wire raycast shooting into a playable loop (game.js v1)"
```

---

### Task 11: Synthesized SFX (Web Audio)

**Files:**
- Create: `game/src/audio/sfx.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Produces: `sfx.shoot()`, `sfx.hit()`, `sfx.headshot()`, `sfx.combo()`, `sfx.miss()`, `sfx.roundClear()`, `resumeAudio()`.

- [ ] **Step 1: Create `game/src/audio/sfx.js`**

```js
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone({ frequency, frequencyEnd, duration, type = 'sine', gain = 0.2 }) {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  if (frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(frequencyEnd, audioCtx.currentTime + duration);
  }
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  oscillator.connect(gainNode).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

export const sfx = {
  shoot() {
    playTone({ frequency: 900, frequencyEnd: 200, duration: 0.12, type: 'square', gain: 0.15 });
  },
  hit() {
    playTone({ frequency: 300, frequencyEnd: 500, duration: 0.15, type: 'triangle', gain: 0.2 });
  },
  headshot() {
    playTone({ frequency: 500, frequencyEnd: 1200, duration: 0.2, type: 'triangle', gain: 0.25 });
  },
  combo() {
    playTone({ frequency: 700, frequencyEnd: 1400, duration: 0.25, type: 'sawtooth', gain: 0.2 });
  },
  miss() {
    playTone({ frequency: 200, frequencyEnd: 120, duration: 0.2, type: 'sine', gain: 0.1 });
  },
  roundClear() {
    playTone({ frequency: 600, frequencyEnd: 900, duration: 0.4, type: 'sine', gain: 0.25 });
  },
};

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
```

- [ ] **Step 2: Wire SFX into `game/src/gameplay/game.js`**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot } from './scoring.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { CONFIG } from '../config.js';

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const targetManager = createTargetManager(engine.scene, CONFIG);

  const raycaster = new THREE.Raycaster();
  let scoreState = createScoreState();

  targetManager.spawnRound(1);

  function handleShot(ndcX, ndcY) {
    sfx.shoot();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, engine.camera);
    const intersections = raycaster.intersectObjects(targetManager.getRaycastMeshes(), false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
    }

    const outcome = resolveShot(hits);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) monkey.hit(hit.part);
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

    console.log('score:', scoreState.score, 'streak:', scoreState.streak, 'misses:', scoreState.misses);
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    engine.start((dt) => {
      targetManager.update(dt);
      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Confirm: a descending "pew" plays on every shot fired; a body hit plays a rising blip, a headshot a brighter/higher blip, a multi-hit a sawtooth "combo" sound, and a miss a low dull tone.

- [ ] **Step 4: Commit**

```bash
git add game/src/audio/sfx.js game/src/gameplay/game.js
git commit -m "feat: add synthesized SFX for shoot/hit/headshot/combo/miss"
```

---

### Task 12: HUD (score/streak/round/timer display)

**Files:**
- Create: `game/src/ui/hud.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Produces: `createHud(container) -> { render({score, streak, round, timeRemaining}), dispose() }`.

- [ ] **Step 1: Create `game/src/ui/hud.js`**

```js
export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px; color: #fff;
    font-family: sans-serif; font-size: 20px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  function render({ score, streak, round, timeRemaining }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
    `;
  }

  function dispose() {
    el.remove();
  }

  return { render, dispose };
}
```

- [ ] **Step 2: Wire HUD into `game/src/gameplay/game.js` (replaces `console.log`)**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot } from './scoring.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { CONFIG } from '../config.js';

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const targetManager = createTargetManager(engine.scene, CONFIG);
  const hud = createHud(container);

  const raycaster = new THREE.Raycaster();
  let scoreState = createScoreState();

  targetManager.spawnRound(1);
  updateHud();

  function updateHud() {
    hud.render({
      score: scoreState.score,
      streak: scoreState.streak,
      round: 1,
      timeRemaining: CONFIG.round.baseTimeLimit,
    });
  }

  function handleShot(ndcX, ndcY) {
    sfx.shoot();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, engine.camera);
    const intersections = raycaster.intersectObjects(targetManager.getRaycastMeshes(), false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
    }

    const outcome = resolveShot(hits);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) monkey.hit(hit.part);
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

    updateHud();
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    engine.start((dt) => {
      targetManager.update(dt);
      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
```

> Note: `round` and `timeRemaining` are placeholders here (always round 1 / the base time limit). Task 13 replaces them with live values from the round state machine.

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Confirm: a HUD in the top-left shows 점수/연속/라운드/남은 시간, and 점수/연속 update immediately after each shot.

- [ ] **Step 4: Commit**

```bash
git add game/src/ui/hud.js game/src/gameplay/game.js
git commit -m "feat: add HUD showing score/streak/round/timer"
```

---

### Task 13: Full round state machine (menu, rounds, timer, game over, high score)

**Files:**
- Create: `game/src/ui/screens.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `getRoundParams` (Task 2, via `targetManager.spawnRound`), `createHighScoreStore` (Task 3), `CONFIG.missLimit` (Task 2).
- Produces: `createScreens(container) -> { showMenu(onStart), showGameOver({score, highScore, isNewHighScore}, onRestart), hide(), dispose() }`.

- [ ] **Step 1: Create `game/src/ui/screens.js`**

```js
export function createScreens(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.55); z-index: 20;
  `;
  container.appendChild(overlay);
  hide();

  function clear() {
    overlay.innerHTML = '';
  }

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function button(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function showMenu(onStart) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    overlay.appendChild(button('시작하기', onStart));
    show();
  }

  function showGameOver({ score, highScore, isNewHighScore }, onRestart) {
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
    overlay.appendChild(button('다시하기', onRestart));
    show();
  }

  return { showMenu, showGameOver, hide, dispose: () => overlay.remove() };
}
```

- [ ] **Step 2: Rewrite `game/src/gameplay/game.js` with the full state machine**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot, createHighScoreStore } from './scoring.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { createScreens } from '../ui/screens.js';
import { CONFIG } from '../config.js';

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const targetManager = createTargetManager(engine.scene, CONFIG);
  const hud = createHud(container);
  const screens = createScreens(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const raycaster = new THREE.Raycaster();

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
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = highScore === scoreState.score && scoreState.score > 0;
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
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
    }

    const outcome = resolveShot(hits);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) monkey.hit(hit.part);
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

    updateHud();

    if (scoreState.misses >= CONFIG.missLimit) {
      endGame();
      return;
    }

    if (targetManager.allCleared()) {
      sfx.roundClear();
      beginRound(round + 1);
      updateHud();
    }
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    screens.showMenu(startGame);
    engine.start((dt) => {
      targetManager.update(dt);

      if (phase === 'playing') {
        timeRemaining -= dt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
        }
      }

      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
```

- [ ] **Step 3: Manually verify — full playthrough**

Run `npm run dev`. Confirm the following in order:
1. A start menu appears on load; shooting does nothing while it's up.
2. Clicking "시작하기" hides the menu and spawns round 1 monkeys; the HUD timer counts down.
3. Clearing all monkeys in a round triggers a round-clear sound and immediately spawns round 2 with one more monkey (and a shorter timer, per the difficulty curve).
4. Letting the timer hit 0 ends the game and shows the game-over screen with the final score.
5. Reload the page, play again, and beat the first game's score — confirm the game-over screen shows "🎉 신기록!" and the new high score.
6. Reload the page a third time and get a lower score than the previous high score — confirm the game-over screen shows the *previous* (higher) high score, not the new lower one.
7. Miss `CONFIG.missLimit` (5) shots in a row — confirm the game ends immediately via the miss limit, not just the timer.
8. Clicking "다시하기" on the game-over screen returns to a fresh round 1 with score reset to 0.

- [ ] **Step 4: Commit**

```bash
git add game/src/ui/screens.js game/src/gameplay/game.js
git commit -m "feat: add full round state machine (menu/rounds/timer/gameover/highscore)"
```

---

### Task 14: Polish — hit particles and score popups

**Files:**
- Create: `game/src/gameplay/effects.js`
- Modify: `game/src/ui/hud.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `calculateShotScore` from `game/src/gameplay/scoring.js` (Task 3, already exported, not yet imported by `game.js`).
- Produces: `createEffects(scene) -> { spawnHitBurst(position, color?), update(dt) }`. `hud.showScorePopup(text, clientX, clientY)` added to the Task 12 HUD.

- [ ] **Step 1: Create `game/src/gameplay/effects.js`**

```js
import * as THREE from 'three';

const PARTICLE_COUNT = 10;
const PARTICLE_LIFETIME = 0.5;

export function createEffects(scene) {
  const bursts = [];

  function spawnHitBurst(position, color = 0xffdd55) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color });
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), material);
      mesh.position.copy(position);
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = 1.5 + Math.random() * 1.5;
      particles.push({ mesh, velocity: direction.multiplyScalar(speed) });
      group.add(mesh);
    }
    scene.add(group);
    bursts.push({ group, particles, elapsed: 0 });
  }

  function update(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.elapsed += dt;
      const t = burst.elapsed / PARTICLE_LIFETIME;
      for (const particle of burst.particles) {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 4 * dt;
        particle.mesh.scale.setScalar(Math.max(1 - t, 0));
      }
      if (t >= 1) {
        scene.remove(burst.group);
        bursts.splice(i, 1);
      }
    }
  }

  return { spawnHitBurst, update };
}
```

- [ ] **Step 2: Add `showScorePopup` to `game/src/ui/hud.js`**

```js
export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px; color: #fff;
    font-family: sans-serif; font-size: 20px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  function render({ score, streak, round, timeRemaining }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
    `;
  }

  function showScorePopup(text, clientX, clientY) {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.cssText = `
      position: absolute; left: ${clientX}px; top: ${clientY}px; transform: translate(-50%, -50%);
      color: #ffdd55; font-weight: bold; font-size: 24px; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: transform 0.6s ease-out, opacity 0.6s ease-out;
      z-index: 15;
    `;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -120%)';
      popup.style.opacity = '0';
    });
    setTimeout(() => popup.remove(), 650);
  }

  function dispose() {
    el.remove();
  }

  return { render, showScorePopup, dispose };
}
```

- [ ] **Step 3: Wire effects + popups into `game/src/gameplay/game.js`**

```js
import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
import { createEffects } from './effects.js';
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
  const targetManager = createTargetManager(engine.scene, CONFIG);
  const effects = createEffects(engine.scene);
  const hud = createHud(container);
  const screens = createScreens(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const raycaster = new THREE.Raycaster();

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
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = highScore === scoreState.score && scoreState.score > 0;
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
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
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

    if (targetManager.allCleared()) {
      sfx.roundClear();
      beginRound(round + 1);
      updateHud();
    }
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    screens.showMenu(startGame);
    engine.start((dt) => {
      targetManager.update(dt);
      effects.update(dt);

      if (phase === 'playing') {
        timeRemaining -= dt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
        }
      }

      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`, play a round. Confirm: every successful hit spawns a small yellow particle burst at the monkey's position that expands and fades within half a second, and a floating `+<score>` text appears near the hit point and drifts upward while fading out.

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/effects.js game/src/ui/hud.js game/src/gameplay/game.js
git commit -m "feat: add hit particle bursts and floating score popups"
```

---

### Task 15: Final verification pass

**Files:** none created; verification only.

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all Vitest suites (`difficulty`, `scoring`, `shooting`) PASS with no failures.

- [ ] **Step 2: Verify the production build**

```bash
npm run build
```

Expected: succeeds with no errors, producing `dist/index.html` and `dist/assets/*.js`.

- [ ] **Step 3: Verify the production build actually runs**

```bash
npm run preview
```

Open the printed local URL and confirm the built (not dev-server) version loads the menu and is playable end-to-end (same checklist as Task 13 Step 3, abbreviated: start → shoot → clear a round → let the game end → see game-over screen).

- [ ] **Step 4: Confirm project structure matches the Verse8/Vite requirement**

```bash
git ls-files game/index.html vite.config.js package.json
```

Expected output includes exactly:
```
game/index.html
package.json
vite.config.js
```

This confirms `game/index.html` is the Vite entry point and the config/manifest live at the repo root, per the Verse8 upload requirement from the design doc.

- [ ] **Step 5: Final commit (if any working-tree changes remain)**

```bash
git status
```

If clean, no commit needed. If anything is unstaged (e.g. from manual verification edits that were reverted), review with `git diff` before deciding whether to stage and commit.

---

## Self-Review Notes

- **Spec coverage:** 1인칭 조준/발사(Task 6, 10) · 관통 멀티히트(Task 4, 10) · 헤드샷/콤보/스트릭 점수(Task 3, 14) · 원숭이 조립·애니메이션·피격 반응(Task 8) · 라운드/난이도 곡선(Task 2, 9, 13) · 최고점수 저장(Task 3, 13) · 종료조건(타이머/미스 한도, Task 13) · SFX(Task 11) · HUD/메뉴/게임오버(Task 12, 13) · 파티클/점수 팝업(Task 14) · `game/` Vite 루트 구조(Task 1, 15) · Vitest 순수 로직 테스트(Task 2, 3, 4) — all covered.
- **Type consistency checked:** `part` is always `'head' | 'body'` across `monkey.js`, `shooting.js`, `scoring.js`. `shotOutcome` shape (`isMiss`, `penetrationCount`, `hits[].{monkeyId, part, penetrationIndex}`) is identical between the Task 4 tests, `scoring.js` consumers, and `game.js` usage. `CONFIG` field names used in `difficulty.js`/`scoring.js`/`game.js` match the single definition in Task 2 exactly (no renamed fields).
- **No placeholders:** every step contains complete, runnable code; no "add tests for the above" or "handle appropriately" steps remain.
