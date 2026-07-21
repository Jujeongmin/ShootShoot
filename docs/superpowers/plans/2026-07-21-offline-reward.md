# 오프라인 보상 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임을 다시 열었을 때 자리를 비운 시간(오프라인 시간)에 비례한 골드를 팝업으로 보여주고 "받기"를 누르면 지급한다. 시간당 10골드, 최대 8시간(80골드)까지만 인정한다.

**Architecture:** 새 순수 모듈 `offlineReward.js`가 계산 함수(`calculateOfflineGold`)와 마지막 접속 시각 저장소(`createLastSeenStore`, 기존 `currencyStore`와 동일한 패턴)를 제공한다. 새 UI 모듈 `offlineRewardPopup.js`가 `settingsPanel.js`/`shopPanel.js`와 동일한 오버레이 패턴으로 팝업을 렌더링한다. `game.js`는 부팅(에셋 로딩 완료 직후, 메뉴 표시 직전) 시점에 딱 한 번만 저장된 마지막 접속 시각과 현재 시각을 비교해 골드를 계산하고, 즉시 마지막 접속 시각을 현재로 갱신한 뒤, 골드가 0보다 크면 메뉴 대신 팝업을 먼저 보여준다.

**Tech Stack:** Vanilla JS ES 모듈, Vitest(순수 함수/저장소 테스트), DOM 렌더링(기존 패턴 재사용, 신규 의존성 없음).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 오프라인 시간당 골드 10개, 최대 8시간(80골드)까지만 인정 — `CONFIG.offlineReward = { goldPerHour: 10, maxHours: 8 }`.
- 최초 실행(저장된 마지막 접속 시각이 없음)은 팝업 없이 조용히 현재 시각만 기록한다.
- 계산된 골드가 0이면(경과 시간이 너무 짧음) 팝업을 띄우지 않는다.
- 이 체크는 게임 부팅(페이지 로드) 시 딱 한 번만 일어난다 — 게임오버 후 메인 메뉴로 돌아가는 것 등 같은 세션 안의 다른 메뉴 진입에서는 다시 체크하지 않는다.
- `calculateOfflineGold`는 경과 시간이 0 이하이면 0을 반환해야 한다(시스템 시계가 되돌아가는 등 방어적 처리, 크래시 방지 수준).

---

### Task 1: `offlineReward.js` — 계산 함수 + 저장소 (순수, 테스트)

**Files:**
- Create: `game/src/gameplay/offlineReward.js`
- Modify: `game/src/config.js`
- Test: `test/offlineReward.test.js`

**Interfaces:**
- Produces: `calculateOfflineGold(elapsedMs: number, config: { goldPerHour: number, maxHours: number }) -> number`, `createLastSeenStore(storage, key) -> { get() -> number|null, set(timestamp: number) }` — Task 3이 둘 다 소비한다.

- [ ] **Step 1: `config.js`에 오프라인 보상 상수 추가**

`game/src/config.js`의 `scorePerGold: 10,` 다음 줄에 추가:

```js
  scorePerGold: 10,
  offlineReward: {
    goldPerHour: 10,
    maxHours: 8,
  },
```

그리고 `currencyStorageKey: 'shootshoot.gold',` 다음 줄에 추가:

```js
  currencyStorageKey: 'shootshoot.gold',
  lastSeenStorageKey: 'shootshoot.lastseen',
```

- [ ] **Step 2: `test/offlineReward.test.js`에 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { calculateOfflineGold, createLastSeenStore } from '../game/src/gameplay/offlineReward.js';
import { CONFIG } from '../game/src/config.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('calculateOfflineGold', () => {
  it('returns 0 for zero or negative elapsed time', () => {
    expect(calculateOfflineGold(0, CONFIG.offlineReward)).toBe(0);
    expect(calculateOfflineGold(-1000, CONFIG.offlineReward)).toBe(0);
  });

  it('computes gold proportional to elapsed hours', () => {
    expect(calculateOfflineGold(60 * 60 * 1000, CONFIG.offlineReward)).toBe(10);
    expect(calculateOfflineGold(30 * 60 * 1000, CONFIG.offlineReward)).toBe(5);
  });

  it('caps at maxHours', () => {
    expect(calculateOfflineGold(10 * 60 * 60 * 1000, CONFIG.offlineReward)).toBe(80);
  });
});

describe('createLastSeenStore', () => {
  it('returns null when nothing stored', () => {
    const store = createLastSeenStore(createMemoryStorage(), 'test.lastseen');
    expect(store.get()).toBeNull();
  });

  it('set()/get() round trip', () => {
    const store = createLastSeenStore(createMemoryStorage(), 'test.lastseen');
    store.set(12345);
    expect(store.get()).toBe(12345);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const store1 = createLastSeenStore(storage, 'test.lastseen');
    store1.set(99999);
    const store2 = createLastSeenStore(storage, 'test.lastseen');
    expect(store2.get()).toBe(99999);
  });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test` (저장소 루트에서)
Expected: FAIL — `offlineReward.js` 파일이 없어서 새로 추가한 6개 테스트만 실패(import 에러), 나머지 25개 테스트는 그대로 통과.

- [ ] **Step 4: `offlineReward.js` 구현**

```js
export function calculateOfflineGold(elapsedMs, config) {
  if (elapsedMs <= 0) return 0;
  const elapsedHours = Math.min(elapsedMs / (60 * 60 * 1000), config.maxHours);
  return Math.floor(elapsedHours * config.goldPerHour);
}

export function createLastSeenStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const value = Number.parseInt(raw, 10);
      return Number.isNaN(value) ? null : value;
    },
    set(timestamp) {
      storage.setItem(key, String(timestamp));
    },
  };
}
```

- [ ] **Step 5: 테스트 실행해서 전체 통과 확인**

Run: `npm test`
Expected: PASS — 전체 31개 테스트 통과(기존 25개 + 새로 추가한 6개).

- [ ] **Step 6: Commit**

```bash
git add game/src/config.js game/src/gameplay/offlineReward.js test/offlineReward.test.js
git commit -m "feat: add offline reward calculation and last-seen store"
```

---

### Task 2: `offlineRewardPopup.js` — 팝업 UI 모듈

**Files:**
- Create: `game/src/ui/offlineRewardPopup.js`

**Interfaces:**
- Produces: `createOfflineRewardPopup(container: HTMLElement) -> { show(goldAmount: number, onClaim: () => void): void }` — Task 3이 이 시그니처로 소비한다.

- [ ] **Step 1: `game/src/ui/offlineRewardPopup.js` 작성**

```js
export function createOfflineRewardPopup(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function show(goldAmount, onClaim) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '오프라인 보상';
    overlay.appendChild(title);

    const message = document.createElement('p');
    message.textContent = `자리를 비운 사이 골드 ${goldAmount}개를 모았습니다!`;
    overlay.appendChild(message);

    const claimBtn = document.createElement('button');
    claimBtn.textContent = '받기';
    claimBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    claimBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      onClaim();
    });
    overlay.appendChild(claimBtn);

    overlay.style.display = 'flex';
  }

  return { show };
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. 이 모듈은 순수 DOM 렌더링이라 Vitest 유닛 테스트 대상이 아니다(`settingsPanel.js`, `shopPanel.js`와 동일한 검증 방식).

- [ ] **Step 3: Commit**

```bash
git add game/src/ui/offlineRewardPopup.js
git commit -m "feat: add offline reward popup UI module"
```

---

### Task 3: `game.js` — 부팅 시 오프라인 보상 체크 연결

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `calculateOfflineGold(elapsedMs, config)`, `createLastSeenStore(storage, key) -> { get(), set(timestamp) }`(Task 1), `createOfflineRewardPopup(container) -> { show(goldAmount, onClaim) }`(Task 2).

- [ ] **Step 1: import 추가**

`game/src/gameplay/game.js` 최상단 import 목록에 추가. 기존 `import { createSettingsStore } from './settingsStore.js';` 다음 줄에:

```js
import { calculateOfflineGold, createLastSeenStore } from './offlineReward.js';
```

그리고 기존 `import { createShopPanel } from '../ui/shopPanel.js';` 다음 줄에:

```js
import { createOfflineRewardPopup } from '../ui/offlineRewardPopup.js';
```

- [ ] **Step 2: 인스턴스 생성**

`createGame` 함수 내부, 기존 `const shopPanel = createShopPanel(container);` 다음 줄에 추가:

```js
  const offlineRewardPopup = createOfflineRewardPopup(container);
```

그리고 기존 `const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);` 다음 줄에 추가:

```js
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
```

- [ ] **Step 3: 부팅 흐름에 오프라인 보상 체크 삽입**

`start()` 함수 맨 끝의 `Promise.all(...).then(...)` 콜백을 다음과 같이 수정한다.

변경 전:
```js
    Promise.all([
      loadMonkeyModel(),
      loadRifleViewmodel(engine.camera),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedRifleViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
      rifleViewmodel = resolvedRifleViewmodel;
      obstacles = resolvedObstacles;
      screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
    });
```

변경 후:
```js
    Promise.all([
      loadMonkeyModel(),
      loadRifleViewmodel(engine.camera),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedRifleViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
      rifleViewmodel = resolvedRifleViewmodel;
      obstacles = resolvedObstacles;

      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, CONFIG.offlineReward);

      if (offlineGold > 0) {
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
        });
      } else {
        screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
      }
    });
```

(`lastSeenStore.set(now)`는 팝업을 실제로 열고 "받기"를 누르는지와 무관하게 이 시점에 즉시 실행된다 — 새로고침을 반복해도 중복 적립되지 않게 하기 위함이다. `screens.showLoading('로딩 중...')` 호출과 `engine.start((dt) => {...})` 틱 콜백 등록은 이 `Promise.all(...)` 앞에 그대로 있고, 이번 변경으로 건드리지 않는다.)

- [ ] **Step 4: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 5: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 31개 테스트 전부 통과(이 작업은 `game.js`만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 6: 브라우저에서 수동 확인**

Run: `npm run dev`. 다음 시나리오를 확인한다:
1. `localStorage`를 비운 상태(또는 브라우저 개발자 도구에서 `localStorage.clear()`)로 처음 접속 → 팝업 없이 바로 메뉴가 뜨는지 확인.
2. 개발자 도구 콘솔에서 `localStorage.setItem('shootshoot.lastseen', String(Date.now() - 2 * 60 * 60 * 1000))`로 "2시간 전"을 흉내낸 뒤 페이지를 새로고침 → "오프라인 보상" 팝업이 뜨고 "골드 20개를 모았습니다!"(2시간 × 시간당 10개) 문구가 보이는지 확인 → "받기"를 누르면 팝업이 닫히고 메인 메뉴에 골드가 반영되어 보이는지 확인.
3. "받기"를 누른 직후 다시 새로고침 → 방금 리셋된 기준 시각 때문에 팝업이 다시 뜨지 않는지(또는 아주 작은 골드만 뜨는지) 확인.

- [ ] **Step 7: Commit**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: check and claim offline reward on game boot"
```

---

## Self-Review Notes

- **스펙 커버리지**: 적립 규칙(2.1) → Task 1. 마지막 접속 시각 저장(2.2) → Task 1. 부팅 시 처리 흐름(2.3) → Task 3. 팝업 UI(2.4) → Task 2. 비목표(오프라인 연출 없음, 광고 배율 없음, 멀티 탭 동기화 없음, 최초 실행 팝업 없음) → 계획에 해당 기능이 아예 등장하지 않거나(연출/배율/동기화) Task 3의 `lastSeenAt === null` 분기로 명시적으로 충족(최초 실행 무팝업).
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `calculateOfflineGold(elapsedMs, config) -> number`/`createLastSeenStore(storage, key) -> { get(), set(timestamp) }`(Task 1) → `game.js`가 그대로 소비(Task 3 Step 3). `createOfflineRewardPopup(container) -> { show(goldAmount, onClaim) }`(Task 2) → `game.js`가 `offlineRewardPopup.show(offlineGold, () => {...})`로 소비(Task 3 Step 3) — 일치.
- **기존 로직 보존 확인**: `handleShot`, 틱 루프, `endGame()`의 두 불변 조건(하이스코어 읽기 순서, 라운드 클리어가 `else` 분기 안에 있는 것), 총알 소진 게임오버의 `hasDyingMonkeys()` 가드는 이번 계획에서 전혀 건드리지 않는다 — Task 3의 변경은 `Promise.all(...).then(...)` 콜백 안에 오프라인 보상 체크 블록을 추가하는 것뿐이며, 그 콜백 앞의 `screens.showLoading(...)`과 `engine.start(...)` 등록부는 그대로 둔다.
- **음수/방어적 처리**: `calculateOfflineGold`가 `elapsedMs <= 0`이면 0을 반환하도록 Task 1에서 명시적으로 구현하고 테스트로 검증한다(스펙 5절의 "열린 위험" 대응).
