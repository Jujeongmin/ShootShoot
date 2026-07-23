# 무기 실제 구매 + 원숭이 HP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무기 상점에서 골드로 총 3종을 구매·장착할 수 있게 하고, 원숭이에게 라운드마다 오르는 HP를 도입해 무기 데미지가 실제로 의미를 갖게 만든다.

**Architecture:** 게임플레이 쪽은 `monkey.js`가 HP를 갖고 `damage(amount, part)`가 처치 여부를 반환하며, `game.js`가 장착 무기의 데미지를 적용한 뒤 "죽은 원숭이만 담은 결과"를 기존 점수 계산기에 넘긴다(점수 공식 자체는 그대로). 무기 쪽은 `CONFIG.weapons`가 유일한 정의 소스이고, `weaponStore`가 보유·장착 상태를 localStorage에 저장하며, `weaponViewmodel`이 config를 받아 GLB/FBX 어느 쪽이든 1인칭 모델을 로드하고 `dispose()`로 교체를 지원한다. 상점 UI는 한 자루씩 보여주는 캐러셀이다.

**Tech Stack:** Vanilla JS (ES modules), three.js 0.166, Vite 5, Vitest 1.6

## Global Constraints

- 설계 문서: [docs/superpowers/specs/2026-07-23-weapon-purchase-design.md](../specs/2026-07-23-weapon-purchase-design.md) — 충돌 시 이 스펙이 우선한다.
- 원숭이 HP 공식: `1 + floor((round - 1) / 2)`, **상한 없음**.
- 헤드샷 데미지 배수: 2. 헤드샷 점수 보너스 `CONFIG.score.headshotBonus`(150)는 현행 유지.
- 무기 4종과 값: 기본 소총(데미지 1, 가격 0) / 돌격소총(2, 500) / 저격소총(3, 2000) / 레이건(5, 6000).
- 점수는 **처치했을 때만** 지급. 명중했지만 못 죽인 경우 스트릭 유지, 미스 아님.
- 관통은 무제한, 데미지 감쇠 없음.
- 구매는 확인 단계 없이 한 번 누르면 즉시 체결.
- `monkey.isDying()` / `targetManager.hasDyingMonkeys()` / `hasAliveMonkeys()`의 의미("사망 연출 중")를 바꾸지 말 것 — `lastKillEffect`와 타워 붕괴 추락사 중복 방지가 여기에 의존한다.
- UI 문구는 모두 한국어.
- 테스트 실행은 항상 저장소 루트에서 `npm test` (vitest). 테스트 파일은 루트 `test/` 아래, 소스는 `game/src/` 아래.
- 스펙의 `CONFIG.round.monkeyHpIncreasePerRounds`는 의미가 헷갈려 이 계획에서 **`roundsPerMonkeyHpIncrease`**로 이름만 바꿔 쓴다(값·동작 동일).

---

### Task 1: 무기 FBX 에셋을 git에 추가하고 실측

새 FBX 파일들은 메인 작업 디렉터리에만 있고 커밋되지 않아 이 워크트리에 존재하지 않는다. 먼저 필요한 3개를 가져오고, 1인칭 배치에 쓸 스케일을 실측한다.

**Files:**
- Create: `game/public/models/Rifle.fbx` (복사)
- Create: `game/public/models/Sniper rifle.fbx` (복사)
- Create: `game/public/models/Ray Gun.fbx` (복사)
- Create: `tools/measure-weapons.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 각 무기의 권장 `scale` 값(Task 2의 `CONFIG.weapons`에 그대로 들어감)

- [ ] **Step 1: FBX 3종을 워크트리로 복사**

```bash
cp "C:/Users/anjsh/OneDrive/Desktop/ShootShoot/game/public/models/Rifle.fbx" \
   "C:/Users/anjsh/OneDrive/Desktop/ShootShoot/game/public/models/Sniper rifle.fbx" \
   "C:/Users/anjsh/OneDrive/Desktop/ShootShoot/game/public/models/Ray Gun.fbx" \
   game/public/models/
```

- [ ] **Step 2: 복사 확인**

```bash
ls -la game/public/models/
```

기대: `Ray Gun.fbx`, `Rifle.fbx`, `Sniper rifle.fbx`가 `crate.glb`, `rifle.glb`, `sack-trench.glb`와 함께 보인다. 셋 중 하나라도 없으면 중단하고 보고할 것.

- [ ] **Step 3: 실측 스크립트 작성**

`tools/measure-weapons.mjs`:

```js
// 각 무기 모델의 바운딩박스를 재고, 현재 rifle.glb가 화면에서 차지하는 크기와
// 같아지도록 하는 scale 값을 계산해 출력한다.
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const REFERENCE_SCALE = 0.08; // rifleViewmodel.js가 rifle.glb에 쓰던 값

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadModel(path) {
  const raw = fs.readFileSync(path);
  if (path.endsWith('.glb')) {
    const gltf = await new GLTFLoader().parseAsync(toArrayBuffer(raw), '');
    return gltf.scene;
  }
  const loader = new FBXLoader();
  const isBinary = raw.subarray(0, 18).toString('binary').startsWith('Kaydara FBX Binary');
  return loader.parse(isBinary ? toArrayBuffer(raw) : raw.toString('utf8'), '');
}

function measure(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { size, center, longest: Math.max(size.x, size.y, size.z) };
}

const reference = measure(await loadModel('game/public/models/rifle.glb'));
const targetLength = reference.longest * REFERENCE_SCALE;
console.log(`기준 rifle.glb: 최대변 ${reference.longest.toFixed(4)} × ${REFERENCE_SCALE} = 화면상 ${targetLength.toFixed(4)}`);

for (const file of ['Rifle.fbx', 'Sniper rifle.fbx', 'Ray Gun.fbx']) {
  const { size, center, longest } = measure(await loadModel(`game/public/models/${file}`));
  console.log(
    `${file}\n` +
    `  크기 x=${size.x.toFixed(2)} y=${size.y.toFixed(2)} z=${size.z.toFixed(2)} (최대변 ${longest.toFixed(2)})\n` +
    `  중심 x=${center.x.toFixed(2)} y=${center.y.toFixed(2)} z=${center.z.toFixed(2)}\n` +
    `  권장 scale = ${(targetLength / longest).toFixed(5)}`
  );
}
```

- [ ] **Step 4: 실측 실행**

```bash
node tools/measure-weapons.mjs
```

기대: 4개 모델 모두 크기·중심·권장 scale이 출력된다. **출력값을 그대로 메모해 둘 것 — Task 2에서 `CONFIG.weapons`에 넣는다.** 어느 모델이든 로드에 실패하면 여기서 멈추고 에러 메시지와 함께 보고할 것(파일 손상 가능성).

- [ ] **Step 5: 커밋**

```bash
git add game/public/models/ tools/measure-weapons.mjs
git commit -m "chore: add weapon FBX assets and measurement script"
```

---

### Task 2: `CONFIG.weapons`와 `weaponStore`

무기 정의와 보유·장착 상태 저장을 만든다.

**Files:**
- Modify: `game/src/config.js`
- Create: `game/src/gameplay/weaponStore.js`
- Test: `test/weaponStore.test.js`

**Interfaces:**
- Consumes: Task 1이 출력한 권장 `scale` 값
- Produces:
  - `CONFIG.weapons`: `Array<{ id, name, model, format, damage, price, image, scale, position: {x,y,z}, rotation: {x,y,z} }>`
  - `CONFIG.weaponStorageKey: string`
  - `createWeaponStore(storage, key) -> { getEquipped(): string, getOwned(): string[], isOwned(id): boolean, markOwned(id): void, equip(id): boolean }`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/weaponStore.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createWeaponStore } from '../game/src/gameplay/weaponStore.js';

function createMemoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createWeaponStore', () => {
  it('defaults to owning and equipping only the basic weapon', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    expect(store.getEquipped()).toBe('basic');
    expect(store.getOwned()).toEqual(['basic']);
    expect(store.isOwned('basic')).toBe(true);
    expect(store.isOwned('sniper')).toBe(false);
  });

  it('markOwned() accumulates weapons without changing what is equipped', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    store.markOwned('assault');
    store.markOwned('sniper');
    expect(store.getOwned()).toEqual(['basic', 'assault', 'sniper']);
    expect(store.getEquipped()).toBe('basic');
  });

  it('markOwned() is idempotent', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    store.markOwned('assault');
    store.markOwned('assault');
    expect(store.getOwned()).toEqual(['basic', 'assault']);
  });

  it('equip() succeeds only for owned weapons', () => {
    const store = createWeaponStore(createMemoryStorage(), 'test.weapons');
    expect(store.equip('sniper')).toBe(false);
    expect(store.getEquipped()).toBe('basic');

    store.markOwned('sniper');
    expect(store.equip('sniper')).toBe(true);
    expect(store.getEquipped()).toBe('sniper');
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createWeaponStore(storage, 'test.weapons');
    first.markOwned('raygun');
    first.equip('raygun');

    const second = createWeaponStore(storage, 'test.weapons');
    expect(second.getOwned()).toEqual(['basic', 'raygun']);
    expect(second.getEquipped()).toBe('raygun');
  });

  it('recovers from malformed stored JSON', () => {
    const store = createWeaponStore(createMemoryStorage({ 'test.weapons': '{not json' }), 'test.weapons');
    expect(store.getOwned()).toEqual(['basic']);
    expect(store.getEquipped()).toBe('basic');
  });

  it('recovers when the stored equipped weapon is not owned', () => {
    const stored = JSON.stringify({ owned: ['basic'], equipped: 'raygun' });
    const store = createWeaponStore(createMemoryStorage({ 'test.weapons': stored }), 'test.weapons');
    expect(store.getEquipped()).toBe('basic');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- weaponStore
```

기대: FAIL — `Failed to resolve import "../game/src/gameplay/weaponStore.js"`

- [ ] **Step 3: `weaponStore.js` 구현**

`game/src/gameplay/weaponStore.js`:

```js
const DEFAULT_WEAPON_ID = 'basic';

function readState(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };
  }

  const owned = Array.isArray(parsed?.owned) ? parsed.owned.filter((id) => typeof id === 'string') : [];
  if (!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);

  const equipped = owned.includes(parsed?.equipped) ? parsed.equipped : DEFAULT_WEAPON_ID;
  return { owned, equipped };
}

export function createWeaponStore(storage, key) {
  function write(state) {
    storage.setItem(key, JSON.stringify(state));
  }

  return {
    getOwned() {
      return readState(storage, key).owned;
    },
    getEquipped() {
      return readState(storage, key).equipped;
    },
    isOwned(id) {
      return readState(storage, key).owned.includes(id);
    },
    markOwned(id) {
      const state = readState(storage, key);
      if (state.owned.includes(id)) return;
      state.owned.push(id);
      write(state);
    },
    equip(id) {
      const state = readState(storage, key);
      if (!state.owned.includes(id)) return false;
      state.equipped = id;
      write(state);
      return true;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- weaponStore
```

기대: PASS (7 tests)

- [ ] **Step 5: `CONFIG`에 무기 정의 추가**

`game/src/config.js`의 `aim` 블록 뒤, 저장 키들 앞에 다음을 넣는다. `scale`은 **Task 1에서 출력된 권장값**으로 바꿔 넣을 것(아래 `0.0000` 자리). `position`/`rotation`은 네 무기 모두 아래 값에서 시작하고 Task 8·12에서 눈으로 보며 조정한다.

```js
  weaponDamage: {
    headshotMultiplier: 2,
  },
  weapons: [
    {
      id: 'basic', name: '기본 소총', model: '/models/rifle.glb', format: 'glb',
      damage: 1, price: 0, image: '/images/weapons/basic.png',
      scale: 0.08, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'assault', name: '돌격소총', model: '/models/Rifle.fbx', format: 'fbx',
      damage: 2, price: 500, image: '/images/weapons/assault.png',
      scale: 0.0000, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'sniper', name: '저격소총', model: '/models/Sniper rifle.fbx', format: 'fbx',
      damage: 3, price: 2000, image: '/images/weapons/sniper.png',
      scale: 0.0000, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'raygun', name: '레이건', model: '/models/Ray Gun.fbx', format: 'fbx',
      damage: 5, price: 6000, image: '/images/weapons/raygun.png',
      scale: 0.0000, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  ],
```

같은 파일의 저장 키 목록에 한 줄 추가:

```js
  weaponStorageKey: 'shootshoot.weapons',
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npm test
```

기대: 기존 43개 + 신규 7개 = 50 passed

- [ ] **Step 7: 커밋**

```bash
git add game/src/config.js game/src/gameplay/weaponStore.js test/weaponStore.test.js
git commit -m "feat: add weapon definitions and ownership store"
```

---

### Task 3: `currencyStore.spend()`

구매에 필요한 골드 차감을 추가한다.

**Files:**
- Modify: `game/src/gameplay/currencyStore.js`
- Test: `test/currencyStore.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `currencyStore.spend(amount) -> boolean` (잔액 부족이면 아무 변화 없이 `false`)

- [ ] **Step 1: 실패하는 테스트 추가**

`test/currencyStore.test.js`의 `describe` 블록 안, 마지막 `it` 뒤에 추가:

```js
  it('spend() deducts and returns true when the balance is sufficient', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(500);
    expect(store.spend(200)).toBe(true);
    expect(store.get()).toBe(300);
  });

  it('spend() allows spending the exact balance', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(500);
    expect(store.spend(500)).toBe(true);
    expect(store.get()).toBe(0);
  });

  it('spend() returns false and changes nothing when the balance is short', () => {
    const store = createCurrencyStore(createMemoryStorage(), 'test.gold');
    store.earn(100);
    expect(store.spend(101)).toBe(false);
    expect(store.get()).toBe(100);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- currencyStore
```

기대: FAIL — `store.spend is not a function`

- [ ] **Step 3: `spend()` 구현**

`game/src/gameplay/currencyStore.js`의 `earn` 뒤에 추가:

```js
    spend(amount) {
      const current = this.get();
      if (amount > current) return false;
      storage.setItem(key, String(current - amount));
      return true;
    },
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- currencyStore
```

기대: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add game/src/gameplay/currencyStore.js test/currencyStore.test.js
git commit -m "feat: add spend() to currency store"
```

---

### Task 4: 라운드별 원숭이 HP

**Files:**
- Modify: `game/src/config.js`
- Modify: `game/src/gameplay/difficulty.js`
- Test: `test/difficulty.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `getRoundParams(roundNumber, config)`가 기존 필드에 더해 `monkeyHp: number`를 반환

- [ ] **Step 1: 실패하는 테스트 추가**

`test/difficulty.test.js`의 `describe` 블록 안 마지막에 추가:

```js
  it('starts monkeys at 1 HP and adds 1 HP every 2 rounds', () => {
    expect(getRoundParams(1, CONFIG).monkeyHp).toBe(1);
    expect(getRoundParams(2, CONFIG).monkeyHp).toBe(1);
    expect(getRoundParams(3, CONFIG).monkeyHp).toBe(2);
    expect(getRoundParams(4, CONFIG).monkeyHp).toBe(2);
    expect(getRoundParams(9, CONFIG).monkeyHp).toBe(5);
  });

  it('keeps raising monkey HP without any cap', () => {
    expect(getRoundParams(21, CONFIG).monkeyHp).toBe(11);
    expect(getRoundParams(101, CONFIG).monkeyHp).toBe(51);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- difficulty
```

기대: FAIL — `expected undefined to be 1`

- [ ] **Step 3: 설정과 계산 추가**

`game/src/config.js`의 `round` 블록 안(`minMonkeyScale` 뒤)에 추가:

```js
    baseMonkeyHp: 1,
    roundsPerMonkeyHpIncrease: 2,
```

`game/src/gameplay/difficulty.js`를 다음으로 교체:

```js
export function getRoundParams(roundNumber, config) {
  const c = config.round;
  const n = roundNumber - 1;
  const monkeyCount = Math.min(c.baseMonkeyCount + n * c.monkeyCountIncreasePerRound, c.maxMonkeyCount);
  const timeLimit = Math.max(c.baseTimeLimit - n * c.timeLimitDecreasePerRound, c.minTimeLimit);
  const monkeySpeed = c.baseMonkeySpeed + n * c.monkeySpeedIncreasePerRound;
  const monkeyScale = Math.max(c.baseMonkeyScale - n * c.monkeyScaleDecreasePerRound, c.minMonkeyScale);
  const monkeyHp = c.baseMonkeyHp + Math.floor(n / c.roundsPerMonkeyHpIncrease);
  return { roundNumber, monkeyCount, timeLimit, monkeySpeed, monkeyScale, monkeyHp };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- difficulty
```

기대: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add game/src/config.js game/src/gameplay/difficulty.js test/difficulty.test.js
git commit -m "feat: scale monkey HP with round number"
```

---

### Task 5: 데미지·처치 판정 순수 함수

`game.js`가 쓸 계산을 테스트 가능한 순수 함수로 먼저 만든다.

**Files:**
- Modify: `game/src/gameplay/shooting.js`
- Test: `test/shooting.test.js`

**Interfaces:**
- Consumes: `CONFIG.weaponDamage.headshotMultiplier` (Task 2)
- Produces:
  - `computeHitDamage(part, weaponDamage, config) -> number`
  - `resolveKillOutcome(shotOutcome, killedHits) -> { isMiss, penetrationCount, hits }` — 기존 `calculateShotScore`/`applyShot`가 그대로 받을 수 있는 형태다. 죽인 원숭이만 담기므로 점수 계산의 기준이 "관통 마릿수"에서 "처치 마릿수"로 바뀐다. **`scoring.js`는 수정하지 않는다.**

- [ ] **Step 1: 실패하는 테스트 추가**

`test/shooting.test.js`의 맨 위 import를 다음으로 교체:

```js
import { describe, it, expect } from 'vitest';
import { resolveShot, computeHitDamage, resolveKillOutcome } from '../game/src/gameplay/shooting.js';
import { CONFIG } from '../game/src/config.js';
```

파일 맨 아래에 추가:

```js
describe('computeHitDamage', () => {
  it('deals the weapon damage on a body shot', () => {
    expect(computeHitDamage('body', 3, CONFIG)).toBe(3);
  });

  it('doubles the weapon damage on a head shot', () => {
    expect(computeHitDamage('head', 3, CONFIG)).toBe(6);
  });
});

describe('resolveKillOutcome', () => {
  it('stays a miss when the shot missed', () => {
    const outcome = resolveKillOutcome({ isMiss: true, penetrationCount: 0, hits: [] }, []);
    expect(outcome).toEqual({ isMiss: true, penetrationCount: 0, hits: [] });
  });

  it('is not a miss but scores nothing when a hit killed nobody', () => {
    const shot = resolveShot([{ monkeyId: 'a', part: 'body' }]);
    const outcome = resolveKillOutcome(shot, []);
    expect(outcome.isMiss).toBe(false);
    expect(outcome.penetrationCount).toBe(0);
    expect(outcome.hits).toEqual([]);
  });

  it('counts only the monkeys that died, not everyone hit', () => {
    const shot = resolveShot([
      { monkeyId: 'a', part: 'body' },
      { monkeyId: 'b', part: 'head' },
      { monkeyId: 'c', part: 'body' },
    ]);
    const killed = shot.hits.filter((hit) => hit.monkeyId !== 'b');
    const outcome = resolveKillOutcome(shot, killed);
    expect(outcome.penetrationCount).toBe(2);
    expect(outcome.hits.map((h) => h.monkeyId)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- shooting
```

기대: FAIL — `computeHitDamage is not a function`

- [ ] **Step 3: 구현 추가**

`game/src/gameplay/shooting.js` 맨 아래에 추가:

```js
export function computeHitDamage(part, weaponDamage, config) {
  return part === 'head' ? weaponDamage * config.weaponDamage.headshotMultiplier : weaponDamage;
}

export function resolveKillOutcome(shotOutcome, killedHits) {
  if (shotOutcome.isMiss) {
    return { isMiss: true, penetrationCount: 0, hits: [] };
  }
  return { isMiss: false, penetrationCount: killedHits.length, hits: killedHits };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- shooting
```

기대: PASS (8 tests)

- [ ] **Step 5: 점수 의미가 유지되는지 확인하는 테스트 추가**

`test/scoring.test.js`의 `describe('calculateShotScore', ...)` 블록(현재 파일 10–45행) 안 마지막 `it` 뒤에 추가한다. `calculateShotScore`·`applyShot`·`CONFIG`는 이미 이 파일에 import되어 있으므로 import는 건드리지 않는다.

```js
  it('scores nothing for a hit that killed nobody, and keeps the streak alive', () => {
    const outcome = { isMiss: false, penetrationCount: 0, hits: [] };
    expect(calculateShotScore(outcome, 3, CONFIG)).toBe(0);

    const next = applyShot({ score: 500, streak: 3, misses: 1 }, outcome, CONFIG);
    expect(next.score).toBe(500);
    expect(next.streak).toBe(4);
    expect(next.misses).toBe(1);
  });
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npm test
```

기대: 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add game/src/gameplay/shooting.js test/shooting.test.js test/scoring.test.js
git commit -m "feat: add hit damage and kill outcome resolution"
```

---

### Task 6: 원숭이 HP·피격 연출·HP바

**Files:**
- Modify: `game/src/gameplay/monkey.js`
- Modify: `game/src/gameplay/targetManager.js:16-53`

**Interfaces:**
- Consumes: `getRoundParams(...).monkeyHp` (Task 4)
- Produces:
  - `createMonkey({ id, position, scale, speed, template, clip, sway, hp })` — `hp` 기본값 1
  - `monkey.damage(amount, part) -> boolean` (처치했으면 `true`) — 기존 `hit(part)`를 **대체**한다
  - `monkey.kill() -> boolean` — HP를 무시하고 즉시 사망 연출(타워 붕괴 추락사용)

- [ ] **Step 1: `monkey.js` 상단 상수 추가**

`HEAD_CUTOFF_LOCAL_Y` 선언 뒤에 추가:

```js
const FLASH_DURATION = 0.15;
const FLASH_COLOR = 0xff3333;
const FLINCH_DISTANCE = 0.08;
const HP_BAR_CANVAS_WIDTH = 64;
const HP_BAR_CANVAS_HEIGHT = 10;
const HP_BAR_LOCAL_Y = 2.1;
const HP_BAR_SPRITE_SIZE = { x: 0.9, y: 0.14 };
```

- [ ] **Step 2: HP바 스프라이트 생성 함수 추가**

`createMonkey` 함수 **바깥**, `export function createMonkey` 바로 위에 추가:

```js
function createHpBar() {
  const canvas = document.createElement('canvas');
  canvas.width = HP_BAR_CANVAS_WIDTH;
  canvas.height = HP_BAR_CANVAS_HEIGHT;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, HP_BAR_LOCAL_Y, 0);
  sprite.scale.set(HP_BAR_SPRITE_SIZE.x, HP_BAR_SPRITE_SIZE.y, 1);
  sprite.visible = false;
  sprite.renderOrder = 999;

  function draw(current, max) {
    const ratio = Math.max(0, current) / max;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0,0,0,0.65)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ratio > 0.5 ? '#5ec85e' : ratio > 0.25 ? '#f0a500' : '#dd3333';
    context.fillRect(1, 1, Math.round((canvas.width - 2) * ratio), canvas.height - 2);
    texture.needsUpdate = true;
  }

  return { sprite, draw, dispose: () => { texture.dispose(); material.dispose(); } };
}
```

- [ ] **Step 3: `createMonkey`에 HP 상태와 연출 배선**

`createMonkey`의 시그니처에 `hp = 1`을 추가:

```js
export function createMonkey({ id, position, scale = 1, speed = 0.5, template, clip, sway = {}, hp = 1 }) {
```

`const materials = [];` 선언 뒤(머티리얼 수집 traverse 아래)에 원래 색을 기억해 둔다:

```js
  const baseColors = materials.map((material) => (material.color ? material.color.clone() : null));

  const hpBar = createHpBar();
  group.add(hpBar.sprite);
```

`state` 객체에 필드 추가(`dead: false,` 옆):

```js
    hp,
    maxHp: hp,
    isFlashing: false,
    flashElapsed: 0,
```

- [ ] **Step 4: 플래시·플린치 갱신 함수 추가**

`updateHit` 함수 바로 뒤에 추가:

```js
  function setFlashColor(active) {
    materials.forEach((material, index) => {
      if (!material.color) return;
      if (active) {
        material.color.setHex(FLASH_COLOR);
      } else if (baseColors[index]) {
        material.color.copy(baseColors[index]);
      }
    });
  }

  function updateFlash(dt) {
    state.flashElapsed += dt;
    const t = Math.min(state.flashElapsed / FLASH_DURATION, 1);
    group.position.z = position.z - (1 - t) * FLINCH_DISTANCE;
    if (t >= 1) {
      state.isFlashing = false;
      group.position.z = position.z;
      setFlashColor(false);
    }
  }

  function startDeath(part) {
    state.hp = 0;
    hpBar.sprite.visible = false;
    state.isFlashing = false;
    setFlashColor(false);
    group.position.z = position.z;
    state.phase = 'hit';
    state.hitElapsed = 0;
    state.lastHitPart = part;
  }
```

- [ ] **Step 5: `update`에서 플래시를 돌리고, `hit`을 `damage`/`kill`로 교체**

`update(dt)`의 `else` 분기를 다음으로 바꾼다:

```js
    update(dt) {
      mixer.update(dt);
      if (state.phase === 'hit') {
        updateHit(dt);
      } else {
        updateIdle(dt);
        if (state.isFlashing) {
          updateFlash(dt);
        }
      }
    },
```

`hit(part) { ... }` 메서드 전체를 다음으로 **교체**한다:

```js
    damage(amount, part) {
      if (state.phase === 'hit') return false;
      state.hp -= amount;
      if (state.hp <= 0) {
        startDeath(part);
        return true;
      }
      hpBar.draw(state.hp, state.maxHp);
      hpBar.sprite.visible = true;
      state.isFlashing = true;
      state.flashElapsed = 0;
      setFlashColor(true);
      return false;
    },
    kill() {
      if (state.phase === 'hit') return false;
      startDeath('body');
      return true;
    },
```

`updateHit`의 페이드 루프가 머티리얼 `opacity`만 만지므로 플래시 색 복원과 충돌하지 않는다.

`return` 객체 마지막에 정리 함수를 추가:

```js
    dispose() {
      hpBar.dispose();
    },
```

- [ ] **Step 6: `targetManager`가 HP를 넘기고, 제거 시 정리하도록 수정**

`game/src/gameplay/targetManager.js`의 `spawnRound` 안 두 개의 `createMonkey({...})` 호출 각각에 `hp: params.monkeyHp,`를 추가한다(타워 슬롯 루프와 레인 루프 둘 다).

`clear()`와 `update()`에서 원숭이를 씬에서 뺄 때 `dispose()`도 부르도록 바꾼다:

```js
  function clear() {
    for (const monkey of monkeys) {
      scene.remove(monkey.group);
      monkey.dispose();
    }
    monkeys = [];
    towerMonkeyIds = new Map();
  }
```

```js
    monkeys = monkeys.filter((monkey) => {
      if (monkey.isDead()) {
        scene.remove(monkey.group);
        monkey.dispose();
        return false;
      }
      return true;
    });
```

- [ ] **Step 7: 빌드가 깨지지 않는지 확인**

```bash
npm test && npm run build
```

기대: 테스트 전부 PASS, 빌드 성공. **이 시점에는 `game.js`가 아직 `monkey.hit()`을 부르고 있어 게임은 동작하지 않는다 — Task 7에서 이어서 고친다.** 브라우저 확인은 하지 말 것.

- [ ] **Step 8: 커밋**

```bash
git add game/src/gameplay/monkey.js game/src/gameplay/targetManager.js
git commit -m "feat: give monkeys HP with damage flash and HP bar"
```

---

### Task 7: `game.js`에 데미지 적용 연결

여기까지 하면 HP 시스템이 게임에서 실제로 돌아간다(무기는 아직 기본 소총 하나).

**Files:**
- Modify: `game/src/gameplay/game.js:174-262`

**Interfaces:**
- Consumes: `computeHitDamage`, `resolveKillOutcome` (Task 5), `monkey.damage`/`monkey.kill` (Task 6), `CONFIG.weapons` (Task 2)
- Produces: 없음(내부 연결)

- [ ] **Step 1: import 수정**

`game/src/gameplay/game.js:6`을 다음으로 교체:

```js
import { resolveShot, computeHitDamage, resolveKillOutcome } from './shooting.js';
```

- [ ] **Step 2: 현재 무기 데미지를 읽는 헬퍼 추가**

`createGame` 안, `let settingsOrigin = null;` 뒤에 추가:

```js
  const weaponStore = createWeaponStore(window.localStorage, CONFIG.weaponStorageKey);

  function getEquippedWeapon() {
    const id = weaponStore.getEquipped();
    return CONFIG.weapons.find((weapon) => weapon.id === id) ?? CONFIG.weapons[0];
  }
```

그리고 파일 상단 import 목록에 추가:

```js
import { createWeaponStore } from './weaponStore.js';
```

- [ ] **Step 3: `handleShot`의 데미지·점수 처리 교체**

`game.js:205-220`의 다음 블록을

```js
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
```

다음으로 교체한다:

```js
    const outcome = resolveShot(hits);
    const weaponDamage = getEquippedWeapon().damage;

    let popupWorldPosition = null;
    const killedHits = [];
    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (!monkey) continue;
      const worldPos = monkey.getWorldPosition();
      if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
      effects.spawnHitBurst(worldPos);
      if (monkey.damage(computeHitDamage(hit.part, weaponDamage, CONFIG), hit.part)) {
        killedHits.push(hit);
      }
    }

    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
    const effectiveOutcome = isPureTowerHit
      ? { isMiss: false, penetrationCount: 0, hits: [] }
      : resolveKillOutcome(outcome, killedHits);
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);
```

- [ ] **Step 4: 타워 추락사를 `kill()`로 교체**

`game.js`의 타워 붕괴 블록에서 `towerMonkey.hit('body');`를 다음으로 바꾼다:

```js
        towerMonkey.kill();
```

추락사는 HP와 무관하게 즉사여야 하므로 `damage()`가 아니라 `kill()`을 쓴다.

- [ ] **Step 5: 효과음 분기가 빈 `hits`에서 터지지 않게 방어**

현재 `else if (effectiveOutcome.hits[0].part === 'head')`는 "맞았지만 아무도 안 죽은 경우" `hits`가 비어 있어 예외를 던진다. 효과음 블록 전체를 다음으로 교체:

```js
    if (hitTowerIndex !== null) {
      sfx.hit();
    } else if (effectiveOutcome.isMiss) {
      sfx.miss();
    } else if (effectiveOutcome.penetrationCount > 1) {
      sfx.combo();
    } else if (effectiveOutcome.hits[0]?.part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }
```

- [ ] **Step 6: 점수 팝업을 0점일 때 띄우지 않게 수정**

```js
    if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y);
    }
```

- [ ] **Step 7: 빌드·테스트 확인**

```bash
npm test && npm run build
```

기대: 모두 PASS, 빌드 성공.

- [ ] **Step 8: 브라우저에서 HP 동작 확인**

```bash
npm run dev
```

확인 항목:
1. 라운드 1–2에서는 원숭이가 한 발에 죽는다(기존과 동일).
2. 라운드 3 이상에서 몸통을 쏘면 원숭이가 붉게 번쩍이며 살짝 밀리고, 머리 위에 HP바가 나타난다.
3. 같은 원숭이를 다시 쏘면 HP바가 줄고, 0이 되면 기존 사망 연출이 나온다.
4. 라운드 3에서 머리를 쏘면 한 발에 죽는다(헤드샷 2배).
5. 안 죽인 명중에는 점수 팝업이 뜨지 않고, 미스 카운트도 오르지 않는다.
6. 타워 기둥을 맞히면 그 위 원숭이는 HP와 무관하게 즉사하고 +200이 뜬다.

- [ ] **Step 9: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: apply weapon damage to monkey HP on hit"
```

---

### Task 8: `weaponViewmodel` — 무기별 1인칭 모델 로드와 교체

**Files:**
- Create: `game/src/gameplay/weaponViewmodel.js`
- Delete: `game/src/gameplay/rifleViewmodel.js`
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `CONFIG.weapons` 항목 하나(`{ model, format, scale, position }`), `weaponStore.getEquipped()`
- Produces: `loadWeaponViewmodel(camera, weapon) -> Promise<{ setVisible(visible), triggerRecoil(), update(dt), dispose() }>`

- [ ] **Step 1: `weaponViewmodel.js` 작성**

`game/src/gameplay/weaponViewmodel.js`:

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const IDLE_SWAY_Y_AMPLITUDE = 0.01;
const IDLE_SWAY_X_AMPLITUDE = 0.005;
const RECOIL_DURATION = 0.15;
const RECOIL_KICK_DISTANCE = 0.08;
const RECOIL_KICK_ANGLE = 0.15;

function loadModel(weapon) {
  if (weapon.format === 'fbx') {
    return new FBXLoader().loadAsync(weapon.model);
  }
  return new GLTFLoader().loadAsync(weapon.model).then((gltf) => gltf.scene);
}

export function loadWeaponViewmodel(camera, weapon) {
  return loadModel(weapon).then((model) => {
    const basePosition = weapon.position;
    const baseRotation = weapon.rotation ?? { x: 0, y: 0, z: 0 };
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(weapon.scale);
    group.position.set(basePosition.x, basePosition.y, basePosition.z);
    group.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
    camera.add(group);

    let elapsed = 0;
    let recoilElapsed = 0;
    let isRecoiling = false;

    function updateIdleSway(dt) {
      elapsed += dt;
      group.position.y = basePosition.y + Math.sin(elapsed * 1.5) * IDLE_SWAY_Y_AMPLITUDE;
      group.position.x = basePosition.x + Math.sin(elapsed * 0.8) * IDLE_SWAY_X_AMPLITUDE;
    }

    function updateRecoil(dt) {
      recoilElapsed += dt;
      const t = Math.min(recoilElapsed / RECOIL_DURATION, 1);
      const kick = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      group.position.z = basePosition.z + kick * RECOIL_KICK_DISTANCE;
      group.rotation.x = baseRotation.x - kick * RECOIL_KICK_ANGLE;
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
      dispose() {
        camera.remove(group);
        group.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of mats) material.dispose();
        });
      },
    };
  });
}
```

- [ ] **Step 2: 옛 모듈 삭제**

```bash
git rm game/src/gameplay/rifleViewmodel.js
```

- [ ] **Step 3: `game.js`가 새 모듈을 쓰도록 수정**

`game.js:14`의 import를 교체:

```js
import { loadWeaponViewmodel } from './weaponViewmodel.js';
```

`let rifleViewmodel = null;`을 다음으로 교체:

```js
  let weaponViewmodel = null;
```

`rifleViewmodel`을 쓰는 나머지 세 곳을 모두 `weaponViewmodel`로 바꾼다:
- `handleShot` 안의 `rifleViewmodel.triggerRecoil();`
- 렌더 루프의 `if (rifleViewmodel) { rifleViewmodel.update(scaledDt); rifleViewmodel.setVisible(...); }`
- 부팅 `Promise.all`의 `loadRifleViewmodel(engine.camera)`와 그 결과 대입

부팅 `Promise.all` 블록을 다음으로 교체:

```js
    Promise.all([
      loadMonkeyModel(),
      loadWeaponViewmodel(engine.camera, getEquippedWeapon()),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedWeaponViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, resolvedObstacles.getTowerSlots());
      weaponViewmodel = resolvedWeaponViewmodel;
      obstacles = resolvedObstacles;
```

- [ ] **Step 4: 무기 교체 함수 추가**

`game.js`의 `closeShop` 함수 바로 앞에 추가:

```js
  function swapWeaponViewmodel(weapon) {
    return loadWeaponViewmodel(engine.camera, weapon).then((next) => {
      if (weaponViewmodel) weaponViewmodel.dispose();
      weaponViewmodel = next;
    });
  }
```

- [ ] **Step 5: 빌드·테스트 확인**

```bash
npm test && npm run build
```

기대: 모두 PASS, 빌드 성공. `rifleViewmodel` 참조가 남아 있으면 빌드가 실패하니 전부 바꿨는지 확인할 것.

- [ ] **Step 6: 브라우저에서 기본 소총이 그대로인지 확인**

```bash
npm run dev
```

기대: 1인칭 총 모양과 반동이 이전과 똑같다(모듈만 갈아끼운 것이므로 시각적 변화가 없어야 한다).

- [ ] **Step 7: FBX 무기가 실제로 로드되는지 임시 확인**

`CONFIG.weapons`에서 기본 무기 항목의 `id`는 그대로 두고, 브라우저 콘솔에서 다음을 실행해 장착 무기를 강제로 바꾼 뒤 새로고침한다:

```js
localStorage.setItem('shootshoot.weapons', JSON.stringify({ owned: ['basic','assault','sniper','raygun'], equipped: 'assault' }))
```

`assault` → `sniper` → `raygun` 순서로 각각 새로고침하며 확인하고, 총이 화면에 보이지 않거나 너무 크거나 작으면 **Task 2에서 넣은 `CONFIG.weapons`의 `scale`/`position`/`rotation`을 여기서 조정한다.** 조정 기준: 기본 소총과 비슷한 크기로 화면 오른쪽 아래에 총구가 화면 중앙을 향하도록. 축이 뒤집혀 보이면 해당 무기의 `rotation` 값을 (보통 `y: Math.PI` 또는 `y: Math.PI / 2`) 조정한다.

확인이 끝나면 localStorage를 원래대로 되돌린다:

```js
localStorage.removeItem('shootshoot.weapons')
```

- [ ] **Step 8: 커밋**

```bash
git add game/src/gameplay/weaponViewmodel.js game/src/gameplay/game.js game/src/config.js
git commit -m "feat: generalize viewmodel to load any weapon model"
```

---

### Task 9: 상점 카드용 무기 PNG 4장 생성

**Files:**
- Create: `game/tools/weapon-shots.html`
- Create: `game/public/images/weapons/basic.png`
- Create: `game/public/images/weapons/assault.png`
- Create: `game/public/images/weapons/sniper.png`
- Create: `game/public/images/weapons/raygun.png`

**Interfaces:**
- Consumes: `CONFIG.weapons`의 `model`/`format`/`image`
- Produces: `CONFIG.weapons[].image` 경로에 실제 PNG 파일

- [ ] **Step 1: 캡처용 페이지 작성**

`game/tools/weapon-shots.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>weapon shots</title>
<body style="margin:0;background:#222">
<div id="out" style="color:#fff;font:12px sans-serif;padding:8px">rendering...</div>
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
  import { CONFIG } from '/src/config.js';

  const SIZE = 512;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2, 3, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  function load(weapon) {
    if (weapon.format === 'fbx') return new FBXLoader().loadAsync(weapon.model);
    return new GLTFLoader().loadAsync(weapon.model).then((gltf) => gltf.scene);
  }

  const shots = {};
  for (const weapon of CONFIG.weapons) {
    const model = await load(weapon);
    const holder = new THREE.Group();
    holder.add(model);
    scene.add(holder);

    // 모델을 원점 중심으로 옮기고 카메라 프레임에 맞춘다
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    holder.position.sub(center);
    const radius = Math.max(size.x, size.y, size.z);
    camera.position.set(radius * 0.9, radius * 0.5, radius * 1.5);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    shots[weapon.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(holder);
  }

  window.__weaponShots = shots;
  document.getElementById('out').textContent = 'done: ' + Object.keys(shots).join(', ');
</script>
</body>
```

- [ ] **Step 2: dev 서버 실행**

```bash
npm run dev
```

- [ ] **Step 3: 페이지를 열고 dataURL 추출**

브라우저 도구로 `http://localhost:5173/tools/weapon-shots.html`을 연다. 화면에 `done: basic, assault, sniper, raygun`이 뜰 때까지 기다린 뒤, 페이지에서 자바스크립트로 `JSON.stringify(window.__weaponShots)`를 평가해 결과를 받는다.

브라우저 도구를 쓸 수 없는 환경이면 **여기서 멈추고 보고할 것** — 임시 이미지로 대체하지 말 것.

- [ ] **Step 4: dataURL을 PNG 파일로 저장**

추출한 JSON을 `scratch-weapon-shots.json`으로 저장한 뒤:

```bash
mkdir -p game/public/images/weapons
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('scratch-weapon-shots.json','utf8'));for(const [id,url] of Object.entries(s)){fs.writeFileSync('game/public/images/weapons/'+id+'.png',Buffer.from(url.split(',')[1],'base64'));console.log(id,'written')}"
rm scratch-weapon-shots.json
```

기대: `basic written` … `raygun written` 4줄.

- [ ] **Step 5: 결과 확인**

```bash
ls -la game/public/images/weapons/
```

기대: 4개 PNG가 있고 크기가 각각 수 KB 이상(0바이트면 캡처 실패 — Step 3부터 다시).

- [ ] **Step 6: 커밋**

```bash
git add game/tools/weapon-shots.html game/public/images/weapons/
git commit -m "chore: render weapon preview images for the shop"
```

---

### Task 10: 상점 캐러셀 UI

**Files:**
- Modify: `game/src/ui/shopPanel.js` (전체 재작성)

**Interfaces:**
- Consumes: 없음(순수 DOM 모듈)
- Produces:
  - `createShopPanel(container) -> { show(state, handlers), hide() }`
  - `state = { gold: number, weapons: Array<{ id, name, image, damage, price, owned, equipped }> }`
  - `handlers = { onBuy(id), onEquip(id), onClose() }`

- [ ] **Step 1: `shopPanel.js` 전체 교체**

```js
const MAX_DAMAGE_PIPS = 5;

export function createShopPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  let index = 0;
  let current = null;

  function damagePips(damage) {
    const filled = Math.min(damage, MAX_DAMAGE_PIPS);
    return `<span style="color:#f0a500;letter-spacing:2px">${'●'.repeat(filled)}<span style="color:#555">${'●'.repeat(MAX_DAMAGE_PIPS - filled)}</span></span>`;
  }

  function actionButton(weapon, gold, handlers) {
    const btn = document.createElement('button');
    const base = `
      width: 100%; border: none; border-radius: 6px; padding: 10px 0;
      font-size: 15px; font-weight: bold; margin-top: 12px;
    `;

    if (weapon.equipped) {
      btn.textContent = '장착 중';
      btn.style.cssText = `${base} background: #3a3a45; color: #888; cursor: default;`;
      btn.disabled = true;
    } else if (weapon.owned) {
      btn.textContent = '장착하기';
      btn.style.cssText = `${base} background: transparent; border: 1px solid #7ec8e3; color: #7ec8e3; cursor: pointer;`;
      btn.addEventListener('click', () => handlers.onEquip(weapon.id));
    } else if (gold >= weapon.price) {
      btn.textContent = `🪙 ${weapon.price.toLocaleString()} 구매`;
      btn.style.cssText = `${base} background: #f0a500; color: #1a1a2e; cursor: pointer;`;
      btn.addEventListener('click', () => handlers.onBuy(weapon.id));
    } else {
      btn.textContent = `🪙 ${weapon.price.toLocaleString()} · 골드 부족`;
      btn.style.cssText = `${base} background: #3a3a45; color: #888; cursor: default;`;
      btn.disabled = true;
    }
    return btn;
  }

  function arrow(label, disabled, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 44px; height: 44px; flex: none; border-radius: 50%; font-size: 18px;
      background: rgba(255,255,255,0.08); border: 1px solid #555; color: #fff;
      cursor: ${disabled ? 'default' : 'pointer'}; opacity: ${disabled ? 0.3 : 1};
    `;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  function render() {
    const { gold, weapons } = current.state;
    const handlers = current.handlers;
    const weapon = weapons[index];
    overlay.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'width: min(420px, 88%); background: #14141f; border-radius: 12px; padding: 18px;';
    overlay.appendChild(panel);

    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 16px;
    `;
    bar.innerHTML = `
      <b style="font-size:17px">무기 상점</b>
      <span style="background:rgba(240,165,0,0.15);border:1px solid #f0a500;color:#f0a500;
                   border-radius:20px;padding:4px 14px;font-size:14px;font-weight:bold">
        🪙 ${gold.toLocaleString()}
      </span>
    `;
    panel.appendChild(bar);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    row.appendChild(arrow('◀', index === 0, () => { index -= 1; render(); }));

    const card = document.createElement('div');
    const accent = weapon.equipped ? '#f0a500' : weapon.owned ? '#7ec8e3' : '#555';
    card.style.cssText = `
      flex: 1; border: 2px solid ${accent}; border-radius: 10px; padding: 16px; text-align: center;
      background: rgba(255,255,255,0.04);
    `;
    card.innerHTML = `
      <div style="height:120px;border-radius:8px;background:rgba(0,0,0,0.35);
                  display:flex;align-items:center;justify-content:center;margin-bottom:12px">
        <img src="${weapon.image}" alt="${weapon.name}" style="max-width:90%;max-height:100%">
      </div>
      <div style="font-size:19px;font-weight:bold;margin-bottom:6px">${weapon.name}</div>
      <div style="font-size:13px;color:#bbb">데미지 ${damagePips(weapon.damage)}</div>
    `;
    card.appendChild(actionButton(weapon, gold, handlers));
    row.appendChild(card);

    row.appendChild(arrow('▶', index === weapons.length - 1, () => { index += 1; render(); }));
    panel.appendChild(row);

    const dots = document.createElement('div');
    dots.style.cssText = 'text-align: center; margin-top: 14px;';
    dots.innerHTML = weapons
      .map((_, i) => `<span style="display:inline-block;height:8px;margin:0 4px;border-radius:4px;
        width:${i === index ? '20px' : '8px'};background:${i === index ? '#f0a500' : '#555'}"></span>`)
      .join('');
    panel.appendChild(dots);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      display: block; margin: 14px auto 0; padding: 8px 28px; font-size: 14px; cursor: pointer;
      border: 1px solid #f0a500; border-radius: 6px; background: transparent; color: #f0a500;
    `;
    closeBtn.addEventListener('click', handlers.onClose);
    panel.appendChild(closeBtn);
  }

  function show(state, handlers) {
    current = { state, handlers };
    if (index >= state.weapons.length) index = 0;
    render();
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

캐러셀 위치(`index`)를 모듈 상태로 두었기 때문에, 구매·장착 뒤 `show()`를 다시 불러도 보고 있던 무기가 그대로 유지된다.

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

기대: 성공. **이 시점에는 `game.js`가 아직 옛 시그니처(`show(onClose)`)로 부르고 있어 상점이 깨진다 — Task 11에서 이어서 고친다.**

- [ ] **Step 3: 커밋**

```bash
git add game/src/ui/shopPanel.js
git commit -m "feat: rewrite shop panel as a weapon carousel"
```

---

### Task 11: 상점 구매·장착을 게임에 연결

**Files:**
- Modify: `game/src/gameplay/game.js:140-148`

**Interfaces:**
- Consumes: `createShopPanel(...).show(state, handlers)` (Task 10), `weaponStore` (Task 2), `currencyStore.spend` (Task 3), `swapWeaponViewmodel` (Task 8)
- Produces: 없음(최종 연결)

- [ ] **Step 1: 상점 상태 생성 함수 추가**

`game.js`의 `openShopFromMenu` 바로 앞에 추가:

```js
  function buildShopState() {
    const equippedId = weaponStore.getEquipped();
    const owned = weaponStore.getOwned();
    return {
      gold: currencyStore.get(),
      weapons: CONFIG.weapons.map((weapon) => ({
        id: weapon.id,
        name: weapon.name,
        image: weapon.image,
        damage: weapon.damage,
        price: weapon.price,
        owned: owned.includes(weapon.id),
        equipped: weapon.id === equippedId,
      })),
    };
  }

  function refreshShop() {
    shopPanel.show(buildShopState(), shopHandlers);
  }

  function buyWeapon(id) {
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    if (!weapon || weaponStore.isOwned(id)) return;
    if (!currencyStore.spend(weapon.price)) return;
    weaponStore.markOwned(id);
    refreshShop();
  }

  function equipWeapon(id) {
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    if (!weapon || !weaponStore.equip(id)) return;
    refreshShop();
    swapWeaponViewmodel(weapon).catch(() => {
      weaponStore.equip(weaponStore.getOwned()[0]);
      refreshShop();
    });
  }

  const shopHandlers = {
    onBuy: buyWeapon,
    onEquip: equipWeapon,
    onClose: () => closeShop(),
  };
```

무기 모델 로드에 실패하면 보유 목록의 첫 무기(항상 기본 소총)로 되돌려 게임이 총 없이 남지 않게 한다.

- [ ] **Step 2: `openShopFromMenu` 수정**

```js
  function openShopFromMenu() {
    screens.hide();
    refreshShop();
  }
```

`closeShop`은 그대로 둔다.

- [ ] **Step 3: 빌드·테스트 확인**

```bash
npm test && npm run build
```

기대: 모두 PASS, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: wire weapon purchase and equip into the shop"
```

---

### Task 12: 통합 검증

**Files:**
- Modify: `game/src/config.js` (필요 시 `scale`/`position` 미세 조정만)

**Interfaces:**
- Consumes: Task 1–11 전부
- Produces: 없음

- [ ] **Step 1: 전체 테스트와 빌드**

```bash
npm test && npm run build
```

기대: 전부 PASS, 빌드 성공.

- [ ] **Step 2: dev 서버 실행**

```bash
npm run dev
```

- [ ] **Step 3: 골드를 채우고 구매 흐름 확인**

브라우저 콘솔에서:

```js
localStorage.setItem('shootshoot.gold', '10000'); location.reload();
```

메인 메뉴 → 상점에서 확인:
1. 카드가 한 번에 하나만 보이고 ◀ ▶로 4자루를 오갈 수 있다. 첫/마지막에서 해당 화살표가 흐려진다.
2. 하단 점 인디케이터가 현재 위치를 표시한다.
3. 각 카드에 무기 PNG가 실제로 보인다(깨진 이미지 아이콘이 아니어야 한다).
4. 기본 소총은 "장착 중"(비활성), 나머지는 "🪙 가격 구매".
5. 돌격소총을 한 번 누르면 **확인 없이 즉시** 구매되고, 골드가 500 줄고, 버튼이 "장착하기"로 바뀐다.
6. "장착하기"를 누르면 "장착 중"으로 바뀌고 기본 소총 카드는 "장착하기"가 된다.

- [ ] **Step 4: 골드 부족 상태 확인**

```js
localStorage.setItem('shootshoot.gold', '100'); location.reload();
```

기대: 저격소총·레이건 카드가 회색 "🪙 … · 골드 부족"이고 눌러도 아무 일이 없다.

- [ ] **Step 5: 1인칭 모델 교체 확인**

각 무기를 장착한 뒤 상점을 닫고 게임을 시작해, 화면의 총이 장착한 무기로 실제로 바뀌는지 확인한다. 크기·위치가 어색하면 `CONFIG.weapons`의 해당 항목 `scale`/`position`을 조정하고 새로고침해 다시 본다.

- [ ] **Step 6: 무기별 체감 확인**

레이건(데미지 5)을 장착하고 라운드 9까지 진행해, 원숭이(HP 5)가 몸통 한 발에 죽는지 확인한다. 기본 소총으로 같은 라운드에 가면 5발이 필요하다.

- [ ] **Step 7: 저장 상태가 유지되는지 확인**

새로고침 후에도 보유·장착 무기가 유지되는지 확인한다.

- [ ] **Step 8: 조정한 값이 있으면 커밋**

```bash
git add game/src/config.js
git commit -m "fix: tune weapon viewmodel scale and position"
```

값을 바꾸지 않았다면 이 단계는 건너뛴다.
