# 라운드 진행 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 골드가 라운드에 비례해 늘고, 라운드마다 대형·움직임·개체 구성이 달라지게 한다.

**Architecture:** 네 축(대형, 움직임, 개체 차이, 구조물 편중)이 전부 "라운드 번호를 받아 무엇을 쓸지 고르는" 문제다. 결정을 순수 모듈 `roundComposition.ts` 한 곳에 모으고 `laneLayout`·`patrolMotion`·`targetManager` 는 그 결과를 소비만 한다. 씨앗이 라운드 번호라 같은 라운드는 언제나 같은 판이다.

**Tech Stack:** TypeScript 5 (strict), vitest 1, three 0.166

**설계 문서:** [2026-08-02-round-progression-design.md](../specs/2026-08-02-round-progression-design.md)

## Global Constraints

- 작업 브랜치는 `dev` 직접 커밋. worktree 쓰지 말 것.
- **태스크마다 커밋한다. 푸시는 컨트롤러가 한다 — 서브에이전트는 푸시하지 말 것.**
- **브라우저를 쓰지 말 것.** 서브에이전트에게는 창이 안 열린다. 육안 확인은 사용자가 한다.
- `python` 이 없다. 파일 수정은 Edit 툴이나 `node -e` 로 한다.
- 셸 문법을 섞지 말 것. 커밋은 `git commit -m "제목" -m "본문"` 형태로.
- **모듈 최상단에서 `window`·`document`·`localStorage` 를 읽지 말 것.** vitest 가 `environment: 'node'` 다. `sfx.ts` 가 이걸 어겨서 import 만 해도 터진 적이 있다 (`fe95b9a` 에서 고침).
- **1·2·3라운드의 구성이 지금과 완전히 같아야 한다.** 튜토리얼이 거기 얹혀 있다. 이걸 깨는 변경은 전부 오답이다.
- **`steady` 움직임은 지금 곡선과 수치까지 같아야 한다.**
- 타입 단언(`as`, `!`, `@ts-expect-error`)을 쓰면 보고서에 왜 안전한지 적을 것.
- 주석은 한국어로, 왜 그런지를 쓴다.
- **UI 문자열은 영어다.** 이 계획은 UI 문자열을 안 건드리지만 새로 만들 일이 있으면 영어로.
- 검증 명령 셋: `npm run typecheck`, `npm test`, `npm run build`. **시작 시점 테스트는 231개다.**

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `gameplay/scoring.ts` | 점수→골드 변환에 라운드 배율 | 1 |
| `gameplay/roundComposition.ts` (신규) | 라운드 번호 → 구성 결정 전부 | 2·3·4·5 |
| `gameplay/monkeyAllocation.ts` | **태스크 2에서 삭제된다.** 구성기에 흡수 | 2 |
| `gameplay/laneLayout.ts` | 대형별 슬롯 좌표 | 3 |
| `gameplay/patrolMotion.ts` | 움직임 곡선 | 4 |
| `gameplay/monkey.ts` | `offsetY` 적용, 개체 배율 | 4·5 |
| `gameplay/targetManager.ts` | 구성기 결과를 실제 원숭이로 | 2·3·4·5 |
| `config.ts` | 새 상수들 | 1·2 |

---

### Task 1: 골드 라운드 배율

**Files:**
- Modify: `game/src/config.ts`, `game/src/gameplay/scoring.ts`, `game/src/gameplay/game.ts`
- Test: `test/scoring.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:

```ts
export function roundSettlementGold(
  pendingScore: number,
  roundNumber: number,
  config: { scorePerGold: number; goldRoundMultiplierPerRound: number }
): number;
```

**`settlementGold` 를 지우고 이걸로 대체한다.** 둘 다 두면 죽은 코드가 남는다.

**버림은 한 번만 한다.** 나눈 뒤 버리고 배율을 곱하면(또는 그 반대) 라운드마다 최대
1골드씩 새고, 낮은 라운드일수록 그 비율이 크다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/scoring.test.ts` 의 기존 `settlementGold` describe 블록을 통째로 아래로 바꾼다.

```ts
describe('roundSettlementGold', () => {
  const config = { scorePerGold: 10, goldRoundMultiplierPerRound: 0.15 };

  it('pays nothing for a round that scored nothing', () => {
    expect(roundSettlementGold(0, 1, config)).toBe(0);
    expect(roundSettlementGold(-50, 1, config)).toBe(0);
  });

  it('leaves round 1 on the plain conversion', () => {
    expect(roundSettlementGold(330, 1, config)).toBe(33);
  });

  it('scales with the round', () => {
    // 8라운드 배율은 1 + 7 x 0.15 = 2.05. 2000 / 10 x 2.05 = 410.
    expect(roundSettlementGold(2000, 8, config)).toBe(410);
    // 50라운드 배율은 1 + 49 x 0.15 = 8.35. 2000 / 10 x 8.35 = 1670.
    expect(roundSettlementGold(2000, 50, config)).toBe(1670);
  });

  // 회귀 방어. 나눈 뒤 버리고 곱하면 6 x 2.05 = 12 가 나온다. 한 번만 버려야 13이다.
  it('floors once, not twice', () => {
    expect(roundSettlementGold(65, 8, config)).toBe(13);
  });

  it('drops the remainder rather than carrying it', () => {
    expect(roundSettlementGold(19, 1, config)).toBe(1);
  });
});
```

`test/scoring.test.ts` 맨 위 import 에서 `settlementGold` 를 `roundSettlementGold` 로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/scoring.test.ts`
Expected: FAIL — `roundSettlementGold` is not exported

- [ ] **Step 3: config 에 상수를 넣는다**

`game/src/config.ts` 의 `scorePerGold: 10` 바로 아래에 넣는다.

```ts
  // 라운드가 올라가도 한 판 골드가 그대로였다. 원숭이 수가 10에서 멈춰서
  // 8라운드나 100라운드나 같은 점수가 나오는데 체력은 무한히 올라 시간만 길어진다.
  // 시간당 골드가 평평하려면 배율이 라운드/8 이어야 하고(50라운드에 6.25), 0.15는
  // 그보다 위라 높은 라운드가 이득이 되되 극단적이지 않다.
  goldRoundMultiplierPerRound: 0.15,
```

- [ ] **Step 4: scoring.ts 를 고친다**

기존 `settlementGold` 함수를 통째로 아래로 바꾼다.

```ts
// 라운드를 클리어할 때 미정산 점수를 골드로 바꾼다. 나머지는 버린다 —
// 이월을 만들면 상태가 하나 더 늘고 체감 차이가 없다.
//
// 나누기와 배율을 한 번에 곱하고 버림은 한 번만 한다. 나눈 뒤 버리고 곱하면
// 라운드마다 최대 1골드씩 새고 낮은 라운드일수록 그 비율이 크다.
export function roundSettlementGold(
  pendingScore: number,
  roundNumber: number,
  config: { scorePerGold: number; goldRoundMultiplierPerRound: number }
): number {
  if (pendingScore <= 0) return 0;
  const multiplier = 1 + (roundNumber - 1) * config.goldRoundMultiplierPerRound;
  return Math.floor((pendingScore / config.scorePerGold) * multiplier);
}
```

- [ ] **Step 5: game.ts 호출부를 고친다**

`game/src/gameplay/game.ts` 의 import 에서 `settlementGold` 를 `roundSettlementGold` 로
바꾸고, 정산 줄(`currencyStore.earn(settlementGold(...))`)을 아래로 바꾼다.

```ts
          currencyStore.earn(roundSettlementGold(scoreState.score - settledScore, round, CONFIG));
```

`CONFIG` 를 통째로 넘긴다 — `scorePerGold` 와 `goldRoundMultiplierPerRound` 가 둘 다
최상위 필드라 구조가 맞는다.

- [ ] **Step 6: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS. 개수는 기존 `settlementGold` 테스트를 대체하므로 231에서
   달라질 수 있다. **줄어들면 안 된다** — 위 describe 가 5개고 기존이 몇 개였는지
   확인해서 보고할 것
Run: `npm run build` → 성공

- [ ] **Step 7: 커밋한다**

```bash
git add -A
git commit -m "feat: pay more gold the further the round" -m "The score formula has no round term and the monkey count caps at ten, so a cleared round paid the same gold at round 100 as at round 8 while taking linearly longer to clear. Time-per-gold got strictly worse the further you went.

The multiplier is 1 + (round - 1) x 0.15. Flat time-per-gold would need round/8, so this sits a little above that. The division and the multiplier are applied together and floored once, because flooring twice leaks up to a gold per round and the loss is proportionally worst at low rounds."
```

---

### Task 2: 구성기 코어 — 배분과 결정성

**Files:**
- Create: `game/src/gameplay/roundComposition.ts`, `test/roundComposition.test.ts`
- Delete: `game/src/gameplay/monkeyAllocation.ts`, `test/monkeyAllocation.test.ts`
- Modify: `game/src/gameplay/targetManager.ts`, `game/src/config.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 태스크 3·4·5 가 전부 이걸 확장한다 —

```ts
export type BehaviorId = 'steady' | 'pause' | 'dash' | 'bob';
export type FormationId = 'columns' | 'wedge' | 'wide' | 'staggered';

export interface MonkeyPlan {
  behavior: BehaviorId;
  speedScale: number;
  sizeScale: number;
}

export interface RoundComposition {
  structureCount: number;
  laneCount: number;
  formation: FormationId;
  monkeys: MonkeyPlan[];
}

export function composeRound(
  roundNumber: number,
  monkeyCount: number,
  structureSlotCount: number
): RoundComposition;
```

**이 태스크는 화면에 아무 변화도 만들지 않는다.** 배분 규칙을 옮기고 이음매를 만드는
것까지다. 대형은 항상 `'columns'`, 원숭이는 전부 `{behavior:'steady', speedScale:1, sizeScale:1}` 을 낸다.

**`monkeys` 배열 순서가 슬롯 순서다.** 구조물 슬롯이 앞, 레인이 뒤다 — 지금
`targetManager` 가 도는 순서 그대로다.

**씨앗 함정.** `createSeededRandom` 은 LCG 라 이웃한 씨앗의 첫 출력이 거의 붙어 나온다
(`1664525 / 2^32` ≈ 0.0004 차이). 라운드 번호를 그대로 넣으면 12라운드와 13라운드
구성이 사실상 같아진다. 큰 홀수를 곱해 비트를 흩은 뒤 넣어야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/roundComposition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { composeRound } from '../game/src/gameplay/roundComposition';

// obstacles.ts 의 실제 슬롯 수: 타워 2 + 통로 2.
const SLOTS = 4;

describe('composeRound', () => {
  it('gives the same composition for the same round every time', () => {
    expect(composeRound(12, 10, SLOTS)).toEqual(composeRound(12, 10, SLOTS));
  });

  // 회귀 방어. LCG는 이웃 씨앗에서 첫 출력이 거의 같아서, 라운드 번호를 그대로
  // 씨앗으로 쓰면 이 테스트가 깨진다.
  it('gives different compositions to adjacent rounds', () => {
    const rounds = [10, 11, 12, 13, 14].map((n) => JSON.stringify(composeRound(n, 10, SLOTS)));
    expect(new Set(rounds).size).toBeGreaterThan(1);
  });

  it('hands one monkey to the lanes even when the structures could take them all', () => {
    // 1라운드는 원숭이 셋에 슬롯 넷이다. 슬롯을 다 채우면 레인이 빈다.
    const composition = composeRound(1, 3, SLOTS);
    expect(composition.structureCount).toBe(2);
    expect(composition.laneCount).toBe(1);
  });

  it('never plans more monkeys than the round has', () => {
    for (let round = 1; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const composition = composeRound(round, count, SLOTS);
      expect(composition.structureCount + composition.laneCount).toBe(count);
      expect(composition.monkeys).toHaveLength(count);
      expect(composition.structureCount).toBeLessThanOrEqual(SLOTS);
      expect(composition.laneCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves the first three rounds exactly as they were', () => {
    for (const [round, count] of [[1, 3], [2, 4], [3, 5]] as const) {
      const composition = composeRound(round, count, SLOTS);
      expect(composition.formation).toBe('columns');
      for (const monkey of composition.monkeys) {
        expect(monkey).toEqual({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
      }
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/roundComposition.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구성기를 만든다**

`game/src/gameplay/roundComposition.ts`:

```ts
import { createSeededRandom } from './skyMotion';

export type BehaviorId = 'steady' | 'pause' | 'dash' | 'bob';
export type FormationId = 'columns' | 'wedge' | 'wide' | 'staggered';

export interface MonkeyPlan {
  behavior: BehaviorId;
  speedScale: number;
  sizeScale: number;
}

export interface RoundComposition {
  structureCount: number;
  laneCount: number;
  formation: FormationId;
  monkeys: MonkeyPlan[];
}

// createSeededRandom 은 LCG 라 이웃한 씨앗의 첫 출력이 거의 붙어 나온다
// (1664525 / 2^32 ≈ 0.0004 차이). 라운드 번호를 그대로 넣으면 12라운드와
// 13라운드 구성이 사실상 같아진다. 큰 홀수를 곱해 비트를 흩은 뒤 넣는다.
const SEED_STRIDE = 2654435761;

function seedFor(roundNumber: number) {
  return createSeededRandom(Math.imul(roundNumber, SEED_STRIDE) >>> 0);
}

// 구조물 슬롯이 그 라운드의 원숭이 수보다 많을 수 있다. 타워 둘에 통로 둘이면
// 슬롯이 넷인데 1라운드 원숭이는 셋이다. 슬롯을 먼저 다 채우면 레인이 비어서
// 판 전체가 구조물 위에만 서 있게 되고, 통로 하나 무너뜨리면 판이 끝난다.
// 그래서 레인에 최소 한 마리는 남긴다.
function splitBetweenStructuresAndLanes(monkeyCount: number, structureSlotCount: number) {
  const structureCount = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  return { structureCount, laneCount: monkeyCount - structureCount };
}

export function composeRound(
  roundNumber: number,
  monkeyCount: number,
  structureSlotCount: number
): RoundComposition {
  // 아직 안 쓰지만 태스크 3부터 이 난수열을 쓴다. 여기서 만들어 두면 이후
  // 태스크가 씨앗 규칙을 다시 정하지 않는다.
  seedFor(roundNumber);

  const { structureCount, laneCount } = splitBetweenStructuresAndLanes(
    monkeyCount,
    structureSlotCount
  );

  const monkeys: MonkeyPlan[] = [];
  for (let i = 0; i < monkeyCount; i += 1) {
    monkeys.push({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
  }

  return { structureCount, laneCount, formation: 'columns', monkeys };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run test/roundComposition.test.ts`
Expected: PASS — 5개

- [ ] **Step 5: targetManager 를 구성기로 갈아탄다**

`game/src/gameplay/targetManager.ts` 의 import 두 줄을 바꾼다.

바꾸기 전:

```ts
import { allocateMonkeys } from './monkeyAllocation';
```

바꾼 뒤:

```ts
import { composeRound } from './roundComposition';
```

`spawnRound` 안의 배분 세 줄을 바꾼다.

바꾸기 전:

```ts
    const split = allocateMonkeys(params.monkeyCount, towerSlots.length);
    const structureCount = split.structureCount;
    const laneMonkeyCount = split.laneCount;
```

바꾼 뒤:

```ts
    const composition = composeRound(roundNumber, params.monkeyCount, towerSlots.length);
    const structureCount = composition.structureCount;
    const laneMonkeyCount = composition.laneCount;
```

- [ ] **Step 6: 옛 모듈을 지운다**

```bash
git rm game/src/gameplay/monkeyAllocation.ts test/monkeyAllocation.test.ts
```

Grep 툴로 `allocateMonkeys` 와 `monkeyAllocation` 을 저장소 전체에서 찾는다.
Expected: 없음. 남아 있으면 지우다 만 것이다.

- [ ] **Step 7: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS. `monkeyAllocation.test.ts` 5개가 빠지고 새 5개가 들어온다.
   **파일 수는 그대로 30개다** (하나 지우고 하나 만들었다)
Run: `npm run build` → 성공

- [ ] **Step 8: 커밋한다**

```bash
git add -A
git commit -m "refactor: move round makeup behind one seeded composer" -m "Placement, movement and per-monkey variation are all the same question -- given a round, what does this one look like -- so they get decided in one pure module instead of three. Nothing changes on screen yet: the composer returns the columns formation and a steady monkey for every slot, which is what the code already did.

monkeyAllocation is absorbed rather than kept alongside, because a formation that wants three monkeys on a structure has to agree with the split, and two modules deciding that separately is how they drift.

The round number is hashed before it seeds the generator. An LCG barely moves its first output between adjacent seeds, so feeding the raw round number would have made round 12 and round 13 near-identical."
```

---

### Task 3: 대형

**Files:**
- Modify: `game/src/gameplay/laneLayout.ts`, `game/src/gameplay/roundComposition.ts`, `game/src/gameplay/targetManager.ts`, `game/src/config.ts`
- Test: `test/laneLayout.test.ts`, `test/roundComposition.test.ts`

**Interfaces:**
- Consumes: 태스크 2의 `FormationId`, `composeRound`
- Produces:

```ts
export function computeLaneLayout(
  monkeyCount: number,
  monkeySpeed: number,
  monkeyScale: number,
  formation: FormationId
): LaneSlot[];
```

`LaneSlot` 은 지금 반환하는 모양 그대로다 (`{ x, y, z, swayAmplitude, swayFrequency, swayPhase }`).

**`columns` 는 지금 함수와 좌표가 완전히 같아야 한다.**

**섬을 벗어나면 안 된다.** 섬 폭이 26(±13)이다. 슬롯의 `|x| + swayAmplitude` 가 13을
넘으면 원숭이가 허공에 선다. `wide` 가 각도를 넓히므로 여기가 위험하다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/laneLayout.test.ts` 맨 아래에 붙인다. 기존 테스트의 `computeLaneLayout(...)`
호출에는 네 번째 인자로 `'columns'` 를 넣어 준다.

```ts
import type { FormationId } from '../game/src/gameplay/roundComposition';

const FORMATIONS: FormationId[] = ['columns', 'wedge', 'wide', 'staggered'];
// world.ts 의 섬 폭이 26이다. 절반을 넘으면 원숭이가 섬 밖 허공에 선다.
const ISLAND_HALF_WIDTH = 13;

describe('formations', () => {
  it('leaves columns byte-identical to what it was', () => {
    // 이 값들은 대형이 생기기 전 computeLaneLayout(7, 0.25, 1) 의 출력이다.
    const slots = computeLaneLayout(7, 0.25, 1, 'columns');
    expect(slots).toHaveLength(7);
    expect(slots[0].x).toBeCloseTo(-0.09 * 78, 10);
    expect(slots[0].z).toBeCloseTo(-78, 10);
    expect(slots[1].z).toBeCloseTo(-84, 10);
    expect(slots[0].swayAmplitude).toBeCloseTo(0.038 * 78, 10);
    expect(slots[0].swayFrequency).toBeCloseTo(1.8 * 0.25, 10);
  });

  it('keeps every monkey over the island in every formation', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        for (const slot of computeLaneLayout(count, 0.25, 1, formation)) {
          const reach = Math.abs(slot.x) + slot.swayAmplitude;
          expect(reach, `${formation} with ${count}`).toBeLessThanOrEqual(ISLAND_HALF_WIDTH);
        }
      }
    }
  });

  it('never puts two monkeys on top of each other', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        const slots = computeLaneLayout(count, 0.25, 1, formation);
        for (let i = 0; i < slots.length; i += 1) {
          for (let j = i + 1; j < slots.length; j += 1) {
            const dx = slots[i].x - slots[j].x;
            const dz = slots[i].z - slots[j].z;
            expect(Math.hypot(dx, dz), `${formation} with ${count}, slots ${i}/${j}`)
              .toBeGreaterThan(2);
          }
        }
      }
    }
  });

  it('gives every formation the same number of slots it was asked for', () => {
    for (const formation of FORMATIONS) {
      for (let count = 1; count <= 10; count += 1) {
        expect(computeLaneLayout(count, 0.25, 1, formation)).toHaveLength(count);
      }
    }
  });
});
```

`test/roundComposition.test.ts` 에도 해금 테스트를 더한다.

```ts
  it('holds the columns formation until round 4', () => {
    for (let round = 1; round <= 3; round += 1) {
      expect(composeRound(round, 3 + round - 1, SLOTS).formation).toBe('columns');
    }
  });

  it('uses more than one formation once they unlock', () => {
    const seen = new Set<string>();
    for (let round = 4; round <= 40; round += 1) {
      seen.add(composeRound(round, Math.min(3 + round - 1, 10), SLOTS).formation);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/laneLayout.test.ts test/roundComposition.test.ts`
Expected: FAIL — `computeLaneLayout` 이 인자 넷을 안 받는다

- [ ] **Step 3: laneLayout 에 대형을 넣는다**

`game/src/gameplay/laneLayout.ts` 를 통째로 아래로 바꾼다.

```ts
import type { FormationId } from './roundComposition';

const FRONT_Z = -78;
const BASE_DEPTH_GAP = 6;
const MAX_LANE_ANGLE = 0.09;
const ANGULAR_SWAY_AMPLITUDE = 0.038;
const SWAY_FREQUENCY_PER_SPEED = 1.8;
const GROUND_Y = -1.0;

// wide 는 각도를 넓혀 좌우로 벌린다. 섬 반폭이 13이라 여기가 빡빡하다.
//
// 계산은 가장 바깥·가장 깊은 슬롯으로 해야 한다. wide 는 레인당 2마리라 깊이가
// z = -84 까지 가고, 각도와 순찰 진폭이 둘 다 |z| 에 비례하므로 거기가 최대다.
//   1.2 → 0.09 x 1.2 x 84 = 9.07, 진폭 0.038 x 84 = 3.19, 합 12.26  (안전)
//   1.3 → 9.83 + 3.19 = 13.02                                        (섬 밖)
// 1.3 을 먼저 넣었다가 계산에서 걸렸다. 올리려면 진폭까지 같이 봐야 한다.
const WIDE_ANGLE_SCALE = 1.2;
// 쐐기와 엇갈림이 깊이를 미는 정도. 깊이 간격의 절반이라 앞뒤 줄이 겹치지 않는다.
const DEPTH_STEP_RATIO = 0.5;

function partitionIntoLanes(count: number, perLane: number): number[] {
  if (count === 1) return [1];
  const remainder = count % perLane;
  let full = Math.floor(count / perLane);
  let short = 0;
  if (remainder === 1 && perLane > 2) {
    full -= 1;
    short = 2;
  } else if (remainder > 0) {
    short = 1;
  }
  const sizes: number[] = [];
  for (let i = 0; i < full; i += 1) sizes.push(perLane);
  for (let i = 0; i < short; i += 1) sizes.push(remainder === 1 && perLane > 2 ? 2 : remainder);
  return sizes;
}

// 대형마다 다른 것은 셋뿐이다 — 레인당 인원, 각도 배율, 레인별 깊이 밀기.
// 나머지 계산은 공유한다.
function formationShape(formation: FormationId) {
  switch (formation) {
    case 'wide':
      return { perLane: 2, angleScale: WIDE_ANGLE_SCALE, depthPush: () => 0 };
    case 'wedge':
      // 가운데가 앞, 바깥 레인이 뒤로 물러난다.
      return {
        perLane: 3,
        angleScale: 1,
        depthPush: (laneIndex: number, laneCount: number) =>
          Math.abs(laneIndex - (laneCount - 1) / 2) * DEPTH_STEP_RATIO,
      };
    case 'staggered':
      // 이웃한 레인이 반 칸씩 엇갈린다.
      return {
        perLane: 3,
        angleScale: 1,
        depthPush: (laneIndex: number) => (laneIndex % 2) * DEPTH_STEP_RATIO,
      };
    case 'columns':
    default:
      return { perLane: 3, angleScale: 1, depthPush: () => 0 };
  }
}

export function computeLaneLayout(
  monkeyCount: number,
  monkeySpeed: number,
  monkeyScale: number,
  formation: FormationId
) {
  const shape = formationShape(formation);
  const laneSizes = partitionIntoLanes(monkeyCount, shape.perLane);
  const laneCount = laneSizes.length;
  const frequency = SWAY_FREQUENCY_PER_SPEED * monkeySpeed;
  const depthGap = BASE_DEPTH_GAP * monkeyScale;
  const maxAngle = MAX_LANE_ANGLE * shape.angleScale;
  const slots = [];

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const laneAngle =
      laneCount === 1 ? 0 : -maxAngle + (2 * maxAngle * laneIndex) / (laneCount - 1);
    const size = laneSizes[laneIndex];
    const push = shape.depthPush(laneIndex, laneCount);
    for (let j = 0; j < size; j++) {
      const z = FRONT_Z - (j + push) * depthGap;
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

**`columns` 가 예전과 같은지 확인하는 방법:** `perLane` 3, `angleScale` 1,
`depthPush` 0 이면 `partitionIntoLanes(count, 3)` 이 옛 `partitionIntoLanes(count)` 와
같은 배열을 내고 나머지 식이 그대로다. Step 1 의 첫 테스트가 이걸 못 박는다.

- [ ] **Step 4: 구성기가 대형을 고르게 한다**

`roundComposition.ts` 에 상수와 선택을 넣는다.

```ts
// 전부 한 번에 열면 1라운드가 아수라장이 되고 튜토리얼이 그 위에 얹혀 있다.
const FORMATION_UNLOCK_ROUND = 4;

const FORMATIONS: FormationId[] = ['columns', 'wedge', 'wide', 'staggered'];
```

`composeRound` 안에서 `seedFor(roundNumber)` 의 반환을 실제로 쓴다.

```ts
  const random = seedFor(roundNumber);

  const formation =
    roundNumber < FORMATION_UNLOCK_ROUND
      ? 'columns'
      : FORMATIONS[Math.floor(random() * FORMATIONS.length)];
```

반환의 `formation: 'columns'` 를 `formation` 으로 바꾼다.

- [ ] **Step 5: targetManager 가 대형을 넘기게 한다**

`computeLaneLayout` 호출에 네 번째 인자를 더한다.

```ts
    const layout = computeLaneLayout(
      laneMonkeyCount,
      params.monkeySpeed,
      params.monkeyScale,
      composition.formation
    );
```

- [ ] **Step 6: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS
Run: `npm run build` → 성공

**섬 밖 테스트가 깨지면 `WIDE_ANGLE_SCALE` 을 내린다.** 그 상수가 그러라고 있다.
**겹침 테스트가 깨지면 `DEPTH_STEP_RATIO` 를 조정한다.**

- [ ] **Step 7: 커밋한다**

```bash
git add -A
git commit -m "feat: give each round one of four lane formations" -m "The lane layout was a pure function of the monkey count, and the count caps at ten, so every round from eight onward placed every monkey at identical coordinates. Rounds four and up now draw a formation from the seeded generator.

columns is the old layout unchanged, which is what keeps the first three rounds -- and the tutorial that sits on them -- exactly as they were.

wide is capped at 1.3x the lane angle. The island is 26 across and the patrol amplitude rides on top of the lane offset, so 1.6x would have stood monkeys off the edge. A test pins that every slot in every formation stays over the island, and another pins that no two share a spot."
```

---

### Task 4: 움직임 패턴

**Files:**
- Modify: `game/src/gameplay/patrolMotion.ts`, `game/src/gameplay/monkey.ts`, `game/src/gameplay/roundComposition.ts`, `game/src/gameplay/targetManager.ts`
- Test: `test/patrolMotion.test.ts`, `test/roundComposition.test.ts`

**Interfaces:**
- Consumes: 태스크 2의 `BehaviorId`
- Produces:

```ts
export interface PatrolSample {
  offsetX: number;
  offsetY: number;   // 새 필드. bob 말고는 항상 0
  facing: number;
  gaitDelta: number;
  stride: number;
  taunt: number;
}

export function createPatrol(params: {
  amplitude: number;
  frequency: number;
  phase: number;
  behavior: BehaviorId;
}): { sample(elapsed: number, dt: number): PatrolSample };
```

**곡선을 하나의 거듭제곱 형태로 통일한다.** `value = sign(sin a) x |sin a|^p`.

| behavior | p | 뜻 |
|---|---|---|
| `steady` | 1 | `sign(s) x |s|^1 = s`. **지금 곡선과 완전히 동일하다** |
| `pause` | 0.55 | 양 끝에서 오래 머문다 |
| `dash` | 2.2 | 가운데서 끌다 양 끝으로 빠르게 |
| `bob` | 1 | x 는 steady 와 같고 y 가 더해진다 |

속도는 미분이다: `p x |s|^(p-1) x cos a`. `p < 1` 이면 `s = 0` 에서 발산하므로
**반드시 `[0, 1]` 로 자른다.** 자르는 게 의미상으로도 맞다 — 그 순간이 가장 빠른 지점이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/patrolMotion.test.ts` 의 기존 `createPatrol({...})` 호출 전부에
`behavior: 'steady'` 를 더한 뒤, 맨 아래에 붙인다.

```ts
import type { BehaviorId } from '../game/src/gameplay/roundComposition';

const BEHAVIORS: BehaviorId[] = ['steady', 'pause', 'dash', 'bob'];

describe('behaviors', () => {
  // 회귀 방어. steady 는 거듭제곱 1 이라 sign(s) x |s|^1 = s 로 예전 식과 같아야 한다.
  it('leaves steady on the original sine', () => {
    const patrol = createPatrol({ amplitude: 3, frequency: 1.5, phase: 0.4, behavior: 'steady' });
    for (const elapsed of [0, 0.3, 1.1, 2.7, 5.5]) {
      const angle = elapsed * 1.5 + 0.4;
      const sample = patrol.sample(elapsed, 0.016);
      expect(sample.offsetX).toBeCloseTo(Math.sin(angle) * 3, 10);
      expect(sample.offsetY).toBe(0);
    }
  });

  it('keeps every behaviour inside its amplitude', () => {
    for (const behavior of BEHAVIORS) {
      const patrol = createPatrol({ amplitude: 3, frequency: 1.5, phase: 0, behavior });
      for (let elapsed = 0; elapsed < 12; elapsed += 0.05) {
        const sample = patrol.sample(elapsed, 0.05);
        expect(Math.abs(sample.offsetX), behavior).toBeLessThanOrEqual(3.0001);
      }
    }
  });

  // 타워 위 원숭이는 진폭이 0이라 제자리에 선다. 곡선을 갈아 끼워도 이 분기를
  // 타야 한다 -- 안 그러면 타워 원숭이가 공중에서 흔들린다.
  it('freezes every behaviour when the amplitude is zero', () => {
    for (const behavior of BEHAVIORS) {
      const patrol = createPatrol({ amplitude: 0, frequency: 1.5, phase: 0, behavior });
      for (let elapsed = 0; elapsed < 6; elapsed += 0.25) {
        const sample = patrol.sample(elapsed, 0.25);
        expect(sample.offsetX, behavior).toBe(0);
        expect(sample.offsetY, behavior).toBe(0);
        expect(sample.facing, behavior).toBe(0);
        expect(sample.gaitDelta, behavior).toBe(0);
        expect(sample.stride, behavior).toBe(0);
      }
    }
  });

  // p < 1 이면 속도가 중앙에서 발산한다. 자르지 않으면 다리가 미친 듯이 돈다.
  it('never lets stride or gait blow up, even where pause is fastest', () => {
    const patrol = createPatrol({ amplitude: 3, frequency: 1.5, phase: 0, behavior: 'pause' });
    for (let elapsed = 0; elapsed < 12; elapsed += 0.01) {
      const sample = patrol.sample(elapsed, 0.01);
      expect(Number.isFinite(sample.gaitDelta)).toBe(true);
      expect(sample.stride).toBeGreaterThanOrEqual(0);
      expect(sample.stride).toBeLessThanOrEqual(1);
    }
  });

  it('only bob moves vertically', () => {
    for (const behavior of BEHAVIORS) {
      const patrol = createPatrol({ amplitude: 3, frequency: 1.5, phase: 0, behavior });
      let sawVertical = false;
      for (let elapsed = 0; elapsed < 12; elapsed += 0.05) {
        if (Math.abs(patrol.sample(elapsed, 0.05).offsetY) > 1e-9) sawVertical = true;
      }
      expect(sawVertical, behavior).toBe(behavior === 'bob');
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/patrolMotion.test.ts`
Expected: FAIL — `behavior` 를 안 받고 `offsetY` 가 없다

- [ ] **Step 3: patrolMotion 을 고친다**

`game/src/gameplay/patrolMotion.ts` 의 `PatrolSample` 부터 아래를 통째로 바꾼다.
파일 맨 위 주석과 `FACE_THRESHOLD`·`RIGHT_FACING` 상수는 그대로 둔다.

```ts
import type { BehaviorId } from './roundComposition';

export interface PatrolSample {
  offsetX: number;
  offsetY: number;
  facing: number;
  gaitDelta: number;
  stride: number;
  taunt: number;
}

interface PatrolParams {
  amplitude: number;
  frequency: number;
  phase: number;
  behavior: BehaviorId;
}

// 곡선을 sign(sin a) x |sin a|^p 하나로 통일한다. p = 1 이면 그냥 sin 이라
// steady 가 예전 식과 완전히 같다. p < 1 은 양 끝에 머물고, p > 1 은 가운데서 끌다
// 양 끝으로 빠르게 간다.
const BEHAVIOR_POWER: Record<BehaviorId, number> = {
  steady: 1,
  pause: 0.55,
  dash: 2.2,
  bob: 1,
};

// bob 의 세로 흔들림. 좌우 주기와 정수배가 되면 두 축이 맞물려 한 방향으로
// 기울어진 직선처럼 보이므로 무리수에 가까운 비율을 쓴다.
const BOB_RATIO = 2.3;
const BOB_AMPLITUDE = 0.5;

// p < 1 이면 속도가 sin = 0 에서 발산한다. 0 으로 나누지 않도록 크기를 바닥에서
// 막고, 그래도 남는 큰 값은 아래에서 1 로 자른다.
const MAGNITUDE_FLOOR = 1e-3;

export function createPatrol({ amplitude, frequency, phase, behavior }: PatrolParams) {
  const power = BEHAVIOR_POWER[behavior];

  return {
    sample(elapsed: number, dt: number): PatrolSample {
      const angle = elapsed * frequency + phase;
      const sine = Math.sin(angle);
      const cosine = Math.cos(angle);

      // 정규화 위치와 그 속도. power 가 1 이면 각각 sin, cos 라 예전과 같다.
      const magnitude = Math.max(Math.abs(sine), MAGNITUDE_FLOOR);
      const value = power === 1 ? sine : Math.sign(sine) * Math.pow(magnitude, power);
      const rawSpeed =
        power === 1 ? Math.abs(cosine) : power * Math.pow(magnitude, power - 1) * Math.abs(cosine);
      const speedNorm = Math.min(rawSpeed, 1);

      const taunt = Math.max(0, 1 - speedNorm / FACE_THRESHOLD);

      // 타워 위 원숭이는 진폭이 0이다. 안 움직이니 몸을 틀 방향도 걸음도 없다.
      // stride도 0이어야 한다 — 실제로 이동하지 않으므로, 다리를 벌린 채 굳는 대신
      // idle 클립 포즈 그대로 서 있어야 한다.
      if (amplitude === 0) {
        return { offsetX: 0, offsetY: 0, facing: 0, gaitDelta: 0, stride: 0, taunt };
      }

      // 몸을 트는 정도와 다리를 흔드는 정도가 같은 곡선을 쓴다. 걸음이 온전한 구간에서
      // 옆을 보고, 멈추는 순간에 정면으로 돌며 다리를 모은다.
      //
      // stride에 speedNorm을 그대로 쓰면 안 된다. |cos| < 0.5인 구간이 매 주기의
      // 3분의 1이라, 다리 스윙 폭이 그만큼 오래 죽어 걷기 동작이 사라진 것처럼 보인다.
      // 여기서 잘라 줘야 실제로 멈추는 순간에만 다리가 모인다.
      const stride = Math.min(speedNorm / FACE_THRESHOLD, 1);
      const direction = cosine >= 0 ? 1 : -1;

      return {
        offsetX: value * amplitude,
        offsetY: behavior === 'bob' ? Math.sin(angle * BOB_RATIO + phase) * BOB_AMPLITUDE : 0,
        facing: direction * RIGHT_FACING * stride,
        gaitDelta: speedNorm * amplitude * frequency * dt,
        stride,
        taunt,
      };
    },
  };
}
```

- [ ] **Step 4: monkey.ts 가 offsetY 를 쓰게 한다**

`updateIdle` 안에서 두 줄을 바꾼다. 세로 흔들림(`bobPhase`)은 이미 있고 그 위에 더한다.

바꾸기 전:

```ts
    const bobPhase = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.5 + 0.5;
    group.position.y = position.y + bobPhase * BOB_HEIGHT;

    const motion = patrol.sample(state.elapsed, dt);
    group.position.x = position.x + motion.offsetX;
```

바꾼 뒤:

```ts
    const bobPhase = Math.sin(state.elapsed * 3 + state.phaseOffset) * 0.5 + 0.5;

    const motion = patrol.sample(state.elapsed, dt);
    group.position.x = position.x + motion.offsetX;
    // 원래 있던 걷기 상하 흔들림 위에 behavior 의 세로 움직임을 더한다. bob 말고는
    // offsetY 가 0 이라 예전과 같은 높이가 나온다.
    group.position.y = position.y + bobPhase * BOB_HEIGHT + motion.offsetY;
```

`createMonkey` 의 매개변수에 `behavior` 를 더한다. `CreateMonkeyParams` 인터페이스에:

```ts
  behavior?: BehaviorId;
```

구조 분해에 기본값을 준다 — 기존 호출부가 안 깨지게:

```ts
export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip, sway = {}, hp = 1, behavior = 'steady' }: CreateMonkeyParams) {
```

`createPatrol` 호출에 넘긴다:

```ts
  const patrol = createPatrol({
    amplitude: swayAmplitude,
    frequency: swayFrequency,
    phase: swayPhase,
    behavior,
  });
```

`monkey.ts` 맨 위에 import 를 더한다:

```ts
import type { BehaviorId } from './roundComposition';
```

- [ ] **Step 5: 구성기가 behavior 를 배정하게 한다**

`roundComposition.ts` 에 넣는다.

```ts
// 해금 라운드. 어려운 것일수록 늦게 연다.
const BEHAVIOR_UNLOCK_ROUND: Record<BehaviorId, number> = {
  steady: 1,
  pause: 6,
  dash: 10,
  bob: 15,
};

// 난이도 가중치. pause 는 양 끝에 오래 머물러 오히려 맞히기 쉽다.
const BEHAVIOR_WEIGHT: Record<BehaviorId, number> = {
  steady: 0,
  pause: -1,
  dash: 2,
  bob: 2,
};

const BEHAVIORS: BehaviorId[] = ['steady', 'pause', 'dash', 'bob'];

// 한 판에 어려운 것이 몰리지 않게 가중치 합에 상한을 건다. 안 걸면 dash 와 bob 만
// 열 마리인 판이 나온다. 4라운드에 0 에서 시작해 두 라운드마다 1씩 오른다.
function difficultyBudget(roundNumber: number) {
  return Math.max(0, Math.floor((roundNumber - 4) / 2));
}
```

`composeRound` 의 원숭이 루프를 바꾼다.

```ts
  const unlocked = BEHAVIORS.filter((id) => roundNumber >= BEHAVIOR_UNLOCK_ROUND[id]);
  let budget = difficultyBudget(roundNumber);

  const monkeys: MonkeyPlan[] = [];
  for (let i = 0; i < monkeyCount; i += 1) {
    // 예산 안에 드는 것만 후보다. steady 는 가중치 0 이라 항상 남는다.
    const affordable = unlocked.filter((id) => BEHAVIOR_WEIGHT[id] <= budget);
    const behavior = affordable[Math.floor(random() * affordable.length)];
    budget -= BEHAVIOR_WEIGHT[behavior];
    monkeys.push({ behavior, speedScale: 1, sizeScale: 1 });
  }
```

**`budget -= weight` 라 `pause`(-1)는 예산을 돌려준다.** 의도한 것이다 — 쉬운 것을
섞으면 어려운 것을 하나 더 쓸 수 있다.

- [ ] **Step 6: targetManager 가 behavior 를 넘기게 한다**

`spawnRound` 의 두 `createMonkey` 호출 각각에 `behavior` 를 더한다. 구조물 루프는
`composition.monkeys[i]`, 레인 루프는 `composition.monkeys[structureCount + i]` 다.

구조물 루프:

```ts
        hp: params.monkeyHp,
        behavior: composition.monkeys[i].behavior,
      });
```

레인 루프:

```ts
        hp: params.monkeyHp,
        behavior: composition.monkeys[structureCount + i].behavior,
      });
```

- [ ] **Step 7: 구성기 테스트를 더한다**

`test/roundComposition.test.ts` 에 붙인다.

```ts
  it('holds every behaviour but steady until it unlocks', () => {
    const unlock = { pause: 6, dash: 10, bob: 15 } as const;
    for (let round = 1; round <= 40; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      for (const monkey of composeRound(round, count, SLOTS).monkeys) {
        if (monkey.behavior === 'steady') continue;
        expect(round, `${monkey.behavior} at round ${round}`)
          .toBeGreaterThanOrEqual(unlock[monkey.behavior]);
      }
    }
  });

  it('never stacks more hard behaviours than the round can afford', () => {
    const weight = { steady: 0, pause: -1, dash: 2, bob: 2 } as const;
    for (let round = 1; round <= 60; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const spent = composeRound(round, count, SLOTS).monkeys
        .reduce((sum, monkey) => sum + weight[monkey.behavior], 0);
      const budget = Math.max(0, Math.floor((round - 4) / 2));
      expect(spent, `round ${round}`).toBeLessThanOrEqual(budget);
    }
  });

  it('still gives the first three rounds nothing but steady', () => {
    for (const [round, count] of [[1, 3], [2, 4], [3, 5]] as const) {
      for (const monkey of composeRound(round, count, SLOTS).monkeys) {
        expect(monkey.behavior).toBe('steady');
      }
    }
  });
```

- [ ] **Step 8: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS
Run: `npm run build` → 성공

- [ ] **Step 9: 커밋한다**

```bash
git add -A
git commit -m "feat: give monkeys four patrol curves instead of one" -m "Every monkey moved on the same sine, and the only thing a higher round changed was how fast it ran. All four curves are now one shape -- sign(sin a) times |sin a| to the power p -- so steady is p = 1 and comes out byte-identical to the old formula, which is what keeps the first three rounds and the tutorial intact.

pause lingers at the ends and is scored as easier than steady, so mixing one in buys the composer another hard monkey. dash drags through the middle then crosses quickly. bob adds a vertical term on top of the walk cycle's existing bounce.

Speed is the derivative, which diverges at the centre for p below one, so it is floored and then clamped -- clamping is also what it means: that instant is the fastest the monkey moves."
```

---

### Task 5: 개체 차이와 구조물 편중

**Files:**
- Modify: `game/src/gameplay/roundComposition.ts`, `game/src/gameplay/targetManager.ts`
- Test: `test/roundComposition.test.ts`

**Interfaces:**
- Consumes: 태스크 2·4 의 `MonkeyPlan`
- Produces: 없음. 여기가 마지막이다

**체력은 안 건드린다.** 개체마다 체력이 다르면 점수·정산·마지막 처치 연출과 얽힌다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/roundComposition.test.ts` 에 붙인다.

```ts
  it('keeps every monkey identical until variance unlocks at round 6', () => {
    for (let round = 1; round <= 5; round += 1) {
      for (const monkey of composeRound(round, Math.min(3 + round - 1, 10), SLOTS).monkeys) {
        expect(monkey.speedScale).toBe(1);
        expect(monkey.sizeScale).toBe(1);
      }
    }
  });

  it('mixes fast and slow monkeys once variance unlocks', () => {
    const seen = new Set<number>();
    for (let round = 6; round <= 40; round += 1) {
      for (const monkey of composeRound(round, Math.min(3 + round - 1, 10), SLOTS).monkeys) {
        seen.add(monkey.speedScale);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  // 빠른 개체는 작아야 한다. 크기가 난이도 신호라 플레이어가 우선순위를 고를 수 있다.
  it('makes the fast ones smaller and the slow ones bigger', () => {
    for (let round = 6; round <= 40; round += 1) {
      for (const monkey of composeRound(round, Math.min(3 + round - 1, 10), SLOTS).monkeys) {
        if (monkey.speedScale > 1) expect(monkey.sizeScale).toBeLessThan(1);
        if (monkey.speedScale < 1) expect(monkey.sizeScale).toBeGreaterThan(1);
        if (monkey.speedScale === 1) expect(monkey.sizeScale).toBe(1);
      }
    }
  });

  it('always leaves at least one monkey in the lanes however it emphasises structures', () => {
    for (let round = 1; round <= 60; round += 1) {
      const count = Math.min(3 + (round - 1), 10);
      const composition = composeRound(round, count, SLOTS);
      expect(composition.laneCount, `round ${round}`).toBeGreaterThanOrEqual(1);
      expect(composition.structureCount + composition.laneCount).toBe(count);
    }
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run test/roundComposition.test.ts`
Expected: FAIL — 모든 개체가 `speedScale: 1` 이다

- [ ] **Step 3: 구성기에 개체 차이를 넣는다**

`roundComposition.ts` 에 상수를 넣는다.

```ts
const VARIANCE_UNLOCK_ROUND = 6;
const STRUCTURE_EMPHASIS_UNLOCK_ROUND = 15;

// 빠른 놈은 작고 느린 놈은 크다. 크기가 난이도 신호라 플레이어가 뭘 먼저 쏠지
// 고를 수 있다. 체력은 안 건드린다 — 개체마다 다르면 점수·정산과 얽힌다.
const VARIANTS = [
  { speedScale: 0.7, sizeScale: 1.15 },
  { speedScale: 1.0, sizeScale: 1.0 },
  { speedScale: 1.4, sizeScale: 0.85 },
];
```

원숭이 루프의 `push` 를 바꾼다.

```ts
    const variant =
      roundNumber < VARIANCE_UNLOCK_ROUND
        ? { speedScale: 1, sizeScale: 1 }
        : VARIANTS[Math.floor(random() * VARIANTS.length)];
    monkeys.push({ behavior, speedScale: variant.speedScale, sizeScale: variant.sizeScale });
```

- [ ] **Step 4: 구조물 편중을 넣는다**

`splitBetweenStructuresAndLanes` 를 라운드까지 받게 바꾼다.

```ts
// 구조물 슬롯이 그 라운드의 원숭이 수보다 많을 수 있다. 타워 둘에 통로 둘이면
// 슬롯이 넷인데 1라운드 원숭이는 셋이다. 슬롯을 먼저 다 채우면 레인이 비어서
// 판 전체가 구조물 위에만 서 있게 되고, 통로 하나 무너뜨리면 판이 끝난다.
// 그래서 레인에 최소 한 마리는 남긴다.
//
// 15라운드부터는 구조물을 덜 쓰는 판도 섞는다. 항상 슬롯을 꽉 채우면 어느 판이나
// 구조물부터 부수는 같은 순서로 풀린다.
function splitBetweenStructuresAndLanes(
  monkeyCount: number,
  structureSlotCount: number,
  roundNumber: number,
  random: () => number
) {
  const ceiling = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  if (roundNumber < STRUCTURE_EMPHASIS_UNLOCK_ROUND) {
    return { structureCount: ceiling, laneCount: monkeyCount - ceiling };
  }
  // 0 은 안 쓴다 — 구조물이 통째로 비면 무너뜨리는 재미가 사라진다.
  const structureCount = ceiling === 0 ? 0 : 1 + Math.floor(random() * ceiling);
  return { structureCount, laneCount: monkeyCount - structureCount };
}
```

호출부를 바꾼다. **난수를 뽑는 순서가 결과를 정하므로 대형·behavior 보다 먼저 뽑는다.**

```ts
  const { structureCount, laneCount } = splitBetweenStructuresAndLanes(
    monkeyCount,
    structureSlotCount,
    roundNumber,
    random
  );
```

이 줄이 `const random = seedFor(roundNumber);` 바로 다음, `formation` 선택보다 앞에
와야 한다.

- [ ] **Step 5: targetManager 가 개체 배율을 적용하게 한다**

구조물 루프에서:

```ts
        scale: params.monkeyScale * composition.monkeys[i].sizeScale,
        speed: params.monkeySpeed * composition.monkeys[i].speedScale,
```

그리고 `sway.frequency` 도 그 개체 속도를 따라야 한다 — 안 그러면 빠른 개체가
빠르게 걷되 순찰 주기는 그대로라 발이 미끄러진다.

```ts
        sway: {
          amplitude: slot.sway.amplitude,
          frequency: slot.sway.frequencyPerSpeed * params.monkeySpeed * composition.monkeys[i].speedScale,
          phase: slot.sway.phase,
        },
```

레인 루프에서 `plan` 을 뽑아 두고 같은 식으로 쓴다.

```ts
      const plan = composition.monkeys[structureCount + i];
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y - MONKEY_DROP, z: slot.z },
        scale: params.monkeyScale * plan.sizeScale,
        speed: params.monkeySpeed * plan.speedScale,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: {
          amplitude: slot.swayAmplitude,
          frequency: slot.swayFrequency * plan.speedScale,
          phase: slot.swayPhase,
        },
        hp: params.monkeyHp,
        behavior: plan.behavior,
      });
```

- [ ] **Step 6: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS
Run: `npm run build` → 성공

**`computeLaneLayout` 호출은 건드리지 말 것.** 거기에는 `params.monkeyScale` 을 그대로
넘긴다 — 슬롯 좌표는 판 전체가 공유하는 격자라, 개체마다 다른 `sizeScale` 을 먹이면
같은 격자 위에서 원숭이마다 다른 자리가 나와 겹침·섬 밖 검사가 무의미해진다.
`sizeScale` 은 원숭이 모델 크기에만 쓴다.

- [ ] **Step 7: 커밋한다**

```bash
git add -A
git commit -m "feat: vary monkeys within a round and how much they use the structures" -m "Every monkey in a round was the same size and speed, so there was never a reason to shoot one before another. From round six they come in three variants; the fast one is smaller and the slow one bigger, so size reads as difficulty and the player can pick a target order.

Hit points are deliberately left alone. Per-monkey health tangles with scoring, settlement and the last-kill effect, and that is a separate problem.

From round fifteen the split between structures and lanes varies too. Filling every slot every time meant each round unravelled in the same order, structures first."
```

---

### Task 6: 사용자 육안 확인 요청

**Files:** 없음

- [ ] **Step 1: 개발 서버가 도는지 본다**

이미 떠 있으면 다시 띄우지 말 것. `http://localhost:5173/` 다.
**서브에이전트는 브라우저를 열지 말 것.**

- [ ] **Step 2: 사용자에게 확인을 요청한다**

골드는 테스트가 지키지만 나머지는 육안이 유일한 증거다. 라운드를 건너뛰려면
콘솔에서 `localStorage.setItem('shootshoot.progress','20'); location.reload()` 를 쓴다.

1. 1·2·3라운드가 예전과 똑같이 보이나. 튜토리얼이 정상으로 도나
2. 4라운드부터 대형이 눈에 띄게 바뀌나. `wide` 에서 원숭이가 섬 밖으로 안 나가나
3. 6라운드부터 크기·속도가 다른 개체가 섞여 보이나. 크기 차이가 알아볼 만한가
   (`VARIANTS` 의 0.85/1.15)
4. 10라운드 `dash` 가 너무 어렵지 않나. 15라운드 `bob` 의 세로 폭이 과하지 않나
   (`BOB_AMPLITUDE = 0.5`)
5. 같은 라운드를 다시 들어가면 배치가 똑같나
6. 라운드 클리어 골드가 배율만큼 늘어나 보이나
7. 타워·통로 위 원숭이가 여전히 제자리에 서 있나 (진폭 0 분기)

- [ ] **Step 3: 문제가 있으면 고친다**

거의 전부 상수 한 줄이다. 위 목록 괄호 안에 어느 값인지 적어 뒀다.

- [ ] **Step 4: 뒤집힌 결정을 인수인계 문서에 정정으로 남긴다**

`docs/superpowers/specs/2026-07-31-session-handoff.md` 의 확정 결정 목록에
**"순찰 궤적(진폭·주기 공식)은 안 바꾼다 — 난이도 균형이 거기 맞춰져 있다"** 가 있다.
이 작업이 그걸 폐기했다.

**그 문장을 지우지 말 것.** 아래를 그 줄 밑에 덧붙인다. 조용히 고치면 왜 뒤집혔는지가
안 남고 같은 논쟁이 반복된다.

```markdown
  - **2026-08-02 정정: 폐기됨.** 라운드가 올라가도 판이 똑같다는 지적에서 사용자가
    난이도를 다채로움으로 올리기로 정했다. `patrolMotion` 이 곡선 넷을 갖고,
    `steady` 만 이 문장이 지키던 예전 곡선이다.
    [설계](2026-08-02-round-progression-design.md) 참고.
```

같은 파일 `2026-08-01-session-handoff.md` 에도 같은 문장이 있으면 같이 정정한다.
Grep 툴로 `순찰 궤적` 을 `docs/superpowers/specs` 에서 찾아 전부 처리할 것.

```bash
git add -A
git commit -m "docs: record that the fixed-patrol-curve decision was reversed"
```

---

## 이 계획이 손대지 않는 것

- 개체별 체력, 점수 공식, `maxMonkeyCount: 10`
- 지는 조건 (여전히 없다)
- 장전 시간, 무기 데미지, 업그레이드 곡선
- 구조물의 물리·붕괴, 슬롯 좌표
- UI 문자열 (영어로 이미 바뀌었다)
