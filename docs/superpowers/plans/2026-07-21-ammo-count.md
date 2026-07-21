# 총알 수 표시 + 소진 시 게임오버 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라운드마다 정해진 수의 총알만 쏠 수 있게 하고, HUD에 남은 총알을 표시하며, 총알을 다 쓰면(원숭이가 남아있는 상태에서) 즉시 게임오버가 되도록 한다. 재장전 기능은 만들지 않는다.

**Architecture:** `difficulty.js`의 기존 순수 함수 `getRoundParams()`가 라운드당 총알 수(`ammo`)도 함께 계산해 반환한다(`max(CONFIG.round.minAmmo, ceil(monkeyCount × CONFIG.round.ammoMultiplier))`). `game.js`가 `ammoRemaining` 상태를 추가해 매 라운드 시작 시 리셋하고, `handleShot()`이 발사할 때마다 1씩 차감한다. 총알 소진 게임오버는 `handleShot()`이 아니라 틱 루프의 라운드 클리어 체크 바로 옆(그 이후)에서 판정해, 마지막 총알로 마지막 원숭이를 잡았을 때 오탐 게임오버가 나지 않게 한다. `hud.js`가 총알 표시 줄을 추가한다.

**Tech Stack:** Vanilla JS ES 모듈, Vitest(순수 함수 테스트).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 재장전 기능(키 입력, 애니메이션, 타이머)은 만들지 않음.
- 기존 게임오버 조건(미스 5회, 타이머 만료)은 그대로 유지 — 총알 소진은 **추가** 조건이지 대체가 아님.
- 총알 소진 게임오버 판정은 라운드 클리어 체크(`targetManager.allCleared()`) **다음에** 이루어져야 한다 — 순서를 바꾸면 안 됨(마지막 총알로 라운드를 클리어한 경우 오탐 게임오버 방지).
- 라운드당 총알 수 = `max(CONFIG.round.minAmmo, ceil(그 라운드 monkeyCount × CONFIG.round.ammoMultiplier))`, `ammoMultiplier = 0.7`, `minAmmo = 3`.

---

### Task 1: `config.js` + `difficulty.js` — 총알 수 계산 (순수, 테스트)

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/difficulty.js`
- Test: `test/difficulty.test.js`

**Interfaces:**
- Produces: `getRoundParams(roundNumber, config)`의 반환 객체에 `ammo` 필드 추가 — `{ roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale, ammo }`. Task 3이 `roundParams.ammo`로 소비한다.

- [ ] **Step 1: `config.js`에 총알 관련 상수 추가**

`game/src/config.js`의 `round` 객체에서 `minMonkeyScale: 0.5,` 다음 줄에 추가:

```js
    minMonkeyScale: 0.5,
    ammoMultiplier: 0.7,
    minAmmo: 3,
  },
```

(기존 `minMonkeyScale: 0.5,` 줄과 그 다음 닫는 `},`만 위처럼 바뀐다 — `round` 객체의 다른 필드는 그대로 둔다.)

- [ ] **Step 2: `test/difficulty.test.js`에 실패하는 테스트 작성**

`test/difficulty.test.js`의 마지막 `it(...)` 블록(`'decreases time limit and scale...'`) 다음, `describe` 블록이 닫히기 전에 추가:

```js
  it('computes ammo per round as a fraction of monkey count, with a floor', () => {
    const round1 = getRoundParams(1, CONFIG);
    expect(round1.monkeyCount).toBe(3);
    expect(round1.ammo).toBe(3);

    const round3 = getRoundParams(3, CONFIG);
    expect(round3.monkeyCount).toBe(5);
    expect(round3.ammo).toBe(4);

    const round20 = getRoundParams(20, CONFIG);
    expect(round20.monkeyCount).toBe(10);
    expect(round20.ammo).toBe(7);
  });
```

(이 수치들은 현재 `CONFIG.round`의 실제 값 `baseMonkeyCount=3`, `monkeyCountIncreasePerRound=1`, `maxMonkeyCount=10`과 Step 1에서 추가한 `ammoMultiplier=0.7`, `minAmmo=3`을 그대로 계산한 값이다: 1라운드는 원숭이 3마리→`ceil(3×0.7)=3`(최솟값 3과 같음), 3라운드는 원숭이 5마리→`ceil(5×0.7)=4`, 20라운드는 최대 10마리→`ceil(10×0.7)=7`.)

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test` (저장소 루트 `C:\Users\anjsh\OneDrive\Desktop\ShootShoot`에서 실행)
Expected: FAIL — `round1.ammo`가 `undefined`라서 새로 추가한 `it` 블록만 실패, 나머지 24개 테스트는 그대로 통과.

- [ ] **Step 4: `difficulty.js`에 `ammo` 계산 추가**

`game/src/gameplay/difficulty.js` 전체를 다음으로 교체:

```js
export function getRoundParams(roundNumber, config) {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const timeLimit = Math.max(c.baseTimeLimit - n * c.timeLimitDecreasePerRound, c.minTimeLimit);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = Math.max(c.baseMonkeyScale - n * c.monkeyScaleDecreasePerRound, c.minMonkeyScale);
  const ammo = Math.max(c.minAmmo, Math.ceil(monkeyCount * c.ammoMultiplier));
  return { roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale, ammo };
}
```

- [ ] **Step 5: 테스트 실행해서 전체 통과 확인**

Run: `npm test`
Expected: PASS — 전체 25개 테스트 통과(기존 24개 + 새로 추가한 1개).

- [ ] **Step 6: Commit**

```bash
git add game/src/config.js game/src/gameplay/difficulty.js test/difficulty.test.js
git commit -m "feat: compute per-round ammo count in difficulty curve"
```

---

### Task 2: `hud.js` — 총알 표시 줄 추가

**Files:**
- Modify: `game/src/ui/hud.js`

**Interfaces:**
- Consumes: `render({ score, streak, round, timeRemaining, ammo, ammoMax })` — Task 3이 `ammo`/`ammoMax` 필드를 채워서 호출한다.

- [ ] **Step 1: `render` 함수에 총알 표시 추가**

`game/src/ui/hud.js`의 `render` 함수를 다음과 같이 수정한다.

변경 전:
```js
  function render({ score, streak, round, timeRemaining }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
    `;
  }
```

변경 후:
```js
  function render({ score, streak, round, timeRemaining, ammo, ammoMax }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
      <div>총알: ${ammo}/${ammoMax}</div>
    `;
  }
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. 이 모듈은 DOM 렌더링 함수라 Vitest 유닛 테스트 대상이 아니다(`screens.js`, `scopeOverlay.js`와 동일한 검증 방식) — Task 3에서 실제 값이 채워져 화면에 표시되는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git add game/src/ui/hud.js
git commit -m "feat: show ammo count in HUD"
```

---

### Task 3: `game.js` — 총알 상태 연결 + 발사 시 소모 + 소진 게임오버

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `getRoundParams`가 반환하는 `roundParams.ammo`(Task 1), `hud.render({ ..., ammo, ammoMax })`(Task 2).

- [ ] **Step 1: 상태 변수 추가**

`createGame` 함수 내부, 기존 `let timeRemaining = 0;` 다음 줄에 추가:

```js
  let ammoRemaining = 0;
  let ammoMax = 0;
```

- [ ] **Step 2: `beginRound`에서 총알 리셋**

`beginRound` 함수를 다음과 같이 수정한다.

변경 전:
```js
  function beginRound(roundNumber) {
    round = roundNumber;
    const roundParams = targetManager.spawnRound(roundNumber);
    timeRemaining = roundParams.timeLimit;
  }
```

변경 후:
```js
  function beginRound(roundNumber) {
    round = roundNumber;
    const roundParams = targetManager.spawnRound(roundNumber);
    timeRemaining = roundParams.timeLimit;
    ammoRemaining = roundParams.ammo;
    ammoMax = roundParams.ammo;
  }
```

- [ ] **Step 3: `updateHud`에 총알 값 전달**

`updateHud` 함수를 다음과 같이 수정한다.

변경 전:
```js
  function updateHud() {
    hud.render({
      score: scoreState.score,
      streak: scoreState.streak,
      round,
      timeRemaining: Math.max(timeRemaining, 0),
    });
  }
```

변경 후:
```js
  function updateHud() {
    hud.render({
      score: scoreState.score,
      streak: scoreState.streak,
      round,
      timeRemaining: Math.max(timeRemaining, 0),
      ammo: Math.max(ammoRemaining, 0),
      ammoMax,
    });
  }
```

- [ ] **Step 4: `handleShot`에 발사 가능 여부 체크 + 소모 추가**

`handleShot` 함수 맨 앞부분을 다음과 같이 수정한다.

변경 전:
```js
  function handleShot() {
    if (phase !== 'playing') return;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
```

변경 후:
```js
  function handleShot() {
    if (phase !== 'playing' || ammoRemaining <= 0) return;
    ammoRemaining -= 1;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
```

(이 아래 레이캐스트/명중 판정/점수 계산 로직은 전혀 건드리지 않는다 — 함수 맨 앞의 가드 조건과 그 다음 줄의 차감 한 줄만 추가한다.)

- [ ] **Step 5: 틱 루프에 총알 소진 게임오버 분기 추가**

`start()` 함수 내부 틱 콜백의 라운드 클리어 분기를 다음과 같이 수정한다.

변경 전:
```js
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          }
```

변경 후:
```js
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          } else if (ammoRemaining <= 0) {
            endGame();
          }
```

(`allCleared()` 분기가 먼저 오고 `ammoRemaining <= 0` 분기는 `else if`로 그 다음에만 검사된다 — 순서를 바꾸지 않는다. 마지막 총알로 마지막 원숭이를 맞혀도 사망 애니메이션이 끝나 `allCleared()`가 `true`가 될 때까지는 이 `else if`가 평가되지 않으므로, 라운드 클리어가 총알 소진 게임오버보다 항상 우선한다.)

- [ ] **Step 6: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 7: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 25개 테스트 전부 통과(이 작업은 `game.js`만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 8: 브라우저에서 수동 확인**

Run: `npm run dev`, 게임 시작 → HUD에 "총알: N/N" 표시되는지 확인 → 쏠 때마다 숫자가 줄어드는지 확인 → 총알이 0일 때 클릭해도 발사(반동/사운드/레이캐스트)가 전혀 안 일어나는지 확인 → 원숭이가 남은 상태에서 총알을 다 쓰면 게임오버 화면으로 넘어가는지 확인 → (가능하면) 마지막 총알로 마지막 원숭이를 잡는 경우 게임오버가 아니라 다음 라운드로 정상 진행되는지 확인.

- [ ] **Step 9: Commit**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: wire ammo count and out-of-ammo game over into game.js"
```

---

## Self-Review Notes

- **스펙 커버리지**: 총알 수 공식(2.1) → Task 1. 재장전 없음/라운드마다 리셋(2.2) → Task 3 Step 1-2, 4. 소진 게임오버 타이밍(2.3) → Task 3 Step 5. HUD 표시(2.4) → Task 2 + Task 3 Step 3. 비목표(재장전 없음, 구조물 추락사 별도 스펙, 총알 구매/누적 없음, 특별 연출 없음) → 계획에 해당 기능이 아예 등장하지 않으므로 자동 충족.
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `getRoundParams` 반환 객체의 `ammo` 필드(Task 1) → `beginRound`가 `roundParams.ammo`로 소비(Task 3 Step 2) → `updateHud`가 `hud.render`에 `ammo`/`ammoMax`로 전달(Task 3 Step 3) → `hud.js`의 `render` 시그니처가 그 두 필드를 받음(Task 2) — 전부 일치.
- **기존 로직 보존 확인**: `handleShot`의 레이캐스트/장애물 차단/점수 계산 로직(Task 3 Step 4 이후)과 틱 루프의 `allCleared()` 분기 내부 로직(Task 3 Step 5)은 이번 계획에서 손대지 않는다 — 각 Step의 diff가 가드/차감 한 줄, `else if` 한 블록으로 최소화되어 있다.
