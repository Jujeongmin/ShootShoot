# 원숭이 레일 스폰 + 주기적 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라운드의 원숭이 전체를 카메라 시선 기준 레일(2~3마리씩)로 배치하고, 같은 레일의 원숭이들이 주기적으로 정확히 같은 광선 위에 겹치도록(관통샷 성립) 움직임을 계산한다.

**Architecture:** 새 순수 모듈 `laneLayout.js`가 원숭이 수/속도/스케일로부터 각 원숭이의 기준 위치와 sway 파라미터(진폭·주파수·위상)를 계산한다 — 위치를 각도 공간(`x = 각도 × |z|`)에서 정의하므로, 같은 레일(같은 진폭·주파수)의 원숭이들은 sin 값이 같아지는 순간 `x/|z|` 비율이 정확히 일치해 카메라(0, 1.6, 0)에서 뻗는 같은 광선 위에 놓인다. `monkey.js`는 `sway` 옵션(진폭·주파수·위상)을 받도록 확장되고, `targetManager.js`의 `spawnRound`가 기존 랜덤 스폰 대신 이 레이아웃을 사용한다. 모든 원숭이는 같은 프레임에 스폰되고 매 틱 같은 `dt`로 업데이트되므로 각자의 `elapsed`가 라운드 내내 동기 상태를 유지한다 — 정렬 수학의 시간 기준이 보장된다.

**Tech Stack:** Vanilla JS ES 모듈, Vitest(순수 함수 테스트).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- `monkey.js`의 `sway` 옵션은 미지정 시 기존 동작(진폭 0.5, 주파수 `speed`, 랜덤 위상)과 동일해야 한다 — bob(상하 흔들림)과 taunt(까불기) 로직은 불변.
- 레일 분할 규칙: `n % 3 == 0` → 전부 3마리 레일, `n % 3 == 2` → 3마리 레일들 + 2마리 레일 1개, `n % 3 == 1` → 3마리 레일들 + 2마리 레일 2개. (`n == 1`은 방어적으로 1마리 레일 하나.)
- 레일 내 위상: k마리 레일에서 `φ_i = i × 2π/k`.
- 깊이 간격은 `BASE_DEPTH_GAP × monkeyScale` — 원숭이가 작아지는 후반 라운드에서 관통 광선(카메라가 위에서 내려보는 기울어진 광선)이 뒤 원숭이 아래로 빠지지 않게 하기 위함.
- 정렬 순간 인디케이터, 충돌 회피, 라운드 중 레일 재구성은 만들지 않음.

---

### Task 1: `laneLayout.js` — 레일 레이아웃 계산 (순수, 테스트)

**Files:**
- Create: `game/src/gameplay/laneLayout.js`
- Test: `test/laneLayout.test.js`

**Interfaces:**
- Produces: `computeLaneLayout(monkeyCount, monkeySpeed, monkeyScale) -> Array<{ x, y, z, swayAmplitude, swayFrequency, swayPhase }>` — Task 2가 이 시그니처로 소비한다. 반환 배열 길이는 `monkeyCount`와 같다.

- [ ] **Step 1: `test/laneLayout.test.js`에 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { computeLaneLayout } from '../game/src/gameplay/laneLayout.js';

// 원숭이의 실제 x 좌표 재현: monkey.js의 updateIdle과 동일한 공식
function xAt(slot, t) {
  return slot.x + Math.sin(slot.swayFrequency * t + slot.swayPhase) * slot.swayAmplitude;
}

// 카메라(x=0) 기준 시선 각도 비율
function rayRatio(slot, t) {
  return xAt(slot, t) / Math.abs(slot.z);
}

describe('computeLaneLayout', () => {
  it('returns exactly monkeyCount slots for the whole supported range', () => {
    for (let n = 1; n <= 10; n++) {
      expect(computeLaneLayout(n, 0.5, 1.0)).toHaveLength(n);
    }
  });

  it('partitions monkeys into lanes of 2-3 (unique base angles = lane count)', () => {
    function laneCount(n) {
      const slots = computeLaneLayout(n, 0.5, 1.0);
      const angles = new Set(slots.map((s) => (s.x / Math.abs(s.z)).toFixed(6)));
      return angles.size;
    }
    expect(laneCount(3)).toBe(1);
    expect(laneCount(4)).toBe(2);
    expect(laneCount(5)).toBe(2);
    expect(laneCount(7)).toBe(3);
    expect(laneCount(10)).toBe(4);
  });

  it('monkeys in the same 2-lane align exactly (equal ray ratio) at spawn and every half period', () => {
    const slots = computeLaneLayout(2, 0.5, 1.0);
    const [a, b] = slots;
    const halfPeriod = Math.PI / a.swayFrequency;
    expect(rayRatio(a, 0)).toBeCloseTo(rayRatio(b, 0), 10);
    expect(rayRatio(a, halfPeriod)).toBeCloseTo(rayRatio(b, halfPeriod), 10);
    const quarter = halfPeriod / 2;
    expect(Math.abs(rayRatio(a, quarter) - rayRatio(b, quarter))).toBeGreaterThan(0.01);
  });

  it('every pair in a 3-lane has its own periodic alignment moment', () => {
    const slots = computeLaneLayout(3, 0.5, 1.0);
    const [a, b, c] = slots;
    const w = a.swayFrequency;
    // 쌍 (φ1, φ2)의 정렬 시각: w*t = (π - φ1 - φ2)/2 + kπ
    function alignTime(p, q) {
      return (Math.PI - p.swayPhase - q.swayPhase) / 2 / w;
    }
    expect(rayRatio(a, alignTime(a, b))).toBeCloseTo(rayRatio(b, alignTime(a, b)), 10);
    expect(rayRatio(b, alignTime(b, c))).toBeCloseTo(rayRatio(c, alignTime(b, c)), 10);
    expect(rayRatio(a, alignTime(a, c))).toBeCloseTo(rayRatio(c, alignTime(a, c)), 10);
  });

  it('sway amplitude is proportional to |z| (equal angular amplitude)', () => {
    const slots = computeLaneLayout(10, 0.5, 1.0);
    const ratios = slots.map((s) => s.swayAmplitude / Math.abs(s.z));
    for (const r of ratios) {
      expect(r).toBeCloseTo(ratios[0], 10);
    }
  });

  it('scales depth gap with monkeyScale', () => {
    const big = computeLaneLayout(3, 0.5, 1.0);
    const small = computeLaneLayout(3, 0.5, 0.5);
    const gapBig = Math.abs(big[1].z - big[0].z);
    const gapSmall = Math.abs(small[1].z - small[0].z);
    expect(gapSmall).toBeCloseTo(gapBig * 0.5, 10);
  });

  it('sway frequency scales with monkeySpeed', () => {
    const slow = computeLaneLayout(3, 0.5, 1.0);
    const fast = computeLaneLayout(3, 1.0, 1.0);
    expect(fast[0].swayFrequency).toBeCloseTo(slow[0].swayFrequency * 2, 10);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test` (저장소 루트 `C:\Users\anjsh\OneDrive\Desktop\ShootShoot`에서 실행)
Expected: FAIL — `laneLayout.js` 파일이 없어서 새로 추가한 7개 테스트만 import 에러로 실패, 나머지 37개 테스트는 그대로 통과.

- [ ] **Step 3: `laneLayout.js` 구현**

```js
const FRONT_Z = -13;
const BASE_DEPTH_GAP = 2.5;
const MAX_LANE_ANGLE = 0.25;
const ANGULAR_SWAY_AMPLITUDE = 0.038;
const SWAY_FREQUENCY_PER_SPEED = 1.8;
const GROUND_Y = -1.0;

function partitionIntoLanes(count) {
  if (count === 1) return [1];
  const remainder = count % 3;
  let threes = Math.floor(count / 3);
  let twos = 0;
  if (remainder === 1) {
    threes -= 1;
    twos = 2;
  } else if (remainder === 2) {
    twos = 1;
  }
  const sizes = [];
  for (let i = 0; i < threes; i++) sizes.push(3);
  for (let i = 0; i < twos; i++) sizes.push(2);
  return sizes;
}

export function computeLaneLayout(monkeyCount, monkeySpeed, monkeyScale) {
  const laneSizes = partitionIntoLanes(monkeyCount);
  const laneCount = laneSizes.length;
  const frequency = SWAY_FREQUENCY_PER_SPEED * monkeySpeed;
  const depthGap = BASE_DEPTH_GAP * monkeyScale;
  const slots = [];

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const laneAngle =
      laneCount === 1 ? 0 : -MAX_LANE_ANGLE + (2 * MAX_LANE_ANGLE * laneIndex) / (laneCount - 1);
    const size = laneSizes[laneIndex];
    for (let j = 0; j < size; j++) {
      const z = FRONT_Z - j * depthGap;
      slots.push({
        x: laneAngle * Math.abs(z),
        y: GROUND_Y,
        z,
        swayAmplitude: ANGULAR_SWAY_AMPLITUDE * Math.abs(z),
        swayFrequency: frequency,
        swayPhase: (j * 2 * Math.PI) / size,
      });
    }
  }

  return slots;
}
```

- [ ] **Step 4: 테스트 실행해서 전체 통과 확인**

Run: `npm test`
Expected: PASS — 전체 44개 테스트 통과(기존 37개 + 새로 추가한 7개).

- [ ] **Step 5: Commit**

```bash
git add game/src/gameplay/laneLayout.js test/laneLayout.test.js
git commit -m "feat: add lane layout with guaranteed periodic alignment"
```

---

### Task 2: `monkey.js` sway 옵션 + `targetManager.js` 레이아웃 연결

**Files:**
- Modify: `game/src/gameplay/monkey.js`
- Modify: `game/src/gameplay/targetManager.js`

**Interfaces:**
- Consumes: `computeLaneLayout(monkeyCount, monkeySpeed, monkeyScale) -> Array<{x, y, z, swayAmplitude, swayFrequency, swayPhase}>`(Task 1).
- Produces: `createMonkey({ id, position, scale, speed, template, clip, sway })` — `sway = { amplitude, frequency, phase }` 선택적 옵션.

- [ ] **Step 1: `monkey.js`에 `sway` 옵션 추가**

`game/src/gameplay/monkey.js`의 시그니처를 수정한다.

변경 전:
```js
export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip }) {
```

변경 후:
```js
export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip, sway = {} }) {
```

그리고 기존 `const state = {` 선언 바로 앞에 추가:

```js
  const swayAmplitude = sway.amplitude !== undefined ? sway.amplitude : 0.5;
  const swayFrequency = sway.frequency !== undefined ? sway.frequency : speed;
  const swayPhase = sway.phase !== undefined ? sway.phase : Math.random() * Math.PI * 2;
```

그리고 `updateIdle` 내부의 sway 계산을 수정한다.

변경 전:
```js
    const sway = Math.sin(state.elapsed * speed + state.phaseOffset) * 0.5;
    group.position.x = position.x + sway;
```

변경 후:
```js
    const swayOffset = Math.sin(state.elapsed * swayFrequency + swayPhase) * swayAmplitude;
    group.position.x = position.x + swayOffset;
```

(bob 계산(`state.phaseOffset` 사용)과 taunt 로직, `updateHit`, 반환 객체의 모든 메서드는 전혀 건드리지 않는다. 로컬 변수명을 `sway`에서 `swayOffset`으로 바꾸는 이유는 새 `sway` 파라미터와의 섀도잉을 피하기 위함이다.)

- [ ] **Step 2: `targetManager.js`가 레이아웃을 사용하도록 수정**

`game/src/gameplay/targetManager.js`의 import와 `computeSpawnPosition`/`spawnRound`를 수정한다.

변경 전:
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
```

변경 후:
```js
import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';
import { computeLaneLayout } from './laneLayout.js';
```

(`computeSpawnPosition` 함수는 통째로 삭제한다.)

그리고 `spawnRound`를 수정한다.

변경 전:
```js
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
```

변경 후:
```js
  function spawnRound(roundNumber) {
    clear();
    const params = getRoundParams(roundNumber, config);
    const layout = computeLaneLayout(params.monkeyCount, params.monkeySpeed, params.monkeyScale);
    for (let i = 0; i < params.monkeyCount; i++) {
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
```

(`update`, `getRaycastMeshes`, `findMonkey`, `allCleared`, `clear`, `hasDyingMonkeys`, `hasAliveMonkeys`와 `return` 문은 전혀 건드리지 않는다.)

- [ ] **Step 3: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 4: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 44개 테스트 전부 통과(이 작업은 씬 그래프 모듈만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 5: 브라우저에서 수동 확인**

Run: `npm run dev`, 게임 시작 → 원숭이들이 레일별로 앞뒤로 배치되어 좌우로 흔들리는지 확인 → 몇 초 기다리면 같은 레일의 원숭이들이 앞뒤로 정확히 겹치는 순간이 오는지 확인 → 그 순간 앞 원숭이의 머리/상체를 쏘면 관통(한 발로 2마리, 콤보 사운드/점수)이 실제로 판정되는지 확인 → 관통이 수직으로 어긋나면(뒤 원숭이가 안 맞으면) `laneLayout.js`의 `FRONT_Z`/`BASE_DEPTH_GAP`을 조정해서 재확인 → 라운드가 진행되어 원숭이가 작아져도(스케일 감소) 관통이 여전히 성립하는지 확인.

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/monkey.js game/src/gameplay/targetManager.js
git commit -m "feat: spawn monkeys on alignment lanes for engineered penetration shots"
```

---

## Self-Review Notes

- **스펙 커버리지**: 겹침의 수학적 정의(2.1) → Task 1의 각도 공간 공식 + 정렬 테스트. 레일 구성(분할/각도/깊이/위상/주파수, 2.2) → Task 1의 `partitionIntoLanes`와 상수들. 모듈 구조(2.3) → Task 1(`laneLayout.js`) + Task 2(`monkey.js` sway 옵션, `targetManager.js` 연결). 비목표(인디케이터/충돌회피/재구성/3마리 동시정렬 없음) → 계획에 해당 기능이 아예 등장하지 않으므로 자동 충족.
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함(초안에 있던 미사용 변수 한 줄은 이 자가 리뷰에서 발견해 코드에서 직접 제거함).
- **타입/시그니처 일관성**: `computeLaneLayout(monkeyCount, monkeySpeed, monkeyScale)`(Task 1) → `targetManager.js`가 `params.monkeyCount/monkeySpeed/monkeyScale`로 호출(Task 2 Step 2) — 인자 순서 일치. 슬롯 필드명(`x/y/z/swayAmplitude/swayFrequency/swayPhase`) → Task 2의 소비처와 일치. `xAt` 테스트 헬퍼의 공식은 `monkey.js`의 `updateIdle` 실제 공식(`position.x + sin(elapsed × frequency + phase) × amplitude`)과 동일 — 테스트가 검증하는 것이 실제 렌더링 위치와 같음을 보장.
- **동기화 전제 확인**: 정렬 수학은 레일 내 원숭이들이 같은 시간 기준(`elapsed`)을 공유한다는 전제에 의존 — `spawnRound`가 한 루프에서 전부 생성하고 `targetManager.update(dt)`가 매 틱 전원에게 같은 `dt`를 전달하므로 성립(슬로우모션의 `scaledDt`도 전원에게 동일하게 적용되므로 정렬은 슬로우모션 중에도 유지됨).
- **기존 로직 보존 확인**: `monkey.js`의 bob/taunt/`updateHit`/반환 메서드, `targetManager.js`의 `update`/`getRaycastMeshes`/`findMonkey`/`allCleared`/`clear`/`hasDyingMonkeys`/`hasAliveMonkeys`는 전혀 건드리지 않는다. `game.js`는 이번 계획에서 아예 수정 대상이 아니다.
