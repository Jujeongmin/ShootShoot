# 원숭이 좌우 순찰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원숭이가 좌우로 걸어다니면서 진행 방향으로 몸을 틀고, 순찰 끝에서만 플레이어를 보며 도발하게 만든다.

**Architecture:** 순찰 계산을 새 순수 모듈 `patrolMotion.js` 로 뽑는다. 이 모듈은 시간과 프레임 간격을 받아 `{ offsetX, facing, gaitDelta, taunt }` 를 낸다. `monkey.js` 는 그 결과를 `group.position.x` / `group.rotation.y` 에 바르고, 애니메이션 믹서가 돈 **뒤에** 다리 본 회전을 더한다. 궤적 공식 자체는 지금 것과 동일해서 난이도가 안 바뀐다.

**Tech Stack:** three.js 0.166, vitest, 순수 ES 모듈

**설계 문서:** [2026-07-31-monkey-patrol-design.md](../specs/2026-07-31-monkey-patrol-design.md)

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 쓰지 말 것.
- **브라우저를 쓰지 말 것.** 이 환경에서 브라우저 창이 안 열린다. 육안 확인은 사용자가 한다.
- `python` 이 없다. 파일 수정은 Edit 툴이나 `node -e` 로 한다.
- 셸 문법을 섞지 말 것. 커밋은 `git commit -m "제목" -m "본문"` 형태로 한다.
- 검증 명령은 `npm test` 와 `npm run build` 두 개다.
- `laneLayout.js` 의 진폭·주기·슬롯 배치를 **바꾸지 말 것.** 난이도 균형이 거기 맞춰져 있다.
- `classifyHit`, `updateHit`, `updateFlash`, `difficulty.js` 를 **건드리지 말 것.**

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/patrolMotion.js` (새 파일) | 순찰 곡선 하나만 안다. 시간 → 위치 오프셋·바라볼 각·걸음 진행량·도발 세기. THREE 의존 없음 |
| `test/patrolMotion.test.js` (새 파일) | 위 모듈의 순수 검증 |
| `game/src/gameplay/monkey.js` (수정) | 순찰 결과를 THREE 객체에 바른다. 다리 본 회전을 얹는다 |
| `test/laneLayout.test.js` (주석만 수정) | x 공식의 출처가 `monkey.js` 에서 `patrolMotion.js` 로 옮겨간다 |

---

### Task 1: 순찰 곡선 순수 모듈

**Files:**
- Create: `game/src/gameplay/patrolMotion.js`
- Test: `test/patrolMotion.test.js`

**Interfaces:**
- Consumes: 없음. 순수 모듈이다.
- Produces: `createPatrol({ amplitude, frequency, phase })` 가 `{ sample(elapsed, dt) }` 를 돌려준다.
  `sample` 은 `{ offsetX: number, facing: number, gaitDelta: number, taunt: number }` 를 낸다.
  - `offsetX` — 슬롯 기준 x 오프셋
  - `facing` — `group.rotation.y` 에 넣을 라디안. 오른쪽(+X)으로 갈 때 `+Math.PI/2`
  - `gaitDelta` — 이번 프레임에 나아간 거리 (항상 0 이상)
  - `taunt` — 0~1. 순찰 끝(정면)일 때 1

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/patrolMotion.test.js` 를 새로 만든다. `frequency: 1, phase: 0` 을 쓰면
`elapsed` 가 그대로 각도라서 값이 딱 떨어진다.

```js
import { describe, it, expect } from 'vitest';
import { createPatrol } from '../game/src/gameplay/patrolMotion.js';

const AMPLITUDE = 3;
// frequency 1, phase 0 이면 elapsed 가 곧 각도다. 아래 시각들의 의미:
//   0        cos = 1   최고속, 오른쪽으로 간다
//   PI/2     cos = 0   순찰 오른쪽 끝, 멈춘다
//   PI       cos = -1  최고속, 왼쪽으로 간다
const patrol = () => createPatrol({ amplitude: AMPLITUDE, frequency: 1, phase: 0 });

describe('createPatrol', () => {
  it('keeps the existing sway curve exactly', () => {
    const p = patrol();
    for (const t of [0, 0.7, 1.4, 2.9, 5.1]) {
      expect(p.sample(t, 0.016).offsetX).toBeCloseTo(Math.sin(t) * AMPLITUDE, 10);
    }
  });

  it('faces fully sideways at top speed, and the sign follows the direction', () => {
    const p = patrol();
    expect(p.sample(0, 0.016).facing).toBeCloseTo(Math.PI / 2, 10);
    expect(p.sample(Math.PI, 0.016).facing).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('faces the player at both ends of the patrol', () => {
    const p = patrol();
    expect(p.sample(Math.PI / 2, 0.016).facing).toBeCloseTo(0, 10);
    expect(p.sample(Math.PI * 1.5, 0.016).facing).toBeCloseTo(0, 10);
  });

  it('blends the turn instead of snapping it', () => {
    const p = patrol();
    // 끝(PI/2)에 가까워질수록 |facing| 이 단조 감소해야 한다.
    const samples = [1.2, 1.35, 1.45, 1.55].map((t) => Math.abs(p.sample(t, 0.016).facing));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it('taunts only near the ends', () => {
    const p = patrol();
    expect(p.sample(Math.PI / 2, 0.016).taunt).toBeCloseTo(1, 10);
    expect(p.sample(0, 0.016).taunt).toBe(0);
    expect(p.sample(Math.PI, 0.016).taunt).toBe(0);
  });

  it('advances the gait by distance travelled, not by time', () => {
    const p = patrol();
    const dt = 0.016;
    const moving = p.sample(0, dt).gaitDelta;
    const stopped = p.sample(Math.PI / 2, dt).gaitDelta;
    expect(moving).toBeCloseTo(AMPLITUDE * 1 * dt, 10);
    expect(stopped).toBeCloseTo(0, 10);
    // 같은 시각에 dt 가 두 배면 나아간 거리도 두 배다.
    expect(p.sample(0, dt * 2).gaitDelta).toBeCloseTo(moving * 2, 10);
  });

  it('holds a zero-amplitude monkey still but still lets it taunt', () => {
    const still = createPatrol({ amplitude: 0, frequency: 1, phase: 0 });
    for (const t of [0, 0.5, Math.PI / 2, Math.PI, 4.2]) {
      const s = still.sample(t, 0.016);
      expect(s.offsetX).toBe(0);
      expect(s.facing).toBe(0);
      expect(s.gaitDelta).toBe(0);
    }
    expect(still.sample(Math.PI / 2, 0.016).taunt).toBeCloseTo(1, 10);
    expect(still.sample(0, 0.016).taunt).toBe(0);
  });

  it('respects the phase offset', () => {
    const shifted = createPatrol({ amplitude: AMPLITUDE, frequency: 1, phase: Math.PI / 2 });
    expect(shifted.sample(0, 0.016).offsetX).toBeCloseTo(AMPLITUDE, 10);
    expect(shifted.sample(0, 0.016).facing).toBeCloseTo(0, 10);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npx vitest run test/patrolMotion.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/gameplay/patrolMotion.js"`

- [ ] **Step 3: 모듈을 구현한다**

`game/src/gameplay/patrolMotion.js` 를 새로 만든다.

```js
// 원숭이의 좌우 순찰 곡선. THREE에 의존하지 않는 순수 모듈이라
// 궤적·방향 전환·걸음 진행을 테스트로 못 박을 수 있다.
//
// 곡선 자체는 예전에 monkey.js의 updateIdle이 인라인으로 갖고 있던 것과 같다.
// laneLayout.js가 주는 진폭·주기를 그대로 쓰므로 난이도는 안 바뀐다.

// 이 비율 아래로 느려지면 옆모습에서 정면으로 섞기 시작한다. sin 운동이라
// 양 끝에서 속도가 0이 되고, 그 순간이 플레이어를 보는 순간이 된다.
const FACE_THRESHOLD = 0.25;

// 모델은 rotation.y = 0에서 +Z(플레이어)를 본다. +Z를 Y축으로 θ 돌리면
// (sinθ, 0, cosθ)이므로 +X를 향하려면 θ = +π/2다.
const RIGHT_FACING = Math.PI / 2;

export function createPatrol({ amplitude, frequency, phase }) {
  return {
    sample(elapsed, dt) {
      const angle = elapsed * frequency + phase;
      const cosine = Math.cos(angle);
      const speedNorm = Math.abs(cosine);
      const taunt = Math.max(0, 1 - speedNorm / FACE_THRESHOLD);

      // 타워 위 원숭이는 진폭이 0이다. 안 움직이니 몸을 틀 방향도 걸음도 없다.
      if (amplitude === 0) {
        return { offsetX: 0, facing: 0, gaitDelta: 0, taunt };
      }

      const blend = Math.min(speedNorm / FACE_THRESHOLD, 1);
      const direction = cosine >= 0 ? 1 : -1;

      return {
        offsetX: Math.sin(angle) * amplitude,
        facing: direction * RIGHT_FACING * blend,
        gaitDelta: speedNorm * amplitude * frequency * dt,
        taunt,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `npx vitest run test/patrolMotion.test.js`
Expected: PASS — 8 tests

- [ ] **Step 5: 전체 테스트가 안 깨졌는지 본다**

Run: `npm test`
Expected: PASS — 기존 203개 + 새 8개 = 211개

- [ ] **Step 6: 커밋한다**

```bash
git add game/src/gameplay/patrolMotion.js test/patrolMotion.test.js
git commit -m "feat: add a pure patrol curve for the monkeys" -m "The curve itself is what monkey.js already computed inline. Pulling it out gives the turn-at-the-ends and the walk cycle somewhere testable to live."
```

---

### Task 2: monkey.js가 순찰 결과를 쓰게 한다

**Files:**
- Modify: `game/src/gameplay/monkey.js`
- Modify: `test/laneLayout.test.js:4` (주석 한 줄)

**Interfaces:**
- Consumes: Task 1의 `createPatrol({ amplitude, frequency, phase })` 와 `sample(elapsed, dt) -> { offsetX, facing, gaitDelta, taunt }`
- Produces: `createMonkey` 의 바깥 인터페이스는 **안 바뀐다.** 내부에 `state.gaitPhase` 가 생겨 Task 3이 쓴다.

`monkey.js` 는 THREE와 `document.createElement('canvas')` 에 의존해서 단위 테스트가 안 된다.
이 태스크의 검증은 `npm test`(회귀 없음) + `npm run build` + 사용자 육안 확인이다.

- [ ] **Step 1: import와 상수를 정리한다**

파일 맨 위 import에 한 줄을 더한다.

```js
import { createPatrol } from './patrolMotion.js';
```

상수 블록에서 **아래 두 줄을 지운다.**

```js
const TAUNT_INTERVAL_MIN = 2;
const TAUNT_INTERVAL_MAX = 4.5;
```

같은 자리에 **아래 두 줄을 넣는다.**

```js
// 순찰 끝에서 플레이어를 볼 때 몸을 흔드는 정도와 빠르기. 예전 도발 연출의 값 그대로다.
const TAUNT_SWING = 0.6;
const TAUNT_FREQUENCY = 10;
// 1유닛 나아갈 때 걸음 위상이 도는 양(라디안). 최고속이 진폭 3 × 주기 0.9 ≈ 2.7유닛/초라서
// 2.4면 초당 약 한 걸음 주기가 된다. 화면을 보고 맞출 값이다.
const STRIDE_PER_UNIT = 2.4;
```

- [ ] **Step 2: 순찰 객체를 만들고 상태를 정리한다**

`swayPhase` 를 정하는 세 줄 바로 아래에 순찰 객체를 만든다.

```js
const patrol = createPatrol({
  amplitude: swayAmplitude,
  frequency: swayFrequency,
  phase: swayPhase,
});
```

`state` 객체에서 **아래 세 줄을 지운다.**

```js
    nextTauntAt: TAUNT_INTERVAL_MIN + Math.random() * (TAUNT_INTERVAL_MAX - TAUNT_INTERVAL_MIN),
    tauntElapsed: 0,
    isTaunting: false,
```

같은 자리에 **아래 한 줄을 넣는다.**

```js
    gaitPhase: Math.random() * Math.PI * 2,
```

(걸음 위상을 랜덤으로 시작해야 여러 마리가 같은 발을 동시에 내딛지 않는다.)

- [ ] **Step 3: updateIdle을 갈아끼운다**

`updateIdle` 전체를 아래로 바꾼다.

```js
  function updateIdle(dt) {
    state.elapsed += dt;

    // 위로만 흔들리게 한다. 대칭으로 흔들면 절반의 시간 동안 발이 지면을 파고들어
    // 땅에 서 있는 게 아니라 떠 있는 것처럼 보인다.
    const bobPhase = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.5 + 0.5;
    group.position.y = position.y + bobPhase * BOB_HEIGHT;

    const motion = patrol.sample(state.elapsed, dt);
    group.position.x = position.x + motion.offsetX;

    // 도발은 순찰 끝에서 플레이어를 보는 순간에만 나온다. taunt가 그때 1이라
    // 별도의 타이머 없이 진행 방향 위에 얹기만 하면 된다.
    const wobble = Math.sin(state.elapsed * TAUNT_FREQUENCY) * TAUNT_SWING * motion.taunt;
    group.rotation.y = motion.facing + wobble;

    // 시간이 아니라 나아간 거리로 걸음을 돌린다. 이래야 발이 안 미끄러진다.
    state.gaitPhase += motion.gaitDelta * STRIDE_PER_UNIT;
  }
```

`state.gaitPhase` 는 이 태스크에서 쌓이기만 하고 아직 아무도 안 읽는다.
다리를 흔드는 것은 Task 3이다. 이 태스크만 끝낸 상태로도 게임은 정상으로 돈다 —
원숭이가 몸을 틀고 순찰 끝에서 도발하되 다리만 아직 idle이다.

- [ ] **Step 4: laneLayout 테스트의 주석을 고친다**

x 공식이 `monkey.js` 를 떠났으니 출처를 가리키는 주석도 옮긴다.
`test/laneLayout.test.js:4` 를 아래로 바꾼다.

```js
// 원숭이의 실제 x 좌표 재현: patrolMotion.js의 offsetX와 동일한 공식
```

- [ ] **Step 5: 지워진 상태가 어디에도 안 남았는지 확인한다**

Grep 툴로 `game/` 과 `test/` 에서 `isTaunting|tauntElapsed|nextTauntAt|TAUNT_INTERVAL` 을 찾는다.
Expected: 결과 없음

- [ ] **Step 6: 테스트를 돌리고 커밋한다**

Run: `npm test`
Expected: PASS — 211개

```bash
git add game/src/gameplay/monkey.js test/laneLayout.test.js
git commit -m "feat: turn the monkeys to face the way they are patrolling" -m "Monkeys now face their direction of travel, and only look at the player at the ends of the patrol, where the sway velocity reaches zero. That moment is also the only time they taunt, so the random taunt timer is gone."
```

---

### Task 3: 다리 본을 걸음에 맞춰 흔든다

**Files:**
- Modify: `game/src/gameplay/monkey.js`

**Interfaces:**
- Consumes: Task 2의 `state.gaitPhase`
- Produces: 없음. `createMonkey` 의 바깥 인터페이스는 그대로다.

본 이름은 실제 FBX에서 확인한 것이다:
`b_Left_Leg01`, `b_Right_Leg01` (전체 34개 중). 모델이 바뀌어 이름이 없어지면
다리 갱신을 조용히 건너뛴다 — 터지게 두지 않는다.

- [ ] **Step 1: 상수를 더한다**

`STRIDE_PER_UNIT` 아래에 한 줄을 넣는다.

```js
// 다리 스윙 폭(라디안). 화면을 보고 맞출 값이다. 조준(FOV 9)해야 눈에 들어온다.
const LEG_SWING = 0.35;
```

- [ ] **Step 2: 다리 본을 한 번 찾아 둔다**

`model.traverse` 로 메시를 모으는 블록 **바로 아래**에 넣는다.

```js
  // 이 FBX에는 애니메이션 클립이 idle 하나뿐이라 걸음은 절차적으로 만든다.
  // 이름이 없으면 다리 갱신을 건너뛴다.
  const leftLeg = model.getObjectByName('b_Left_Leg01');
  const rightLeg = model.getObjectByName('b_Right_Leg01');
  const legs = leftLeg && rightLeg ? { left: leftLeg, right: rightLeg } : null;
```

- [ ] **Step 3: 걸음을 바르는 함수를 더한다**

`updateIdle` 바로 아래에 넣는다.

```js
  // 믹서가 클립 포즈를 쓴 뒤에 불러야 한다. 앞에서 부르면 클립이 덮어써서 사라진다.
  // '=' 가 아니라 '+=' 라서 idle 클립의 숨쉬기가 살아있고 그 위에 걸음만 얹힌다.
  function applyGait() {
    if (!legs) return;
    const swing = Math.sin(state.gaitPhase) * LEG_SWING;
    legs.left.rotation.x += swing;
    legs.right.rotation.x -= swing;
  }
```

- [ ] **Step 4: update에서 부른다**

`update(dt)` 안의 `else` 가지를 아래로 바꾼다.

```js
      } else {
        updateIdle(dt);
        applyGait();
        if (state.isFlashing) {
          updateFlash(dt);
        }
      }
```

(죽는 중(`phase === 'hit'`)에는 안 부른다. 죽는 연출이 몸 전체를 회전시키는데
다리까지 흔들면 산만하다.)

- [ ] **Step 5: 테스트와 빌드를 돌린다**

Run: `npm test`
Expected: PASS — 211개. `monkey.js` 는 단위 테스트 대상이 아니라 회귀만 본다.

Run: `npm run build`
Expected: 성공. `patrolMotion.js` 가 번들에 들어간다.

- [ ] **Step 6: 커밋한다**

```bash
git add game/src/gameplay/monkey.js
git commit -m "feat: swing the monkeys' legs as they walk" -m "The FBX carries one idle clip and no walk, so the legs swing procedurally on top of it. The swing advances with distance travelled rather than with time, which keeps the feet from sliding."
```

---

### Task 4: 사용자 육안 확인 요청

**Files:** 없음

- [ ] **Step 1: 개발 서버가 도는지 확인한다**

이미 떠 있으면 다시 띄우지 말 것. 주소는 `http://127.0.0.1:5174/` 다.
(`preview_start` 가 돌려주는 5~6만번대 포트는 브라우저 패널 내부 프록시 포트라
일반 브라우저로는 안 열린다. 사용자에게는 반드시 5174를 알려준다.)

- [ ] **Step 2: 사용자에게 확인할 항목을 알려준다**

브라우저를 직접 열지 말 것. 아래 네 가지를 물어본다.

1. 원숭이가 **가는 방향으로** 몸을 트나, 아니면 뒤로 걷는 것처럼 보이나
   (뒤로 걸으면 `patrolMotion.js` 의 `RIGHT_FACING` 부호만 뒤집는다)
2. 순찰 끝에서 정면으로 돌아 도발하는 게 자연스러운가
3. 조준(우클릭)했을 때 다리 스윙 폭이 맞나 — `LEG_SWING`
4. 발이 미끄러져 보이나 — `STRIDE_PER_UNIT`

- [ ] **Step 3: 답을 받아 상수를 고친다**

고칠 것이 있으면 상수 한 줄씩만 바꾸고, 바꾼 값으로 `npm test` 를 다시 돌린 뒤 커밋한다.
없으면 이 계획은 끝이다.

---

## 이 계획이 손대지 않는 것

- `laneLayout.js` 의 진폭·주기·슬롯 배치
- `classifyHit` / 헤드샷 판정 (로컬 Y만 봐서 회전과 무관하다)
- `difficulty.js` 의 난이도 값
- 죽는 연출 `updateHit`, 피격 플래시 `updateFlash`
- 플레이어 쪽으로 접근하는 움직임, 지는 조건, 난이도 상한 — 전부 별개 작업이다
