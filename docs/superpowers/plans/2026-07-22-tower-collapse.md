# 구조물 추락사 — 상자 기둥 탑 붕괴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 상자 단독 배치 2곳을 "기둥(상자 2개 쌓기) + 발판(모래주머니) + 원숭이 1마리" 탑으로 교체한다. 기둥 중 하나만 맞아도 탑이 무너지고 위의 원숭이가 추락사(고정 보너스 점수)한다. 직접 조준도 여전히 가능하다.

**Architecture:** `obstacles.js`가 탑 구조(기둥 메쉬, 발판, 붕괴 애니메이션 상태)와 새 인터페이스(`getPillarMeshes()`, `getTowerSlots()`, `collapseTower(towerIndex)`, `update(dt)`)를 제공한다. `targetManager.js`는 라운드 원숭이 중 정확히 2마리(탑 슬롯 수만큼)를 탑 위에 고정 배치(흔들림 없음)하고 나머지를 기존 레일 시스템으로 배치하며, `findMonkeyAtTower(towerIndex)`로 탑 위 원숭이를 조회할 수 있게 한다. `game.js`의 `handleShot()`이 레이캐스트 명중 분류를 "원숭이(관통)/기둥(명중+정지)/그 외 장애물(차단)" 삼분법으로 확장하고, 기둥 명중 시 탑 붕괴 + 원숭이 사망(기존 `hit()` 애니메이션 재사용) + 고정 보너스 점수를 별도 경로로 처리한다(기존 관통 점수 파이프라인과 독립).

**Tech Stack:** Vanilla JS ES 모듈, Three.js(신규 의존성 없음, 기존 크레이트/모래주머니 에셋 재사용).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 탑은 정확히 2개, 기존 상자 단독 배치 위치(`x: 0.5, z: -7.5`와 `x: -1.5, z: -8.5`)를 그대로 재사용. 기존 모래주머니 2개(지면 엄폐물)는 그대로 유지.
- 기둥 중 하나만 맞아도 즉시 붕괴 — 두 기둥 다 맞힐 필요 없음.
- 탑 위 원숭이는 흔들리지 않음(`sway.amplitude = 0`), bob/taunt는 정상 재생.
- 탑 붕괴로 죽은 원숭이는 기존 `monkey.hit(part)` 애니메이션을 그대로 재사용 — 새 애니메이션 상태를 만들지 않음.
- 탑 붕괴 보너스 점수(`CONFIG.score.towerCollapseBonus = 200`)는 콤보/연속 배율과 무관한 고정값 — 기존 `resolveShot`/`shooting.js`는 수정하지 않는다.
- 물리 기반 붕괴 시뮬레이션은 만들지 않음 — 단순 절차적 트윈(회전+낙하+페이드, 0.3초).
- 라운드가 새로 시작되면 탑은 항상 온전한 상태로 리셋된다(`spawnRound`가 매번 새로 배치하므로 자동 해결).

---

### Task 1: `obstacles.js` — 탑 구조 + 붕괴 애니메이션

**Files:**
- Modify: `game/src/gameplay/obstacles.js`

**Interfaces:**
- Produces: `getPillarMeshes() -> THREE.Mesh[]`(각 메쉬의 `userData.towerIndex`로 소속 탑 식별), `getTowerSlots() -> [{ x, y, z, towerIndex }]`(탑 위 원숭이 배치 위치), `collapseTower(towerIndex: number)`(붕괴 트리거, 멱등), `update(dt: number)`(붕괴 애니메이션 진행). 기존 `getBlockingMeshes()`는 시그니처 불변(모래주머니만 반환).

- [ ] **Step 1: `game/src/gameplay/obstacles.js` 전체 교체**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CRATE_URL = '/models/crate.glb';
const SACK_TRENCH_URL = '/models/sack-trench.glb';
const CRATE_SCALE = 6;
const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;
const CRATE_UNIT_HEIGHT = 0.9612;
const PILLAR_OFFSET_X = 0.8;
const FLOOR_ROTATION_X = -Math.PI / 2;
const FLOOR_THICKNESS = 0.8;
const COLLAPSE_DURATION = 0.3;
const COLLAPSE_TILT = Math.PI / 2;
const COLLAPSE_DROP = 0.6;

const GROUND_PLACEMENTS = [
  { x: -3, z: -9 },
  { x: 2.5, z: -10 },
];

const TOWER_PLACEMENTS = [
  { x: 0.5, z: -7.5 },
  { x: -1.5, z: -8.5 },
];

function collectMaterials(object, materials) {
  const mats = Array.isArray(object.material) ? object.material : [object.material];
  materials.push(...mats);
}

export function loadObstacles(scene) {
  const loader = new GLTFLoader();
  return Promise.all([loader.loadAsync(CRATE_URL), loader.loadAsync(SACK_TRENCH_URL)]).then(
    ([crateGltf, sackTrenchGltf]) => {
      const blockingMeshes = [];
      const towers = [];

      for (const placement of GROUND_PLACEMENTS) {
        const instance = sackTrenchGltf.scene.clone();
        instance.scale.setScalar(SACK_TRENCH_SCALE);
        instance.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(instance);
        instance.traverse((object) => {
          if (object.isMesh) blockingMeshes.push(object);
        });
      }

      TOWER_PLACEMENTS.forEach((placement, towerIndex) => {
        const group = new THREE.Group();
        group.position.set(placement.x, 0, placement.z);
        scene.add(group);

        const pillarMeshes = [];
        const materials = [];

        for (const offsetX of [-PILLAR_OFFSET_X, PILLAR_OFFSET_X]) {
          for (let level = 0; level < 2; level++) {
            const crateInstance = crateGltf.scene.clone();
            crateInstance.scale.setScalar(CRATE_SCALE);
            crateInstance.position.set(offsetX, GROUND_Y + level * CRATE_UNIT_HEIGHT, 0);
            group.add(crateInstance);
            crateInstance.traverse((object) => {
              if (object.isMesh) {
                object.userData = { towerIndex };
                pillarMeshes.push(object);
                collectMaterials(object, materials);
              }
            });
          }
        }

        const pillarTopY = GROUND_Y + 2 * CRATE_UNIT_HEIGHT;
        const floor = sackTrenchGltf.scene.clone();
        floor.scale.setScalar(SACK_TRENCH_SCALE);
        floor.rotation.x = FLOOR_ROTATION_X;
        floor.position.set(0, pillarTopY, 0);
        group.add(floor);
        floor.traverse((object) => {
          if (object.isMesh) collectMaterials(object, materials);
        });

        towers.push({
          towerIndex,
          group,
          pillarMeshes,
          materials,
          collapsing: false,
          collapsed: false,
          collapseElapsed: 0,
          monkeySlot: { x: placement.x, y: pillarTopY + FLOOR_THICKNESS, z: placement.z, towerIndex },
        });
      });

      function update(dt) {
        for (const tower of towers) {
          if (!tower.collapsing || tower.collapsed) continue;
          tower.collapseElapsed += dt;
          const t = Math.min(tower.collapseElapsed / COLLAPSE_DURATION, 1);
          tower.group.rotation.z = t * COLLAPSE_TILT;
          tower.group.position.y = -t * COLLAPSE_DROP;
          for (const material of tower.materials) {
            material.transparent = true;
            material.opacity = 1 - t;
          }
          if (t >= 1) {
            tower.collapsed = true;
            tower.group.visible = false;
          }
        }
      }

      return {
        getBlockingMeshes() {
          return blockingMeshes;
        },
        getPillarMeshes() {
          return towers.filter((tower) => !tower.collapsing).flatMap((tower) => tower.pillarMeshes);
        },
        getTowerSlots() {
          return towers.map((tower) => tower.monkeySlot);
        },
        collapseTower(towerIndex) {
          const tower = towers.find((t) => t.towerIndex === towerIndex);
          if (!tower || tower.collapsing) return;
          tower.collapsing = true;
        },
        update,
      };
    }
  );
}
```

(측정 근거: `crate.glb` 원본 바운딩박스 높이 0.1602 × `CRATE_SCALE=6` = `CRATE_UNIT_HEIGHT=0.9612` — 기존 `obstacles.js`에 이미 있던 실측값을 그대로 사용. `PILLAR_OFFSET_X`, `FLOOR_THICKNESS`, `COLLAPSE_TILT`/`COLLAPSE_DROP`은 초기 추정치 — Task 3의 수동 확인 스텝에서 시각적으로 조정한다.)

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. 이 모듈은 순수 Three.js 씬 구성이라 Vitest 유닛 테스트 대상이 아니다(`monkeyModel.js`, 기존 `obstacles.js`와 동일한 검증 방식) — Task 3의 브라우저 확인에서 실제 배치/붕괴를 검증한다.

- [ ] **Step 3: Commit**

```bash
git add game/src/gameplay/obstacles.js
git commit -m "feat: replace crate obstacles with collapsible pillar towers"
```

---

### Task 2: `targetManager.js` — 탑 위 원숭이 배치 + 조회

**Files:**
- Modify: `game/src/gameplay/targetManager.js`

**Interfaces:**
- Consumes: `obstacles.getTowerSlots() -> [{x, y, z, towerIndex}]`(Task 1) — `createTargetManager`의 새 4번째 인자로 전달받는다.
- Produces: `findMonkeyAtTower(towerIndex: number) -> monkey | undefined` — Task 3이 소비한다. `createTargetManager(scene, config, monkeyModel, towerSlots)`로 시그니처가 확장된다.

- [ ] **Step 1: `game/src/gameplay/targetManager.js` 전체 교체**

```js
import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';
import { computeLaneLayout } from './laneLayout.js';

export function createTargetManager(scene, config, monkeyModel, towerSlots) {
  let monkeys = [];
  let nextId = 0;
  let towerMonkeyIds = new Map();

  function clear() {
    for (const monkey of monkeys) scene.remove(monkey.group);
    monkeys = [];
    towerMonkeyIds = new Map();
  }

  function spawnRound(roundNumber) {
    clear();
    const params = getRoundParams(roundNumber, config);

    for (const slot of towerSlots) {
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: { amplitude: 0, frequency: params.monkeySpeed, phase: 0 },
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
      towerMonkeyIds.set(slot.towerIndex, monkey.id);
    }

    const laneMonkeyCount = params.monkeyCount - towerSlots.length;
    const layout = computeLaneLayout(laneMonkeyCount, params.monkeySpeed, params.monkeyScale);
    for (let i = 0; i < laneMonkeyCount; i++) {
      const slot = layout[i];
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: { amplitude: slot.swayAmplitude, frequency: slot.swayFrequency, phase: slot.swayPhase },
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

  function findMonkeyAtTower(towerIndex) {
    const id = towerMonkeyIds.get(towerIndex);
    return id ? findMonkey(id) : undefined;
  }

  function allCleared() {
    return monkeys.length === 0;
  }

  function hasDyingMonkeys() {
    return monkeys.some((monkey) => monkey.isDying());
  }

  function hasAliveMonkeys() {
    return monkeys.some((monkey) => !monkey.isDying());
  }

  return {
    spawnRound,
    update,
    getRaycastMeshes,
    findMonkey,
    findMonkeyAtTower,
    allCleared,
    clear,
    hasDyingMonkeys,
    hasAliveMonkeys,
  };
}
```

(라운드 최소 원숭이 수는 `CONFIG.round.baseMonkeyCount = 3`이고 탑 슬롯은 항상 2개이므로 `laneMonkeyCount`는 항상 1 이상이다 — `computeLaneLayout`은 이미 1마리 케이스를 지원한다(레일 스폰 플랜에서 검증됨). `update`, `getRaycastMeshes`, `findMonkey`, `allCleared`, `hasDyingMonkeys`, `hasAliveMonkeys`의 내부 로직은 이전과 동일 — 시그니처와 `spawnRound`, `clear`만 바뀐다.)

- [ ] **Step 2: `game.js`의 `createTargetManager` 호출부 수정**

`game/src/gameplay/game.js`의 `Promise.all(...).then(...)` 콜백 안, `targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);` 줄을 다음과 같이 바꾼다.

변경 전:
```js
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
```

변경 후:
```js
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, obstacles.getTowerSlots());
```

(이 콜백 안에서 `obstacles = resolvedObstacles;`가 바로 윗줄에서 이미 실행되었으므로 `obstacles.getTowerSlots()` 호출 시점에는 `obstacles`가 이미 유효하다. 이 한 줄 외에 `game.js`의 다른 부분은 이 Task에서 건드리지 않는다 — 레이캐스트/점수 로직 연결은 Task 3에서 다룬다.)

- [ ] **Step 3: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 4: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 44개 테스트 전부 통과(이 작업은 씬 그래프 모듈만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/targetManager.js game/src/gameplay/game.js
git commit -m "feat: place tower monkeys separately from lane-spawned monkeys"
```

---

### Task 3: `game.js` — 기둥 명중 판정 + 붕괴/점수/이펙트 연결

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `obstacles.getPillarMeshes()`/`obstacles.collapseTower(towerIndex)`/`obstacles.update(dt)`(Task 1), `targetManager.findMonkeyAtTower(towerIndex)`(Task 2).

- [ ] **Step 1: `config.js`에 탑 붕괴 보너스 점수 추가**

`game/src/config.js`의 `score` 객체에서 `streakMultiplierCap: 2.0,` 다음 줄에 추가:

```js
  score: {
    baseHit: 100,
    headshotBonus: 150,
    comboMultiplierPerPenetration: 0.5,
    streakMultiplierStep: 0.1,
    streakMultiplierCap: 2.0,
    towerCollapseBonus: 200,
  },
```

- [ ] **Step 2: 틱 루프에 `obstacles.update(scaledDt)` 추가**

`game/src/gameplay/game.js`의 `engine.start((dt) => {...})` 콜백 안, 기존 `effects.update(scaledDt);` 다음 줄에 추가:

```js
      if (obstacles) {
        obstacles.update(scaledDt);
      }
```

(다른 `if (targetManager) {...}`, `if (rifleViewmodel) {...}` 블록과 동일한 패턴 — 붕괴 애니메이션도 슬로우모션 연출 중엔 같이 느려진다.)

- [ ] **Step 3: `handleShot()`을 전체 교체**

`game/src/gameplay/game.js`의 `handleShot` 함수 전체를 다음으로 바꾼다.

변경 전:
```js
  function handleShot() {
    if (phase !== 'playing' || ammoRemaining <= 0) return;
    ammoRemaining -= 1;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const raycastTargets = [...targetManager.getRaycastMeshes(), ...obstacles.getBlockingMeshes()];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId } = intersection.object.userData;
      if (!monkeyId) break;
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

    if (!outcome.isMiss && !targetManager.hasAliveMonkeys()) {
      lastKillEffect.trigger();
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
```

변경 후:
```js
  function handleShot() {
    if (phase !== 'playing' || ammoRemaining <= 0) return;
    ammoRemaining -= 1;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const raycastTargets = [
      ...targetManager.getRaycastMeshes(),
      ...obstacles.getBlockingMeshes(),
      ...obstacles.getPillarMeshes(),
    ];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

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

    const outcome = resolveShot(hits);
    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
    const effectiveOutcome = isPureTowerHit ? { isMiss: false, penetrationCount: 0, hits: [] } : outcome;
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

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

    if (hitTowerIndex !== null) {
      obstacles.collapseTower(hitTowerIndex);
      const towerMonkey = targetManager.findMonkeyAtTower(hitTowerIndex);
      if (towerMonkey && !towerMonkey.isDying()) {
        const worldPos = towerMonkey.getWorldPosition();
        effects.spawnHitBurst(worldPos);
        towerMonkey.hit('body');
        scoreState = { ...scoreState, score: scoreState.score + CONFIG.score.towerCollapseBonus };
        const screenPos = worldToScreen(worldPos, engine.camera, container);
        hud.showScorePopup(`+${CONFIG.score.towerCollapseBonus}`, screenPos.x, screenPos.y);
      }
    }

    if (!effectiveOutcome.isMiss && !targetManager.hasAliveMonkeys()) {
      lastKillEffect.trigger();
    }

    if (hitTowerIndex !== null) {
      sfx.hit();
    } else if (effectiveOutcome.isMiss) {
      sfx.miss();
    } else if (effectiveOutcome.penetrationCount > 1) {
      sfx.combo();
    } else if (effectiveOutcome.hits[0].part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }

    if (!effectiveOutcome.isMiss && popupWorldPosition) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y);
    }

    updateHud();

    if (scoreState.misses >= CONFIG.missLimit) {
      endGame();
      return;
    }
  }
```

(핵심 설계 근거:
- 레이캐스트 분류가 이분법(원숭이/그 외)에서 삼분법(원숭이/기둥/그 외 장애물)으로 바뀐다 — 원숭이는 계속 관통(`continue`), 기둥이든 다른 장애물이든 순회는 멈추지만(`break`) 기둥인 경우만 `hitTowerIndex`를 기록한다.
- `isPureTowerHit`(원숭이는 하나도 안 맞고 기둥만 맞은 경우)일 때 `resolveShot([])`이 원래 `{isMiss: true}`를 반환해서 미스로 카운트되는 걸 막기 위해, 점수 파이프라인(`calculateShotScore`/`applyShot`)에는 `effectiveOutcome`(미스 아님, 관통 0)을 넣는다 — 이러면 미스 카운트는 안 되고 스트릭은 유지/증가하되, 관통 점수 자체는 0(빈 `hits`)이라 `gained`도 0이 된다. 탑 보너스 점수(200)는 이 파이프라인과 별개로 직접 `scoreState.score`에 더한다(스펙의 "콤보/연속 배율과 무관한 고정값" 요구사항).
- 원숭이 관통 히트를 먼저 처리한 뒤 기둥 처리를 하므로, "관통 후 기둥에 막힌" 복합 샷에서도 관통 히트들이 먼저 정상 처리되고 탑 보너스가 추가로 붙는다.
- 마지막 원숭이 처치 연출 트리거를 `outcome.isMiss` 대신 `effectiveOutcome.isMiss`로 검사하도록 바꿨다 — 탑 붕괴만으로 라운드 마지막 원숭이를 잡아도(관통 히트가 0이라 원래 `outcome.isMiss`가 `true`였을 경우) 연출이 정상 발동하게 하기 위함. 이 체크는 탑 처리 블록 **다음**에 있어야 `targetManager.hasAliveMonkeys()`가 방금 죽은 탑 원숭이를 반영한다.
- sfx 분기도 `hitTowerIndex`가 있으면 최우선으로 `sfx.hit()`을 재생하도록 앞에 추가했다 — `effectiveOutcome.hits[0]`이 빈 배열이라 `.part` 접근 시 크래시하는 것을 막기 위함(`isPureTowerHit`이면 `effectiveOutcome.hits`가 항상 `[]`).
- `resolveShot`/`shooting.js`는 이 스텝에서 전혀 수정하지 않는다 — `hits` 배열 구성과 `effectiveOutcome` 오버라이드만으로 처리한다.)

- [ ] **Step 4: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 5: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 44개 테스트 전부 통과(이 작업은 `config.js`/`game.js`만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 6: 브라우저에서 수동 확인**

Run: `npm run dev`, 게임 시작 → 지면에 모래주머니 2개(엄폐물)와 상자 기둥 탑 2개(기둥+발판+원숭이)가 보이는지 확인 → 탑 위 원숭이가 흔들리지 않고 가만히 서있는지(bob/taunt는 정상 재생) 확인 → 기둥 중 하나를 쏘면 탑이 기울며 무너지고 원숭이가 사망 애니메이션과 함께 추락하는지 확인 → 점수가 200 올라가는지, 미스로 카운트되지 않는지(HUD 미스 관련 표시는 없지만 게임오버가 안 되는 것으로 간접 확인) 확인 → 탑 위 원숭이를 직접 조준해서 맞혀도 정상적으로 죽는지 확인 → 탑이 이미 무너진 상태에서 같은 자리를 다시 쏘면 아무 일도 없는지(기둥이 더는 레이캐스트 대상이 아님) 확인 → 라운드를 클리어해서 다음 라운드에 탑이 다시 온전하게 리셋되는지 확인 → 기둥/발판/간격 크기가 시각적으로 어색하면 `obstacles.js`의 `PILLAR_OFFSET_X`/`FLOOR_THICKNESS`/`CRATE_UNIT_HEIGHT` 상수를 조정해서 재확인.

- [ ] **Step 7: Commit**

```bash
git add game/src/config.js game/src/gameplay/game.js
git commit -m "feat: wire pillar hit detection, tower collapse, and fall-death scoring"
```

---

## Self-Review Notes

- **스펙 커버리지**: 탑 구조(2.1) → Task 1. 붕괴 판정(2.2) → Task 3 Step 3의 삼분법 분류. 붕괴 연출 + 추락사(2.3) → Task 1의 `update`/`collapseTower` + Task 3의 `hit()` 재사용/보너스 점수. 원숭이 배치와 레일 시스템 관계(2.4) → Task 2. 비목표(물리 시뮬레이션 없음, 새 애니메이션 없음, 탑 위 흔들림 없음, 양쪽 기둥 다 필요 없음, 탑 재배치 없음, 탑 재사용 없음) → 계획에 해당 기능이 아예 등장하지 않거나(물리/재배치) 명시적으로 반영됨(흔들림 0, `hit()` 재사용, 단일 기둥 붕괴).
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `getPillarMeshes()`/`getTowerSlots()`/`collapseTower(towerIndex)`/`update(dt)`(Task 1) → `targetManager.js`의 `createTargetManager(..., towerSlots)`가 `getTowerSlots()` 결과를 소비(Task 2), `game.js`가 나머지 세 개를 소비(Task 3). `findMonkeyAtTower(towerIndex)`(Task 2) → `game.js`가 소비(Task 3). 모든 `towerIndex` 필드명이 세 파일에서 일관됨.
- **기존 로직 보존 확인**: `shooting.js`(`resolveShot`)와 `scoring.js`(`calculateShotScore`/`applyShot`)는 이 계획에서 전혀 수정하지 않는다 — `game.js`가 `effectiveOutcome`이라는 로컬 오버라이드로 탑 전용 케이스를 흡수한다. 라운드 클리어/총알 소진 분기, `endGame()`의 두 불변 조건, 조준 카메라 회전 로직은 전혀 건드리지 않는다.
- **엣지 케이스 확인**: 탑 위 원숭이가 이미 직접 조준으로 죽은 뒤 플레이어가 같은 탑의 기둥을 쏘면 `obstacles.collapseTower(hitTowerIndex)`는 여전히 실행되어(탑은 무너짐) 시각적 일관성을 유지하되, `targetManager.findMonkeyAtTower(hitTowerIndex)`가 `undefined`(죽은 원숭이는 배열에서 제거됨)이므로 보너스 점수/추가 사망 처리는 일어나지 않는다 — 중복 킬/점수 방지. `getPillarMeshes()`가 붕괴 중인(`collapsing`) 탑의 기둥을 제외하므로, 이미 무너지는 중인 탑을 다시 쏴도 `hitTowerIndex`가 잡히지 않아 `collapseTower`가 중복 호출되지 않는다(어차피 그 함수 자체도 `tower.collapsing` 체크로 멱등하게 방어됨).
