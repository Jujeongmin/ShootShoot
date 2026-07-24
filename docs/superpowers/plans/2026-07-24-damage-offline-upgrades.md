# 공격력 강화 + 오프라인 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 메뉴에 "공격력 강화"와 "오프라인 강화" 두 업그레이드 카드를 추가해, 골드(또는 골드 부족 시 광고 시청)로 레벨업할 수 있게 만든다.

**Architecture:** 새 저장 모듈(`upgradeStore.js`)이 두 레벨을 localStorage에 저장하고, 비용을 계산하는 순수 함수를 함께 제공한다. `game.js`가 이 레벨을 실제 효과(무기 데미지 가산, 오프라인 시간당 골드 가산)에 반영하고, `screens.js`의 메인 메뉴에 카드 2개를 추가한다. 기존 상점/설정 패턴(상태 객체 + 핸들러 객체를 넘기는 `show(state, handlers)`)을 그대로 따른다.

**Tech Stack:** Vanilla JS (ES modules), Vitest, 순수 DOM(프레임워크 없음), 기존 `currencyStore`/`weaponStore` 저장 패턴 재사용.

## Global Constraints

- 레벨 상한 없음 — 비용 곡선(`cost = round(baseCost × costMultiplier^level)`)이 사실상의 상한 역할을 한다.
- 저장은 `weaponStore.js`와 동일한 방어적 JSON 파싱 패턴을 따른다 — 저장값이 없거나 깨졌으면 항상 `{ damageLevel: 0, offlineLevel: 0 }`으로 복구한다.
- 골드가 부족할 때만 "광고 시청" 버튼이 나타나고, 시청 성공 시 골드 소비 없이 바로 레벨 +1된다.
- `screens.js`의 `showMenu` 시그니처 변경(위치 인자 → 객체 파라미터)은 `game.js`의 호출부 전체를 **한 태스크·한 커밋 안에서 함께** 바꾼다 — 부분 적용 시 인자 순서가 깨진 채로 빌드된다.
- 참고 스펙: [docs/superpowers/specs/2026-07-24-damage-offline-upgrades-design.md](../specs/2026-07-24-damage-offline-upgrades-design.md)

---

## Task 1: `upgradeStore.js` — 레벨 저장 + 비용 계산

**Files:**
- Modify: `game/src/config.js`
- Create: `game/src/gameplay/upgradeStore.js`
- Test: `test/upgradeStore.test.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `computeUpgradeCost(level: number, config: { baseCost: number, costMultiplier: number }) -> number`
  - `createUpgradeStore(storage, key) -> { getDamageLevel(): number, getOfflineLevel(): number, levelUpDamage(): number, levelUpOffline(): number }`
  - `CONFIG.damageUpgrade = { baseCost: 50, costMultiplier: 1.15, bonusPerLevel: 1 }`
  - `CONFIG.offlineUpgrade = { baseCost: 80, costMultiplier: 1.2, bonusPerLevel: 2 }`
  - `CONFIG.upgradeStorageKey = 'shootshoot.upgrades'`

- [ ] **Step 1: `CONFIG`에 강화 설정 추가**

`game/src/config.js`에서 다음 블록을 찾는다:

```js
  weaponDamage: {
    headshotMultiplier: 2,
  },
  weapons: [
```

다음으로 바꾼다(`weaponDamage`와 `weapons` 사이에 두 항목 삽입):

```js
  weaponDamage: {
    headshotMultiplier: 2,
  },
  damageUpgrade: {
    baseCost: 50,
    costMultiplier: 1.15,
    bonusPerLevel: 1,
  },
  offlineUpgrade: {
    baseCost: 80,
    costMultiplier: 1.2,
    bonusPerLevel: 2,
  },
  weapons: [
```

그리고 파일 끝부분에서 다음을 찾는다:

```js
  weaponStorageKey: 'shootshoot.weapons',
};
```

다음으로 바꾼다:

```js
  weaponStorageKey: 'shootshoot.weapons',
  upgradeStorageKey: 'shootshoot.upgrades',
};
```

- [ ] **Step 2: 실패하는 테스트 작성**

`test/upgradeStore.test.js` 생성:

```js
import { describe, it, expect } from 'vitest';
import { createUpgradeStore, computeUpgradeCost } from '../game/src/gameplay/upgradeStore.js';
import { CONFIG } from '../game/src/config.js';

function createMemoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('computeUpgradeCost', () => {
  it('returns baseCost at level 0', () => {
    expect(computeUpgradeCost(0, CONFIG.damageUpgrade)).toBe(50);
    expect(computeUpgradeCost(0, CONFIG.offlineUpgrade)).toBe(80);
  });

  it('grows by costMultiplier each level', () => {
    const level1 = computeUpgradeCost(1, CONFIG.damageUpgrade);
    const level2 = computeUpgradeCost(2, CONFIG.damageUpgrade);
    expect(level1).toBe(Math.round(50 * 1.15));
    expect(level2).toBe(Math.round(50 * 1.15 ** 2));
    expect(level2).toBeGreaterThan(level1);
  });

  it('keeps rising with no cap at high levels', () => {
    const low = computeUpgradeCost(5, CONFIG.offlineUpgrade);
    const high = computeUpgradeCost(50, CONFIG.offlineUpgrade);
    expect(high).toBeGreaterThan(low);
  });
});

describe('createUpgradeStore', () => {
  it('defaults both levels to 0 when nothing stored', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('levelUpDamage() increments only the damage level and returns the new level', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.levelUpDamage()).toBe(1);
    expect(store.levelUpDamage()).toBe(2);
    expect(store.getDamageLevel()).toBe(2);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('levelUpOffline() increments only the offline level and returns the new level', () => {
    const store = createUpgradeStore(createMemoryStorage(), 'test.upgrades');
    expect(store.levelUpOffline()).toBe(1);
    expect(store.getOfflineLevel()).toBe(1);
    expect(store.getDamageLevel()).toBe(0);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createUpgradeStore(storage, 'test.upgrades');
    first.levelUpDamage();
    first.levelUpOffline();
    first.levelUpOffline();

    const second = createUpgradeStore(storage, 'test.upgrades');
    expect(second.getDamageLevel()).toBe(1);
    expect(second.getOfflineLevel()).toBe(2);
  });

  it('recovers from malformed stored JSON', () => {
    const store = createUpgradeStore(createMemoryStorage({ 'test.upgrades': '{not json' }), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });

  it('recovers from a stored value with non-integer levels', () => {
    const stored = JSON.stringify({ damageLevel: 'three', offlineLevel: null });
    const store = createUpgradeStore(createMemoryStorage({ 'test.upgrades': stored }), 'test.upgrades');
    expect(store.getDamageLevel()).toBe(0);
    expect(store.getOfflineLevel()).toBe(0);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- --run test/upgradeStore.test.js`
Expected: FAIL — `Cannot find module '../game/src/gameplay/upgradeStore.js'`

- [ ] **Step 4: `upgradeStore.js` 구현**

`game/src/gameplay/upgradeStore.js` 생성:

```js
export function computeUpgradeCost(level, config) {
  return Math.round(config.baseCost * config.costMultiplier ** level);
}

function readState(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return { damageLevel: 0, offlineLevel: 0 };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { damageLevel: 0, offlineLevel: 0 };
  }

  const damageLevel = Number.isInteger(parsed?.damageLevel) ? parsed.damageLevel : 0;
  const offlineLevel = Number.isInteger(parsed?.offlineLevel) ? parsed.offlineLevel : 0;
  return { damageLevel, offlineLevel };
}

export function createUpgradeStore(storage, key) {
  function write(state) {
    storage.setItem(key, JSON.stringify(state));
  }

  return {
    getDamageLevel() {
      return readState(storage, key).damageLevel;
    },
    getOfflineLevel() {
      return readState(storage, key).offlineLevel;
    },
    levelUpDamage() {
      const state = readState(storage, key);
      state.damageLevel += 1;
      write(state);
      return state.damageLevel;
    },
    levelUpOffline() {
      const state = readState(storage, key);
      state.offlineLevel += 1;
      write(state);
      return state.offlineLevel;
    },
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- --run`
Expected: PASS — 모든 테스트 파일 포함 전체 그린(기존 65개 + 새 `upgradeStore.test.js` 8개)

- [ ] **Step 6: 커밋**

```bash
git add game/src/config.js game/src/gameplay/upgradeStore.js test/upgradeStore.test.js
git commit -m "$(cat <<'EOF'
feat: add upgrade level store and cost formula

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 효과 반영 + 메인 메뉴 UI

**Files:**
- Modify: `game/src/ui/screens.js` (전체 재작성)
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: Task 1의 `createUpgradeStore`, `computeUpgradeCost`, `CONFIG.damageUpgrade`, `CONFIG.offlineUpgrade`, `CONFIG.upgradeStorageKey`. 기존 `currencyStore.spend(amount) -> boolean`, `showRewardedAd() -> Promise<boolean>`, `calculateOfflineGold(elapsedMs, config) -> number`.
- Produces:
  - `screens.showMenu(state, handlers)` — 새 시그니처. `state = { gold, damageLevel, damageCost, canAffordDamage, offlineLevel, offlineCost, canAffordOffline }`, `handlers = { onStart, onSettings, onShop, onAdReward, onLevelUpDamage, onWatchAdDamage, onLevelUpOffline, onWatchAdOffline }`.
  - `game.js` 내부 `refreshMenu()` — 이후 다른 태스크가 메뉴를 다시 그려야 할 때 재사용 가능.

- [ ] **Step 1: `screens.js`를 새 시그니처로 재작성**

`game/src/ui/screens.js` 전체를 다음으로 교체한다:

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

  function iconButton(imageSrc, alt, onClick, size) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: ${size}px; height: ${size}px; padding: ${size * 0.22}px; cursor: pointer;
      border: none; border-radius: 50%; background: rgba(240,165,0,0.85);
      display: flex; align-items: center; justify-content: center;
    `;
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = alt;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
    btn.appendChild(img);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function upgradeCard(title, level, cost, canAfford, onUpgrade, onWatchAd, side) {
    const card = document.createElement('div');
    card.style.cssText = `
      position: absolute; bottom: 20px; ${side}: 20px; width: 128px;
      background: rgba(0,0,0,0.45); border: 1px solid #f0a500; border-radius: 10px;
      padding: 10px; text-align: center;
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size: 13px; font-weight: bold; color: #f0a500;';
    card.appendChild(titleEl);

    const levelEl = document.createElement('div');
    levelEl.textContent = `Lv.${level}`;
    levelEl.style.cssText = 'font-size: 12px; color: #ccc; margin: 4px 0 8px;';
    card.appendChild(levelEl);

    const actionBtn = document.createElement('button');
    actionBtn.style.cssText = `
      width: 100%; border: none; border-radius: 6px; padding: 6px 0;
      font-size: 12px; font-weight: bold; cursor: pointer;
    `;
    if (canAfford) {
      actionBtn.textContent = `🪙 ${cost.toLocaleString()} 강화`;
      actionBtn.style.background = '#f0a500';
      actionBtn.style.color = '#1a1a2e';
      actionBtn.addEventListener('click', onUpgrade);
    } else {
      actionBtn.textContent = '📺 무료강화';
      actionBtn.style.background = 'transparent';
      actionBtn.style.border = '1px solid #7ec8e3';
      actionBtn.style.color = '#7ec8e3';
      actionBtn.addEventListener('click', onWatchAd);
    }
    card.appendChild(actionBtn);

    return card;
  }

  function showMenu(state, handlers) {
    const { gold, damageLevel, damageCost, canAffordDamage, offlineLevel, offlineCost, canAffordOffline } = state;
    clear();

    // 좌측 중앙: 상점 아이콘
    const shopBtn = iconButton('/icons/cart.png', '상점', handlers.onShop, 56);
    shopBtn.style.position = 'absolute';
    shopBtn.style.left = '20px';
    shopBtn.style.top = '50%';
    shopBtn.style.transform = 'translateY(-50%)';
    overlay.appendChild(shopBtn);

    // 우측 상단: 보유 골드 + 광고보상 + 설정 아이콘
    const topRight = document.createElement('div');
    topRight.style.cssText = `
      position: absolute; top: 16px; right: 16px;
      display: flex; align-items: center; gap: 10px;
    `;
    const goldBadge = document.createElement('div');
    goldBadge.style.cssText = `
      display: flex; align-items: center; gap: 4px;
      background: rgba(0,0,0,0.35); border: 1px solid #f0a500; border-radius: 20px;
      padding: 6px 14px; font-size: 15px; font-weight: bold; color: #f0a500;
    `;
    goldBadge.textContent = `🪙 ${gold}`;
    topRight.appendChild(goldBadge);
    topRight.appendChild(iconButton('/icons/video.png', '광고 보상', handlers.onAdReward, 40));
    topRight.appendChild(iconButton('/icons/gear.png', '설정', handlers.onSettings, 40));
    overlay.appendChild(topRight);

    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    overlay.appendChild(button('탭하여 시작', handlers.onStart));

    // 좌하단: 공격력 강화, 우하단: 오프라인 강화
    overlay.appendChild(
      upgradeCard('공격력', damageLevel, damageCost, canAffordDamage, handlers.onLevelUpDamage, handlers.onWatchAdDamage, 'left')
    );
    overlay.appendChild(
      upgradeCard('오프라인', offlineLevel, offlineCost, canAffordOffline, handlers.onLevelUpOffline, handlers.onWatchAdOffline, 'right')
    );

    show();
  }

  function showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu) {
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
    overlay.appendChild(button('메인 메뉴로', onReturnToMenu));
    show();
  }

  function showLoading(text) {
    clear();
    const p = document.createElement('p');
    p.textContent = text;
    overlay.appendChild(p);
    show();
  }

  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
}
```

- [ ] **Step 2: `game.js`에 `upgradeStore` import 및 인스턴스 추가**

`game/src/gameplay/game.js`에서 다음을 찾는다:

```js
import { createCurrencyStore } from './currencyStore.js';
import { createEffects } from './effects.js';
```

다음으로 바꾼다:

```js
import { createCurrencyStore } from './currencyStore.js';
import { createUpgradeStore, computeUpgradeCost } from './upgradeStore.js';
import { createEffects } from './effects.js';
```

다음을 찾는다:

```js
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
```

다음으로 바꾼다:

```js
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const upgradeStore = createUpgradeStore(window.localStorage, CONFIG.upgradeStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
```

- [ ] **Step 3: `returnToMenu`/`closeSettings`/`closeShop`/`closeAdReward`가 `refreshMenu()`를 쓰도록 교체**

다음 네 블록을 각각 찾아서 바꾼다.

찾기:
```js
  function returnToMenu() {
    phase = 'menu';
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }
```
바꾸기:
```js
  function returnToMenu() {
    phase = 'menu';
    refreshMenu();
  }
```

찾기:
```js
  function closeSettings() {
    settingsPanel.hide();
    if (settingsOrigin === 'menu') {
      screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
    } else {
      settingsOpen = false;
    }
    settingsOrigin = null;
  }
```
바꾸기:
```js
  function closeSettings() {
    settingsPanel.hide();
    if (settingsOrigin === 'menu') {
      refreshMenu();
    } else {
      settingsOpen = false;
    }
    settingsOrigin = null;
  }
```

찾기:
```js
  function closeShop() {
    shopOpen = false;
    shopPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }
```
바꾸기:
```js
  function closeShop() {
    shopOpen = false;
    shopPanel.hide();
    refreshMenu();
  }
```

찾기:
```js
  function closeAdReward() {
    adRewardPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }

  function watchAdForGold() {
    showRewardedAd().then((success) => {
      if (success) {
        currencyStore.earn(CONFIG.adReward.goldAmount);
      }
      closeAdReward();
    });
  }
```
바꾸기(기존 두 함수 뒤에 새 함수 6개를 이어 붙인다):
```js
  function closeAdReward() {
    adRewardPanel.hide();
    refreshMenu();
  }

  function watchAdForGold() {
    showRewardedAd().then((success) => {
      if (success) {
        currencyStore.earn(CONFIG.adReward.goldAmount);
      }
      closeAdReward();
    });
  }

  function buildMenuState() {
    const gold = currencyStore.get();
    const damageLevel = upgradeStore.getDamageLevel();
    const damageCost = computeUpgradeCost(damageLevel, CONFIG.damageUpgrade);
    const offlineLevel = upgradeStore.getOfflineLevel();
    const offlineCost = computeUpgradeCost(offlineLevel, CONFIG.offlineUpgrade);
    return {
      gold,
      damageLevel,
      damageCost,
      canAffordDamage: gold >= damageCost,
      offlineLevel,
      offlineCost,
      canAffordOffline: gold >= offlineCost,
    };
  }

  const menuHandlers = {
    onStart: startGame,
    onSettings: openSettingsFromMenu,
    onShop: openShopFromMenu,
    onAdReward: openAdRewardFromMenu,
    onLevelUpDamage: levelUpDamage,
    onWatchAdDamage: watchAdForDamageUpgrade,
    onLevelUpOffline: levelUpOffline,
    onWatchAdOffline: watchAdForOfflineUpgrade,
  };

  function refreshMenu() {
    screens.showMenu(buildMenuState(), menuHandlers);
  }

  function levelUpDamage() {
    const cost = computeUpgradeCost(upgradeStore.getDamageLevel(), CONFIG.damageUpgrade);
    if (!currencyStore.spend(cost)) return;
    upgradeStore.levelUpDamage();
    refreshMenu();
  }

  function watchAdForDamageUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpDamage();
      refreshMenu();
    });
  }

  function levelUpOffline() {
    const cost = computeUpgradeCost(upgradeStore.getOfflineLevel(), CONFIG.offlineUpgrade);
    if (!currencyStore.spend(cost)) return;
    upgradeStore.levelUpOffline();
    refreshMenu();
  }

  function watchAdForOfflineUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpOffline();
      refreshMenu();
    });
  }
```

- [ ] **Step 4: 무기 데미지 계산에 공격력 강화 반영**

`game/src/gameplay/game.js`의 `handleShot()`에서 다음을 찾는다:

```js
    const outcome = resolveShot(hits);
    const weaponDamage = getEquippedWeapon().damage;
```

다음으로 바꾼다:

```js
    const outcome = resolveShot(hits);
    const weaponDamage = getEquippedWeapon().damage + upgradeStore.getDamageLevel() * CONFIG.damageUpgrade.bonusPerLevel;
```

- [ ] **Step 5: 오프라인 골드 계산에 오프라인 강화 반영 + 부팅 시 메뉴 호출 정리**

다음을 찾는다:

```js
      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, CONFIG.offlineReward);

      if (offlineGold > 0) {
        screens.hide();
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
        });
      } else {
        screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
      }
```

다음으로 바꾼다:

```js
      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGoldConfig = {
        goldPerHour: CONFIG.offlineReward.goldPerHour + upgradeStore.getOfflineLevel() * CONFIG.offlineUpgrade.bonusPerLevel,
        maxHours: CONFIG.offlineReward.maxHours,
      };
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, offlineGoldConfig);

      if (offlineGold > 0) {
        screens.hide();
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          refreshMenu();
        });
      } else {
        refreshMenu();
      }
```

- [ ] **Step 6: 전체 테스트 실행**

Run: `npm test -- --run`
Expected: PASS — 기존 65개 + Task 1의 8개 전부 그린. `screens.js`/`game.js`는 DOM/THREE 의존이라 단위 테스트 대상이 아니므로 이 실행은 "아무것도 안 깨졌는지" 확인용이다.

- [ ] **Step 7: 브라우저에서 직접 확인**

`npm run dev`로 로컬 서버를 띄우고:

1. 메인 메뉴 좌하단에 "공격력 Lv.0", 우하단에 "오프라인 Lv.0" 카드가 뜨는지 확인.
2. 브라우저 콘솔에서 `localStorage.setItem('shootshoot.gold', '10000')` 후 새로고침 → 두 카드 버튼이 `🪙 50 강화` / `🪙 80 강화`로 보이는지 확인.
3. "공격력" 카드의 강화 버튼을 눌러 골드가 줄고(9,950) 레벨이 "Lv.1"로 바뀌는지, 다음 비용이 올라가는지(≈58) 확인.
4. `localStorage.setItem('shootshoot.gold', '0')` 후 새로고침 → 두 카드 버튼이 `📺 무료강화`로 바뀌는지 확인. 눌러서 레벨이 골드 소비 없이 +1 되는지 확인.
5. 무기를 장착하고 원숭이를 쏴서 콘솔에 에러가 없는지, 사격이 정상 동작하는지 확인(공격력 강화가 데미지 계산에 섞여 들어가도 사격 흐름이 깨지지 않아야 한다).
6. 새로고침 후에도 두 레벨이 유지되는지 확인.

(이 세션에서 Browser pane 프리뷰가 동작하지 않는다면, 위 6가지를 사용자에게 직접 확인받는다 — 이전 태스크에서도 같은 방식으로 진행했다.)

- [ ] **Step 8: 커밋**

```bash
git add game/src/ui/screens.js game/src/gameplay/game.js
git commit -m "$(cat <<'EOF'
feat: wire damage/offline upgrades into gameplay and main menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
