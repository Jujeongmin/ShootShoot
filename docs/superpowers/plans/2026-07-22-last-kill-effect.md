# 마지막 원숭이 처치 연출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매 라운드의 마지막 원숭이를 잡는 샷에서 약 0.6초(실제 시간) 동안 슬로우모션(0.3배) + FOV 줌인 연출이 발동했다가 자연스럽게 원래대로 복귀하게 한다. 카메라 위치/회전은 건드리지 않는다.

**Architecture:** 새 순수 모듈 `lastKillEffect.js`가 "발사하고 잊는" 방식의 타이머 상태머신을 제공한다 — `trigger()`로 시작하면 내부적으로 실제(스케일 안 된) 경과 시간을 세면서 `getTimeScale()`(0.3 또는 1.0)과 `getFovDelta()`(줄어드는 줌인 오프셋)를 계산해준다. `targetManager.js`에 `hasAliveMonkeys()`를 추가해 "아직 안 맞은 원숭이가 남아있는가"를 판정한다. `game.js`의 `handleShot()`이 명중 처리 직후 "이 샷으로 살아있는 원숭이가 다 없어졌는가"를 판정해 트리거하고, 틱 루프가 매 프레임 `lastKillEffect.update(dt)`(실제 dt)로 진행시킨 뒤 `scaledDt = dt * getTimeScale()`을 원숭이/저격총/이펙트 업데이트와 라운드 타이머 감소에 사용하며, FOV 계산에 `getFovDelta()`를 오프셋으로 뺀다.

**Tech Stack:** Vanilla JS ES 모듈, Vitest(순수 함수 테스트).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 카메라 위치(`position`)와 회전(`rotation`)은 전혀 건드리지 않는다 — FOV만 조정한다.
- 연출 지속시간(0.6초)은 **실제(wall-clock) 시간** 기준이다 — `lastKillEffect.update()`는 스케일되지 않은 원본 `dt`로 호출해야 한다.
- 연출 발동 판정은 `handleShot()` 안에서 그 샷의 명중 처리 직후 한 번만 이루어진다 — 틱 루프의 라운드 클리어 체크(`allCleared()`)와는 별개이며, 그 체크의 순서/위치를 바꾸지 않는다.
- 화면 플래시, 사운드, 카메라 이동 등 추가 연출은 만들지 않는다 — 슬로우모션 + FOV 줌만.

---

### Task 1: `lastKillEffect.js` — 연출 상태머신 (순수, 테스트)

**Files:**
- Create: `game/src/gameplay/lastKillEffect.js`
- Test: `test/lastKillEffect.test.js`

**Interfaces:**
- Produces: `createLastKillEffect() -> { trigger(): void, update(realDt: number): void, getTimeScale(): number, getFovDelta(): number }` — Task 2가 이 시그니처로 소비한다.

- [ ] **Step 1: `test/lastKillEffect.test.js`에 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { createLastKillEffect } from '../game/src/gameplay/lastKillEffect.js';

describe('createLastKillEffect', () => {
  it('is inactive before any trigger', () => {
    const effect = createLastKillEffect();
    expect(effect.getTimeScale()).toBe(1);
    expect(effect.getFovDelta()).toBe(0);
  });

  it('activates immediately on trigger with full FOV delta and slow time scale', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBe(10);
  });

  it('eases the FOV delta back toward 0 as real time passes, while still active', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.3);
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBeCloseTo(5, 5);
  });

  it('deactivates once the effect duration has fully elapsed', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.6);
    expect(effect.getTimeScale()).toBe(1);
    expect(effect.getFovDelta()).toBe(0);
  });

  it('can be retriggered after deactivating', () => {
    const effect = createLastKillEffect();
    effect.trigger();
    effect.update(0.6);
    effect.trigger();
    expect(effect.getTimeScale()).toBe(0.3);
    expect(effect.getFovDelta()).toBe(10);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test` (저장소 루트 `C:\Users\anjsh\OneDrive\Desktop\ShootShoot`에서 실행)
Expected: FAIL — `lastKillEffect.js` 파일이 없어서 새로 추가한 5개 테스트만 import 에러로 실패, 나머지 32개 테스트는 그대로 통과.

- [ ] **Step 3: `lastKillEffect.js` 구현**

```js
const EFFECT_DURATION = 0.6;
const TIME_SCALE = 0.3;
const MAX_FOV_DELTA = 10;

export function createLastKillEffect() {
  let elapsed = EFFECT_DURATION;

  function isActive() {
    return elapsed < EFFECT_DURATION;
  }

  function trigger() {
    elapsed = 0;
  }

  function update(realDt) {
    if (elapsed < EFFECT_DURATION) {
      elapsed += realDt;
    }
  }

  function getTimeScale() {
    return isActive() ? TIME_SCALE : 1;
  }

  function getFovDelta() {
    if (!isActive()) return 0;
    const t = elapsed / EFFECT_DURATION;
    return MAX_FOV_DELTA * (1 - t);
  }

  return { trigger, update, getTimeScale, getFovDelta };
}
```

- [ ] **Step 4: 테스트 실행해서 전체 통과 확인**

Run: `npm test`
Expected: PASS — 전체 37개 테스트 통과(기존 32개 + 새로 추가한 5개).

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/lastKillEffect.js test/lastKillEffect.test.js
git commit -m "feat: add last-kill slow-motion/zoom effect state machine"
```

---

### Task 2: `targetManager.js` + `game.js` — 발동 판정 + 게임 루프 연결

**Files:**
- Modify: `game/src/gameplay/targetManager.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `createLastKillEffect() -> { trigger(), update(realDt), getTimeScale(), getFovDelta() }`(Task 1).

- [ ] **Step 1: `targetManager.js`에 `hasAliveMonkeys()` 추가**

`game/src/gameplay/targetManager.js`의 `hasDyingMonkeys` 함수와 `return` 문을 다음과 같이 수정한다.

변경 전:
```js
  function hasDyingMonkeys() {
    return monkeys.some((monkey) => monkey.isDying());
  }

  return { spawnRound, update, getRaycastMeshes, findMonkey, allCleared, clear, hasDyingMonkeys };
```

변경 후:
```js
  function hasDyingMonkeys() {
    return monkeys.some((monkey) => monkey.isDying());
  }

  function hasAliveMonkeys() {
    return monkeys.some((monkey) => !monkey.isDying());
  }

  return { spawnRound, update, getRaycastMeshes, findMonkey, allCleared, clear, hasDyingMonkeys, hasAliveMonkeys };
```

(이 파일의 다른 함수는 전혀 건드리지 않는다. `targetManager.js`는 Three.js 씬 그래프에 의존하는 모듈이라 `monkeyModel.js`/`obstacles.js`와 마찬가지로 Vitest 유닛 테스트 대상이 아니다 — Step 4의 빌드 검증과 Step 5의 수동 확인으로 검증한다.)

- [ ] **Step 2: `game.js`에 import + 인스턴스 추가**

`game/src/gameplay/game.js` 최상단 import 목록에 추가. 기존 `import { createAdRewardPanel } from '../ui/adRewardPanel.js';` 다음 줄에:

```js
import { createLastKillEffect } from './lastKillEffect.js';
```

`createGame` 함수 내부, 기존 `const raycaster = new THREE.Raycaster();` 다음 줄에 추가:

```js
  const lastKillEffect = createLastKillEffect();
```

- [ ] **Step 3: `handleShot()`에 발동 판정 추가**

`handleShot` 함수 내부, 명중 처리 루프 다음(그리고 기존 `if (outcome.isMiss) { sfx.miss(); }...` 분기 이전)에 추가한다.

변경 전:
```js
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
```

변경 후:
```js
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
```

(이 판정은 `handleShot()`이 실행되는 그 순간, 이 샷의 명중 처리가 끝난 직후 딱 한 번만 이루어진다 — 틱 루프의 `allCleared()` 라운드 클리어 체크와는 완전히 별개이며, 그 체크의 위치/순서는 이 스텝에서 전혀 손대지 않는다.)

- [ ] **Step 4: 틱 루프에 `scaledDt` 적용**

`start()` 함수 내부 `engine.start((dt) => {...})` 콜백을 다음과 같이 수정한다.

변경 전:
```js
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
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          } else if (ammoRemaining <= 0 && !targetManager.hasDyingMonkeys()) {
            endGame();
          }
        }
      }

      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
```

변경 후:
```js
    engine.start((dt) => {
      lastKillEffect.update(dt);
      const scaledDt = dt * lastKillEffect.getTimeScale();

      if (targetManager) {
        targetManager.update(scaledDt);
      }
      if (rifleViewmodel) {
        rifleViewmodel.update(scaledDt);
        rifleViewmodel.setVisible(!input.isAiming());
      }
      effects.update(scaledDt);

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
        timeRemaining -= scaledDt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          } else if (ammoRemaining <= 0 && !targetManager.hasDyingMonkeys()) {
            endGame();
          }
        }
      }

      engine.setFov((input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov) - lastKillEffect.getFovDelta());
    });
```

(주의: `lastKillEffect.update(dt)`는 반드시 스케일 전 원본 `dt`로 호출해야 한다 — `scaledDt`로 호출하면 슬로우모션이 스스로를 계속 느리게 만들어 끝나지 않는다. `if (input.isAiming()) {...} else {...}` 블록은 `dt`를 전혀 쓰지 않으므로(매 프레임 NDC로부터 직접 회전값을 계산) 이 블록은 건드리지 않는다 — 카메라 위치/회전을 손대지 않는다는 제약을 그대로 지킨다. 라운드 클리어/총알 소진 분기(`if (targetManager.allCleared()) {...} else if (ammoRemaining <= 0 ...) {...}`)의 내부 로직과 순서는 전혀 바꾸지 않는다 — `timeRemaining -= dt`가 `timeRemaining -= scaledDt`로만 바뀐다.)

- [ ] **Step 5: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 6: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 37개 테스트 전부 통과(이 작업은 `targetManager.js`/`game.js`만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 7: 브라우저에서 수동 확인**

Run: `npm run dev`, 게임 시작 → 한 라운드의 마지막 원숭이를 맞혀서 잡는 순간 화면이 짧게 느려지면서 살짝 줌인되었다가 다시 정상 속도/화면으로 돌아오는지 확인 → 카메라가 좌우로 돌아가거나 위치가 움직이지 않는지(조준 여부와 무관하게 시야각만 변하는지) 확인 → 연출 도중에도 조준/발사가 정상 동작하는지(입력이 막히지 않는지) 확인 → 다음 라운드로 정상 진행되는지(연출이 라운드 전환을 막지 않는지) 확인 → 여러 라운드를 클리어하며 매번 발동하는지 확인.

- [ ] **Step 8: Commit**

```bash
git add game/src/gameplay/targetManager.js game/src/gameplay/game.js
git commit -m "feat: trigger slow-motion/zoom effect on the round-clearing kill"
```

---

## Self-Review Notes

- **스펙 커버리지**: 발동 조건(2.1) → Task 2 Step 1(`hasAliveMonkeys`) + Step 3(`handleShot` 판정). 연출 내용(2.2) → Task 1(`lastKillEffect.js`). 게임 루프 연결(2.3) → Task 2 Step 4. 비목표(카메라 이동/회전 없음, 추가 연출 없음, 총알 소진 판정 로직 불변, 설정 화면 노출 없음) → 계획에 해당 기능이 아예 등장하지 않거나(카메라 이동, 추가 연출, 설정 노출) `if (input.isAiming())` 블록을 건드리지 않음으로써 명시적으로 충족(카메라 회전 불변).
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `createLastKillEffect() -> { trigger(), update(realDt), getTimeScale(), getFovDelta() }`(Task 1) → `game.js`가 그대로 소비(Task 2 Step 2-4). `hasAliveMonkeys()`(Task 2 Step 1) → `handleShot()`이 `!targetManager.hasAliveMonkeys()`로 소비(Task 2 Step 3) — 일치.
- **기존 로직 보존 확인**: 라운드 클리어/총알 소진 분기의 조건문·순서, `endGame()`의 두 불변 조건(하이스코어 읽기 순서, 라운드 클리어가 `else` 분기 안에 있는 것), 조준 카메라 회전 로직(`if (input.isAiming())` 블록)은 이번 계획에서 전혀 건드리지 않는다 — Task 2의 변경은 `dt`를 `scaledDt`로 바꾸는 것과 FOV 계산에 오프셋을 빼는 것, `handleShot()`에 트리거 판정 한 블록을 추가하는 것뿐이다.
- **경쟁 상태 없음 확인**: `lastKillEffect.trigger()`는 `handleShot()` 실행 중 한 번만 호출되고, 이후 매 틱 `update(dt)`가 원본 dt로 독립적으로 진행되므로, 같은 라운드에서 여러 발의 관통샷이 동시에 마지막 원숭이들을 잡아도(`outcome.hits`에 여러 마리가 한 번에 포함되는 경우) `trigger()`가 여러 번 불려도 문제없다 — `trigger()`는 단순히 `elapsed = 0`으로 리셋하는 멱등 연산이라, 같은 틱 안에서 여러 번 호출돼도 결과는 "지금 막 트리거된 상태" 하나로 수렴한다.
