# 광고로 얻는 바주카포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 메뉴 우측 중앙에 "광고 보고 바주카포 5발 획득" 카드를 추가하고, 바주카포가 활성 상태일 때 사격이 명중 지점 반경 안의 원숭이를 HP 무관하게 전부 즉사시키도록 만든다.

**Architecture:** 새 저장소(`bazookaStore.js`)가 남은 발수를 추적한다. `targetManager.js`에 반경 탐색 함수를 추가한다. `game.js`의 `handleShot()`을 얇은 라우터로 바꾸고, 기존 로직은 `handleWeaponShot()`으로 옮기고, 새 `handleBazookaShot()`을 추가한다. 두 경로가 공유하는 꼬리 로직(효과음/팝업/HUD/미스판정)과 타워 붕괴 로직은 공용 헬퍼로 뽑아 중복을 없앤다. `screens.js`에 카드 하나를 추가한다.

**Tech Stack:** Vanilla JS (ES modules), Vitest, Three.js, 기존 `currencyStore`/`weaponStore` 저장 패턴 재사용.

## Global Constraints

- 바주카포는 광고로만 얻는다(골드 구매 경로 없음), 탄약이 1발이라도 남아있으면 다시 얻을 수 없다(0발일 때만 획득 카드가 활성화).
- 명중/빗나감 관계없이 사격할 때마다 1발 소모된다. 0발이 되면 자동으로 원래 장착 무기로 복귀한다(모델도 교체).
- 폭발 반경 안 원숭이는 HP 무관하게 즉사(`monkey.kill()` 재사용), 헤드샷 개념 없음(전부 `part: 'body'`).
- 기둥(pillar)을 직접 맞히면 기존과 동일하게 붕괴+보너스 처리하지만, 폭발 자체가 구조물을 추가로 부수지는 않는다.
- `finishShot`/`applyTowerCollapse` 공용 헬퍼로 뽑는 리팩터링은 기존 무기 사격 경로의 동작을 **한 치도 바꾸지 않아야 한다** — 특히 효과음 분기의 `hitTowerIndex !== null` 조건(관통으로 원숭이를 죽이면서 동시에 기둥을 맞혀도 `sfx.hit()`가 우선되는 기존 동작)을 그대로 유지한다.
- 3D 모델은 아직 없다 — `CONFIG.bazooka.weapon.model`은 자리표시자 경로(`/models/bazooka.fbx`)로 둔다. 이 플랜의 Task 1~2는 모델 파일 없이도 완결된 기능(스토어, 타겟팅, 게임 로직, UI)을 만든다. 모델 실측·배치 확정은 사용자가 파일을 제공한 뒤 별도 후속 작업으로 진행한다(계획 마지막 안내 참고).
- 참고 스펙: [docs/superpowers/specs/2026-07-24-bazooka-ad-weapon-design.md](../specs/2026-07-24-bazooka-ad-weapon-design.md)

---

## Task 1: `bazookaStore.js` — 탄약 저장

**Files:**
- Modify: `game/src/config.js`
- Create: `game/src/gameplay/bazookaStore.js`
- Test: `test/bazookaStore.test.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈, `currencyStore.js`와 동일하게 CONFIG에 결합하지 않는다 — `maxRounds`는 호출부가 `refill()`에 넘긴다)
- Produces:
  - `createBazookaStore(storage, key) -> { getRounds(): number, refill(maxRounds: number): number, consumeRound(): number, reset(): number }`
  - `CONFIG.bazooka = { maxRounds: 5, blastRadius: 6, weapon: { id: 'bazooka', name: '바주카포', model: '/models/bazooka.fbx', format: 'fbx', scale: 0.001, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 } } }`
  - `CONFIG.bazookaStorageKey = 'shootshoot.bazooka'`

- [ ] **Step 1: `CONFIG`에 바주카포 설정 추가**

`game/src/config.js`에서 다음 블록을 찾는다:

```js
  offlineUpgrade: {
    baseCost: 80,
    costMultiplier: 1.2,
    bonusPerLevel: 2,
  },
  weapons: [
```

다음으로 바꾼다(`offlineUpgrade`와 `weapons` 사이에 삽입):

```js
  offlineUpgrade: {
    baseCost: 80,
    costMultiplier: 1.2,
    bonusPerLevel: 2,
  },
  bazooka: {
    maxRounds: 5,
    blastRadius: 6,
    weapon: {
      id: 'bazooka', name: '바주카포', model: '/models/bazooka.fbx', format: 'fbx',
      scale: 0.001, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
    },
  },
  weapons: [
```

그리고 파일 끝부분에서 다음을 찾는다:

```js
  upgradeStorageKey: 'shootshoot.upgrades',
};
```

다음으로 바꾼다:

```js
  upgradeStorageKey: 'shootshoot.upgrades',
  bazookaStorageKey: 'shootshoot.bazooka',
};
```

- [ ] **Step 2: 실패하는 테스트 작성**

`test/bazookaStore.test.js` 생성:

```js
import { describe, it, expect } from 'vitest';
import { createBazookaStore } from '../game/src/gameplay/bazookaStore.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

describe('createBazookaStore', () => {
  it('returns 0 when nothing stored', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.getRounds()).toBe(0);
  });

  it('refill() sets rounds to the given max and returns it', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.refill(5)).toBe(5);
    expect(store.getRounds()).toBe(5);
  });

  it('consumeRound() decrements and returns the new value', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    store.refill(5);
    expect(store.consumeRound()).toBe(4);
    expect(store.getRounds()).toBe(4);
  });

  it('consumeRound() never goes below 0', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    expect(store.consumeRound()).toBe(0);
    expect(store.consumeRound()).toBe(0);
  });

  it('reset() forces rounds to 0 and returns 0', () => {
    const store = createBazookaStore(createMemoryStorage(), 'test.bazooka');
    store.refill(5);
    expect(store.reset()).toBe(0);
    expect(store.getRounds()).toBe(0);
  });

  it('persists across separate store instances sharing the same storage/key', () => {
    const storage = createMemoryStorage();
    const first = createBazookaStore(storage, 'test.bazooka');
    first.refill(5);
    first.consumeRound();
    const second = createBazookaStore(storage, 'test.bazooka');
    expect(second.getRounds()).toBe(4);
  });

  it('recovers from a malformed stored value', () => {
    const storage = createMemoryStorage();
    storage.setItem('test.bazooka', 'not-a-number');
    const store = createBazookaStore(storage, 'test.bazooka');
    expect(store.getRounds()).toBe(0);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- --run test/bazookaStore.test.js`
Expected: FAIL — `Cannot find module '../game/src/gameplay/bazookaStore.js'`

- [ ] **Step 4: `bazookaStore.js` 구현**

`game/src/gameplay/bazookaStore.js` 생성:

```js
export function createBazookaStore(storage, key) {
  function read() {
    const raw = storage.getItem(key);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isNaN(value) ? 0 : value;
  }

  function write(rounds) {
    storage.setItem(key, String(rounds));
  }

  return {
    getRounds() {
      return read();
    },
    refill(maxRounds) {
      write(maxRounds);
      return maxRounds;
    },
    consumeRound() {
      const next = Math.max(read() - 1, 0);
      write(next);
      return next;
    },
    reset() {
      write(0);
      return 0;
    },
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- --run`
Expected: PASS — 기존 74개 + 새 `bazookaStore.test.js` 7개, 전체 그린.

- [ ] **Step 6: 커밋**

```bash
git add game/src/config.js game/src/gameplay/bazookaStore.js test/bazookaStore.test.js
git commit -m "$(cat <<'EOF'
feat: add bazooka ammo store and config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 폭발 타격 로직 + 메인 메뉴 UI

**Files:**
- Modify: `game/src/gameplay/targetManager.js`
- Modify: `game/src/gameplay/game.js`
- Modify: `game/src/ui/screens.js`

**Interfaces:**
- Consumes: Task 1의 `createBazookaStore`, `CONFIG.bazooka`, `CONFIG.bazookaStorageKey`. 기존 `monkey.kill() -> boolean`, `monkey.getWorldPosition() -> Vector3`, `monkey.isDying() -> boolean`, `obstacles.collapseTower(towerIndex)`, `targetManager.findMonkeyAtTower(towerIndex)`, `swapWeaponViewmodel(weapon) -> Promise`, `showRewardedAd() -> Promise<boolean>`, `calculateShotScore`/`applyShot`(scoring.js).
- Produces:
  - `targetManager.findMonkeysWithinRadius(worldPoint, radius) -> Monkey[]`
  - `game.js`의 `handleShot()`이 바주카포 활성 여부(`bazookaStore.getRounds() > 0`)로 `handleWeaponShot`/`handleBazookaShot`을 라우팅.
  - `screens.showMenu(state, handlers)`의 `state`에 `bazookaRounds` 추가, `handlers`에 `onWatchAdBazooka` 추가.

- [ ] **Step 1: `targetManager.js`에 반경 탐색 함수 추가**

`game/src/gameplay/targetManager.js`에서 다음을 찾는다:

```js
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
```

다음으로 바꾼다:

```js
  function hasAliveMonkeys() {
    return monkeys.some((monkey) => !monkey.isDying());
  }

  function findMonkeysWithinRadius(worldPoint, radius) {
    return monkeys.filter((monkey) => {
      if (monkey.isDying()) return false;
      return monkey.getWorldPosition().distanceTo(worldPoint) <= radius;
    });
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
    findMonkeysWithinRadius,
  };
```

`getWorldPosition()`을 인자 없이 호출하므로(`monkey.js`가 기본값으로 새 `THREE.Vector3()`를 만든다) `targetManager.js`에 `three` import를 추가할 필요가 없다.

- [ ] **Step 2: `game.js`에 `bazookaStore` import 및 인스턴스 추가**

`game/src/gameplay/game.js`에서 다음을 찾는다:

```js
import { createUpgradeStore, computeUpgradeCost } from './upgradeStore.js';
import { createEffects } from './effects.js';
```

다음으로 바꾼다:

```js
import { createUpgradeStore, computeUpgradeCost } from './upgradeStore.js';
import { createBazookaStore } from './bazookaStore.js';
import { createEffects } from './effects.js';
```

다음을 찾는다:

```js
  const upgradeStore = createUpgradeStore(window.localStorage, CONFIG.upgradeStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
```

다음으로 바꾼다:

```js
  const upgradeStore = createUpgradeStore(window.localStorage, CONFIG.upgradeStorageKey);
  const bazookaStore = createBazookaStore(window.localStorage, CONFIG.bazookaStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
```

- [ ] **Step 3: 메뉴 상태/핸들러에 바주카포 추가**

다음을 찾는다:

```js
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
```

다음으로 바꾼다:

```js
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
      bazookaRounds: bazookaStore.getRounds(),
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
    onWatchAdBazooka: watchAdForBazooka,
  };
```

- [ ] **Step 4: 바주카포 획득 핸들러 추가**

다음을 찾는다:

```js
  function watchAdForOfflineUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpOffline();
      refreshMenu();
    });
  }
```

다음으로 바꾼다(기존 함수 뒤에 새 함수를 이어 붙인다):

```js
  function watchAdForOfflineUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpOffline();
      refreshMenu();
    });
  }

  function watchAdForBazooka() {
    showRewardedAd().then((success) => {
      if (!success) {
        refreshMenu();
        return;
      }
      bazookaStore.refill(CONFIG.bazooka.maxRounds);
      swapWeaponViewmodel(CONFIG.bazooka.weapon)
        .catch(() => {
          // 모델 로드 실패 시 탄약을 롤백해서 "장착은 안 됐는데 폭발 로직만 활성"인
          // 불일치 상태를 막는다.
          bazookaStore.reset();
        })
        .finally(() => refreshMenu());
    });
  }
```

- [ ] **Step 5: `handleShot()`을 리팩터링하고 바주카포 경로 추가**

다음 전체 블록을 찾는다(`function handleShot()`부터 그 닫는 `}`까지):

```js
  function handleShot() {
    if (phase !== 'playing') return;
    sfx.shoot();
    weaponViewmodel.triggerRecoil();
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
    const weaponDamage = getEquippedWeapon().damage + upgradeStore.getDamageLevel() * CONFIG.damageUpgrade.bonusPerLevel;

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

    if (hitTowerIndex !== null) {
      obstacles.collapseTower(hitTowerIndex);
      const towerMonkey = targetManager.findMonkeyAtTower(hitTowerIndex);
      if (towerMonkey && !towerMonkey.isDying()) {
        const worldPos = towerMonkey.getWorldPosition();
        effects.spawnHitBurst(worldPos);
        towerMonkey.kill();
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
    } else if (effectiveOutcome.hits[0]?.part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }

    if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
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

**정확히 이 블록 전체**를 다음으로 교체한다:

```js
  function applyTowerCollapse(hitTowerIndex) {
    obstacles.collapseTower(hitTowerIndex);
    const towerMonkey = targetManager.findMonkeyAtTower(hitTowerIndex);
    if (towerMonkey && !towerMonkey.isDying()) {
      const worldPos = towerMonkey.getWorldPosition();
      effects.spawnHitBurst(worldPos);
      towerMonkey.kill();
      scoreState = { ...scoreState, score: scoreState.score + CONFIG.score.towerCollapseBonus };
      const screenPos = worldToScreen(worldPos, engine.camera, container);
      hud.showScorePopup(`+${CONFIG.score.towerCollapseBonus}`, screenPos.x, screenPos.y);
    }
  }

  function finishShot({ effectiveOutcome, gained, popupWorldPosition, isPureTowerHit }) {
    if (!effectiveOutcome.isMiss && !targetManager.hasAliveMonkeys()) {
      lastKillEffect.trigger();
    }

    if (isPureTowerHit) {
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

    if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y);
    }

    updateHud();

    if (scoreState.misses >= CONFIG.missLimit) {
      endGame();
    }
  }

  function handleWeaponShot(intersections) {
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
    const weaponDamage = getEquippedWeapon().damage + upgradeStore.getDamageLevel() * CONFIG.damageUpgrade.bonusPerLevel;

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

    if (hitTowerIndex !== null) {
      applyTowerCollapse(hitTowerIndex);
    }

    finishShot({
      effectiveOutcome,
      gained,
      popupWorldPosition,
      isPureTowerHit: hitTowerIndex !== null,
    });
  }

  function handleBazookaShot(intersections) {
    const first = intersections[0];
    const hitTowerIndex = first && first.object.userData.towerIndex !== undefined
      ? first.object.userData.towerIndex
      : null;

    const killedHits = [];
    let popupWorldPosition = null;

    if (first) {
      if (hitTowerIndex !== null) {
        applyTowerCollapse(hitTowerIndex);
      }
      const nearby = targetManager.findMonkeysWithinRadius(first.point, CONFIG.bazooka.blastRadius);
      for (const monkey of nearby) {
        if (!monkey.kill()) continue;
        const worldPos = monkey.getWorldPosition();
        if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
        effects.spawnHitBurst(worldPos, 0xff6600);
        killedHits.push({ monkeyId: monkey.id, part: 'body' });
      }
    }

    const effectiveOutcome = {
      isMiss: killedHits.length === 0 && hitTowerIndex === null,
      penetrationCount: killedHits.length,
      hits: killedHits,
    };
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    if (bazookaStore.consumeRound() === 0) {
      swapWeaponViewmodel(getEquippedWeapon()).catch(() => {});
    }

    finishShot({
      effectiveOutcome,
      gained,
      popupWorldPosition,
      isPureTowerHit: hitTowerIndex !== null,
    });
  }

  function handleShot() {
    if (phase !== 'playing') return;
    sfx.shoot();
    weaponViewmodel.triggerRecoil();
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const raycastTargets = [
      ...targetManager.getRaycastMeshes(),
      ...obstacles.getBlockingMeshes(),
      ...obstacles.getPillarMeshes(),
    ];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

    if (bazookaStore.getRounds() > 0) {
      handleBazookaShot(intersections);
    } else {
      handleWeaponShot(intersections);
    }
  }
```

**주의**: `handleWeaponShot`은 원래 `handleShot`의 로직과 정확히 동일해야 한다(꼬리 부분만 `finishShot` 호출로 대체) — `isPureTowerHit`이라는 이름의 지역 변수가 두 가지 다른 의미로 쓰인다: `effectiveOutcome`을 강제하는 지역 변수(`hits.length === 0 && hitTowerIndex !== null`, 기존 그대로)와 `finishShot`에 넘기는 인자(`hitTowerIndex !== null`, 더 넓은 조건, 기존 효과음 분기와 동일)는 **다른 값**이다. 이 둘을 섞으면 관통으로 원숭이를 죽이면서 동시에 기둥을 맞힌 경우의 효과음이 바뀐다.

- [ ] **Step 6: 부팅 시 바주카포 상태 복원**

다음을 찾는다:

```js
    ]).then(([monkeyModel, resolvedWeaponViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, resolvedObstacles.getTowerSlots());
      weaponViewmodel = resolvedWeaponViewmodel;
      obstacles = resolvedObstacles;

      const now = Date.now();
```

다음으로 바꾼다:

```js
    ]).then(([monkeyModel, resolvedWeaponViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, resolvedObstacles.getTowerSlots());
      weaponViewmodel = resolvedWeaponViewmodel;
      obstacles = resolvedObstacles;

      if (bazookaStore.getRounds() > 0) {
        swapWeaponViewmodel(CONFIG.bazooka.weapon).catch(() => {});
      }

      const now = Date.now();
```

- [ ] **Step 7: `screens.js`에 우측 중앙 바주카포 카드 추가**

`game/src/ui/screens.js`에서 다음을 찾는다:

```js
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
```

다음으로 바꾼다:

```js
  function showMenu(state, handlers) {
    const { gold, damageLevel, damageCost, canAffordDamage, offlineLevel, offlineCost, canAffordOffline, bazookaRounds } = state;
    clear();

    // 좌측 중앙: 상점 아이콘
    const shopBtn = iconButton('/icons/cart.png', '상점', handlers.onShop, 56);
    shopBtn.style.position = 'absolute';
    shopBtn.style.left = '20px';
    shopBtn.style.top = '50%';
    shopBtn.style.transform = 'translateY(-50%)';
    overlay.appendChild(shopBtn);

    // 우측 중앙: 바주카포 카드
    const bazookaCard = document.createElement('div');
    bazookaCard.style.cssText = `
      position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
      width: 150px; background: rgba(0,0,0,0.45); border: 2px solid #f0a500;
      border-radius: 14px; padding: 14px; text-align: center;
    `;
    const bazookaTitle = document.createElement('div');
    bazookaTitle.textContent = '바주카포';
    bazookaTitle.style.cssText = 'font-size: 16px; font-weight: bold; color: #f0a500; margin-bottom: 8px;';
    bazookaCard.appendChild(bazookaTitle);
    if (bazookaRounds > 0) {
      const roundsEl = document.createElement('div');
      roundsEl.textContent = `${bazookaRounds}/5`;
      roundsEl.style.cssText = 'font-size: 18px; color: #ccc;';
      bazookaCard.appendChild(roundsEl);
    } else {
      const getBtn = document.createElement('button');
      getBtn.textContent = '📺 획득';
      getBtn.style.cssText = `
        width: 100%; border: 1px solid #7ec8e3; border-radius: 8px; padding: 8px 0;
        font-size: 15px; font-weight: bold; cursor: pointer;
        background: transparent; color: #7ec8e3;
      `;
      getBtn.addEventListener('click', handlers.onWatchAdBazooka);
      bazookaCard.appendChild(getBtn);
    }
    overlay.appendChild(bazookaCard);
```

- [ ] **Step 8: 전체 테스트 실행**

Run: `npm test -- --run`
Expected: PASS — 81개 전부 그린(기존 74 + Task 1의 7). `targetManager.js`/`game.js`/`screens.js`는 이 프로젝트 관행대로 THREE/DOM 의존이라 단위 테스트 대상이 아니므로, 이 실행은 회귀 확인용이다.

- [ ] **Step 9: 브라우저에서 직접 확인**

`npm run dev` 후:

1. 골드/탄약 없이 새로고침 → 메인 메뉴 우측 중앙에 "바주카포 / 📺 획득" 카드가 뜨는지 확인.
2. 카드를 클릭 → 광고 시청(모의 SDK는 0.5초 후 자동 성공) 후 카드가 "5/5"로 바뀌는지 확인.
3. **바주카포 모델 파일이 아직 없으므로 뷰모델 교체는 실패할 수 있다** — 콘솔에 모델 로드 실패 로그가 떠도 정상이다. 이 경우 `bazookaStore.reset()`이 호출되어 카드가 다시 "📺 획득"으로 돌아가는지 확인(§ 롤백 동작 검증).
4. 롤백 동작을 우회해서 로직만 확인하려면, 브라우저 콘솔에서 `localStorage.setItem('shootshoot.bazooka', '5')` 후 새로고침 — 뷰모델 교체는 여전히 실패하지만(모델 없음) `bazookaStore`의 탄약 값 자체는 5로 유지되는지, 사격 시(원숭이 조준 후 클릭) 탄약이 줄어드는지, 반경 안 여러 마리가 동시에 죽는지(HP가 높은 라운드에서도 즉사하는지) 확인.
5. 5발을 다 쓰면 원래 무기로 자동 복귀하고 카드가 "📺 획득"으로 바뀌는지 확인.
6. 일반 무기(바주카포 비활성 상태)로 사격했을 때 기존과 똑같이 동작하는지(점수, 스트릭, 타워 붕괴, 콤보 효과음) 확인 — 리팩터링이 기존 동작을 안 바꿨는지가 핵심 검증 포인트.

(이 세션에서 Browser pane 프리뷰가 동작하지 않는다면, 위 항목들을 사용자에게 직접 확인받는다.)

- [ ] **Step 10: 커밋**

```bash
git add game/src/gameplay/targetManager.js game/src/gameplay/game.js game/src/ui/screens.js
git commit -m "$(cat <<'EOF'
feat: add bazooka blast targeting, shot routing, and menu card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 모델 파일 관련 후속 작업 (이 플랜의 범위 밖)

바주카포 3D 모델(`game/public/models/bazooka.fbx` 또는 사용자가 지정하는 다른 파일)이 아직 없다. 사용자가 파일을 제공하면:

1. `tools/measure-weapons.mjs` 패턴으로 새 모델을 실측해 권장 `scale` 계산.
2. `CONFIG.bazooka.weapon`의 `model`/`scale`/`position`(필요하면 `rotation`)을 실측값으로 업데이트.
3. 브라우저에서 실제로 장착해보고 위치/크기가 자연스러운지 확인(이전 무기 4종 튜닝 때와 동일한 방식).

이 세 단계는 파일이 없는 지금 시점에 태스크로 확정할 수 없어 별도로 진행한다.
