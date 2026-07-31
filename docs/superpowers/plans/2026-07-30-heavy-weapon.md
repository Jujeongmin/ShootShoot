# 별 4개 무기 '중화기' Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상점의 별 4개 자리를 채우는 무기 '중화기'를 넣고, 무기 배열 전체를 지키는 테스트를 세운다.

**Architecture:** 무기는 전부 `config.js` 의 `weapons` 배열이 갖는 데이터다. 상점·소유 기록·뷰모델·데미지 계산이 이미 무기 개수에 대해 일반적이라, 항목 하나를 넣으면 나머지가 따라온다. 데이터에는 단위 테스트가 붙을 자리가 없으므로 배열 자체의 불변식을 검증하는 테스트 파일을 새로 만든다.

**Tech Stack:** Vite 5, vitest 1.6 (`environment: 'node'`), 바닐라 DOM.

설계: [2026-07-30-heavy-weapon-design.md](../specs/2026-07-30-heavy-weapon-design.md)

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 195개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `npm run build` 가 성공해야 한다.
- 게임 화면은 이 환경에서 확인할 수 없다. 브라우저 창이 안 열린다. 무기가 화면에 어떤 크기로 뜨는지는 **사용자 육안 확인 항목**이다.
- 새 모델 파일을 만들거나 받지 않는다. `Rifle.fbx` 는 이미 저장소에 있다.
- 상점 그림 PNG 는 이 작업에서 만들지 않는다. 사용자가 나중에 굽는다.
- 커밋 메시지는 영어로, 본문에 왜 그렇게 했는지를 적는다.

## 스펙에서 확인한 현재 구조

구현자가 알아야 할 사실들이다. 코드를 다시 뒤질 필요가 없도록 여기 모았다.

- `CONFIG.weapons` 는 `game/src/config.js` 의 배열이고 지금 항목이 넷이다: `basic`(damage 1, price 0), `assault`(2, 500), `sniper`(3, 2000), `raygun`(5, 6000).
- 각 항목의 필드는 `id` `name` `model` `format` `damage` `price` `image` `scale` `position` `rotation` 열 개다.
- `format` 은 `'glb'` 또는 `'fbx'` 다. `basic` 만 `glb` 고 나머지 셋은 `fbx` 다.
- `position` 은 넷 다 `{ x: 0.4, y: -0.3, z: -0.7 }`, `rotation` 은 넷 다 `{ x: 0, y: 0, z: 0 }` 이다.
- `scale` 은 무기마다 다르다: `basic` 0.08(glb), `assault` 0.00148, `sniper` 0.00061, `raygun` 0.00211.
- `game/public/models/Rifle.fbx` 가 저장소에 있고 `CONFIG` 어디서도 참조하지 않는다. `basic` 이 쓰는 것은 소문자 `rifle.glb` 로 다른 파일이다.
- 상점은 `shopPanel.js` 가 그린다. `let index = 0` 으로 한 번에 무기 하나를 보여주고, 이전/다음 버튼이 `index === 0` 과 `index === weapons.length - 1` 에서 각각 비활성화된다. 하단 점 표시도 `state.weapons` 를 순회한다. **무기 개수에 대해 이미 일반적이다.**
- 별은 `shopPanel.js` 의 `damagePips(damage)` 가 그리고 `MAX_DAMAGE_PIPS = 5` 다.
- `weaponStore` 는 소유 id 를 문자열 배열로 `localStorage` 에 넣는다. 모르는 id 는 미보유로 나오므로 기존 세이브가 안 깨진다.
- ~~상점 그림은 `artwork()` 가 그리는데 `img.addEventListener('error', ...)` 로 깨진 이미지를 숨긴다.~~ **이 줄은 틀렸다.** `artwork()` 는 `screens.js` 에 있고 메인 메뉴의 바주카 카드에만 쓰인다. 상점 무기 그림은 `shopPanel.js` 가 그리는 리스너 없는 맨 `<img>` 였다. 구현 중 발견돼 사용자 판정으로 `shopPanel.js` 에 `error` 리스너를 달았다 (커밋 `18b1499`). 지금은 PNG 가 없어도 자리만 비고 상점이 정상으로 뜬다.
- 테스트는 `test/` 아래 평평하게 있고 `import { CONFIG } from '../game/src/config.js';` 로 설정을 읽는다 (`test/gameReset.test.js` 가 그렇게 한다).

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `test/weapons.test.js` | `CONFIG.weapons` 배열의 불변식을 지킨다 |

**수정할 파일**

| 파일 | 무엇을 |
|---|---|
| `game/src/config.js` | `weapons` 배열에 `heavy` 항목 하나 |

**건드리지 않는 파일**

`weaponStore.js`, `weaponButtonState.js`, `weaponViewmodel.js`, `shooting.js`, `scoring.js`, `game.js`. 전부 무기 개수에 대해 이미 일반적이다.

`shopPanel.js` 도 원래 이 목록에 있었으나, 위의 정정 때문에 무기 그림에 `error` 리스너 한 줄이 들어갔다. 무기 개수와는 무관한 변경이다.

---

### Task 1: 무기 배열을 지키는 테스트

**Files:**
- Create: `test/weapons.test.js`

**Interfaces:**
- Consumes: `CONFIG.weapons` (`game/src/config.js`).
- Produces: 없음. 이 태스크는 그물만 친다.

이 태스크는 **아직 중화기를 넣지 않는다.** 지금의 무기 넷에 대해 전부 통과해야 한다. Task 2 가 무기를 넣었을 때 배열이 깨지지 않았음을 이 테스트가 증명한다.

- [ ] **Step 1: 테스트를 쓴다**

`test/weapons.test.js` 를 새로 만든다.

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../game/src/config.js';

const REQUIRED_FIELDS = [
  'id', 'name', 'model', 'format', 'damage', 'price', 'image', 'scale', 'position', 'rotation',
];

describe('CONFIG.weapons', () => {
  it('has no duplicate ids', () => {
    const ids = CONFIG.weapons.map((weapon) => weapon.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists weapons in strictly ascending price order', () => {
    const prices = CONFIG.weapons.map((weapon) => weapon.price);
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it('lists weapons in strictly ascending damage order', () => {
    const damages = CONFIG.weapons.map((weapon) => weapon.damage);
    for (let i = 1; i < damages.length; i += 1) {
      expect(damages[i]).toBeGreaterThan(damages[i - 1]);
    }
  });

  it('gives every weapon all the fields the shop and viewmodel read', () => {
    for (const weapon of CONFIG.weapons) {
      for (const field of REQUIRED_FIELDS) {
        expect(weapon, `${weapon.id} is missing ${field}`).toHaveProperty(field);
      }
    }
  });

  it('uses only the two model formats the loader understands', () => {
    for (const weapon of CONFIG.weapons) {
      expect(['glb', 'fbx']).toContain(weapon.format);
    }
  });

  it('scales every weapon by a positive number', () => {
    for (const weapon of CONFIG.weapons) {
      expect(weapon.scale).toBeGreaterThan(0);
    }
  });

  it('starts with the free default weapon', () => {
    expect(CONFIG.weapons[0].id).toBe('basic');
    expect(CONFIG.weapons[0].price).toBe(0);
  });
});
```

- [ ] **Step 2: 지금 배열로 통과하는 걸 확인한다**

Run: `npx vitest run test/weapons.test.js`
Expected: PASS — 7 tests. 지금 무기 넷(가격 0·500·2000·6000, 데미지 1·2·3·5)이 전부 이 규칙을 만족한다.

만약 실패한다면 배열이 이미 규칙을 어기고 있다는 뜻이다. 테스트를 느슨하게 고치지 말고 멈추고 보고할 것 — 규칙 자체가 틀렸는지 판단이 필요하다.

- [ ] **Step 3: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 202 tests (195 + 7)

Run: `npm run build`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add test/weapons.test.js
git commit -m "test: pin the invariants of the weapons list" -m "Weapons are config data, so nothing checked that a new entry kept the ordering, the field set or the model format the loader understands. The shop pages through this array by index and the viewmodel reads every field, so a typo would only surface in the running game."
```

---

### Task 2: 중화기

**Files:**
- Modify: `game/src/config.js` (`weapons` 배열에 항목 하나)

**Interfaces:**
- Consumes: Task 1 의 `test/weapons.test.js` 가 이 항목을 검증한다.
- Produces: `CONFIG.weapons` 에 `id: 'heavy'` 항목. 게임 코드 어디도 이 id 를 이름으로 참조하지 않는다 — 배열을 순회할 뿐이다.

- [ ] **Step 1: 중화기 항목이 있는지 검증하는 테스트를 더한다**

`test/weapons.test.js` 의 `describe` 블록 **맨 끝에** 넣는다. 기존 테스트는 손대지 않는다.

```js
  it('fills the four-star slot with 중화기', () => {
    const heavy = CONFIG.weapons.find((weapon) => weapon.id === 'heavy');
    expect(heavy).toBeDefined();
    expect(heavy.name).toBe('중화기');
    expect(heavy.damage).toBe(4);
    expect(heavy.price).toBe(4000);
    expect(heavy.model).toBe('/models/Rifle.fbx');
    expect(heavy.format).toBe('fbx');
  });
```

- [ ] **Step 2: 실패하는 걸 확인한다**

Run: `npx vitest run test/weapons.test.js`
Expected: FAIL — `fills the four-star slot with 중화기` 에서 `expected undefined to be defined`

- [ ] **Step 3: 무기를 넣는다**

`game/src/config.js` 의 `weapons` 배열에서 `sniper` 항목과 `raygun` 항목 **사이에** 넣는다. 순서가 곧 상점 순서라 자리가 중요하다.

before:
```js
    {
      id: 'sniper', name: '저격소총', model: '/models/Sniper rifle.fbx', format: 'fbx',
      damage: 3, price: 2000, image: '/images/weapons/sniper.png',
      scale: 0.00061, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'raygun', name: '레이건', model: '/models/Ray Gun.fbx', format: 'fbx',
```

after:
```js
    {
      id: 'sniper', name: '저격소총', model: '/models/Sniper rifle.fbx', format: 'fbx',
      damage: 3, price: 2000, image: '/images/weapons/sniper.png',
      scale: 0.00061, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    // scale 은 띄워 보고 맞춘 값이 아니다. FBX 무기들의 배율이 모델 길이 때문에
    // 제각각이라(0.00061 ~ 0.00211) 길이가 비슷한 전기총 값에서 시작한다.
    // 상점 그림 heavy.png 는 아직 없다. shopPanel.js 가 로드 실패한 그림을 숨기므로
    // heavy.png 를 굽기 전까지는 그림 자리만 비고 상점은 정상으로 뜬다.
    {
      id: 'heavy', name: '중화기', model: '/models/Rifle.fbx', format: 'fbx',
      damage: 4, price: 4000, image: '/images/weapons/heavy.png',
      scale: 0.00148, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'raygun', name: '레이건', model: '/models/Ray Gun.fbx', format: 'fbx',
```

- [ ] **Step 4: 테스트가 통과하는 걸 확인한다**

Run: `npx vitest run test/weapons.test.js`
Expected: PASS — 8 tests. 특히 가격 오름차순(0·500·2000·**4000**·6000)과 데미지 오름차순(1·2·3·**4**·5)이 그대로 통과해야 한다. 자리를 잘못 넣었으면 여기서 걸린다.

- [ ] **Step 5: 모델 파일이 실제로 있는지 확인한다**

Run: `node -e "console.log(require('fs').existsSync('game/public/models/Rifle.fbx'))"`
Expected: `true`

경로 대소문자가 틀리면 개발 서버(Windows)에서는 열리고 배포에서는 404 가 난다. 한 번 확인하고 넘어간다.

- [ ] **Step 6: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS — 203 tests

Run: `npm run build`
Expected: 성공

- [ ] **Step 7: 커밋**

```bash
git add game/src/config.js test/weapons.test.js
git commit -m "feat: add a four-star weapon between the sniper and the raygun" -m "The shop jumped from three stars to five with nothing in between. Rifle.fbx was already in the repo with nothing referencing it, so the weapon needed one array entry rather than a new asset. Its scale starts at the lightning gun's value because the FBX weapons differ by model length and this one has not been seen on screen yet."
```

---

## 사용자 육안 확인 항목

이 환경에서는 브라우저 창이 안 열린다. 아래는 사용자가 `http://127.0.0.1:5174/` 에서 직접 본다.

- 상점에서 저격소총 다음, 레이건 앞에 **중화기**가 나오는지. 별 네 개, 가격 4000
- 사서 장착했을 때 총이 **화면에서 적당한 크기인지**. 너무 크거나 작으면 말해 줄 것 — `config.js` 의 `scale` 만 고치면 된다 (시작값 `0.00148`)
- 총이 화면 오른쪽 아래에 자연스럽게 놓이는지. 어긋나면 `position` 을 손본다
- 그림 자리가 비어 있는 것은 정상이다. `heavy.png` 는 아직 없다

### 그림을 굽는 순서 (사용자)

1. `http://127.0.0.1:5174/thumb.html` 로 512×512 투명 PNG 를 뽑는다
2. **반드시** `node tools/crop-weapon-art.mjs` 를 한 번 돌린다 — 안 돌리면 정사각 캔버스 여백 때문에 상점에서 그림이 작게 나온다
3. `game/public/images/weapons/heavy.png` 로 넣는다
