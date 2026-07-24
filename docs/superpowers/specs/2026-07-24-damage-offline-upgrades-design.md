# 공격력 강화 + 오프라인 강화 (설계 문서)

- **날짜**: 2026-07-24
- **선행 작업**: [2026-07-23-weapon-purchase-design.md](2026-07-23-weapon-purchase-design.md)(원숭이 HP + 무기 상점, 이미 병합됨), [2026-07-22-weapon-purchase-handoff.md](2026-07-22-weapon-purchase-handoff.md)(참고 이미지 UI 요구사항 최초 언급)
- **후속 작업(이번 범위 밖)**: 참고 이미지 기반 메인 메뉴 전면 재배치는 계속 별도 스펙으로 남겨둔다. 이번 스펙은 그 이미지에 있던 "DAMAGE"/"OFFLINE" 두 업그레이드 카드만 구현한다.

## 1. 목표

메인 메뉴에 독립적인 두 업그레이드 카드를 추가한다:

- **공격력 강화**: 레벨당 고정 데미지를 장착 무기 데미지에 더한다. 무기를 사지 않아도 꾸준히 강해질 수 있는 수단.
- **오프라인 강화**: 오프라인 보상의 시간당 골드량을 늘린다.

두 카드 모두 골드로 레벨업하며, 골드가 부족하면 버튼이 "광고 보고 무료 강화"로 바뀐다. 레벨 상한은 없다.

이 기능은 이전 무기 구매 스펙의 비목표였던 "무기 레벨 업그레이드"(특정 무기 자체를 강화하는 것)와는 다르다 — 여기서는 무기와 무관하게 플레이어의 기본 공격력 자체를 올리는 별도 스탯을 추가한다.

## 2. 데이터 모델

### 2.1 저장

새 모듈 `game/src/gameplay/upgradeStore.js` (`weaponStore.js`와 같은 방어적 파싱 패턴):

```
createUpgradeStore(storage, key) -> {
  getDamageLevel(),   // 저장값 없거나 깨졌으면 0
  getOfflineLevel(),  // 저장값 없거나 깨졌으면 0
  levelUpDamage(),    // damageLevel += 1, 새 레벨 반환
  levelUpOffline(),   // offlineLevel += 1, 새 레벨 반환
}
```

저장 형식: `CONFIG.upgradeStorageKey = 'shootshoot.upgrades'` 키에 `{ "damageLevel": 0, "offlineLevel": 0 }` JSON. 값이 없거나 깨졌으면 `{ damageLevel: 0, offlineLevel: 0 }`으로 복구한다.

### 2.2 비용 공식

새 순수 함수 `computeUpgradeCost(level, config) -> number` (`upgradeStore.js`에 같이 둔다):

```
cost(level) = round(baseCost × costMultiplier ^ level)
```

`CONFIG`에 추가:

```js
damageUpgrade:  { baseCost: 50, costMultiplier: 1.15, bonusPerLevel: 1 },
offlineUpgrade: { baseCost: 80, costMultiplier: 1.2,  bonusPerLevel: 2 },
```

레벨 0(아직 한 번도 강화 안 함)일 때의 비용이 각각 50골드, 80골드이고, 레벨이 오를수록 15%/20%씩 비싸진다. 상한이 없으므로 이 비율이 사실상의 상한 역할을 한다.

## 3. 효과 적용

### 3.1 공격력 강화

`game.js`의 `handleShot()`에서 기존 `const weaponDamage = getEquippedWeapon().damage;`를 다음으로 바꾼다:

```js
const weaponDamage = getEquippedWeapon().damage + upgradeStore.getDamageLevel() * CONFIG.damageUpgrade.bonusPerLevel;
```

이후 `computeHitDamage(part, weaponDamage, CONFIG)` 호출은 그대로 — 헤드샷 배율은 강화 적용된 총 데미지에 곱해진다.

### 3.2 오프라인 강화

`game.js`가 `calculateOfflineGold`를 호출할 때 넘기는 설정을 다음으로 바꾼다:

```js
const offlineConfig = {
  goldPerHour: CONFIG.offlineReward.goldPerHour + upgradeStore.getOfflineLevel() * CONFIG.offlineUpgrade.bonusPerLevel,
  maxHours: CONFIG.offlineReward.maxHours,
};
const offlineGold = calculateOfflineGold(now - lastSeenAt, offlineConfig);
```

`calculateOfflineGold` 자체(`offlineReward.js`)는 변경하지 않는다 — 이미 순수하게 설정값만 받는 함수라 그대로 재사용 가능하다.

## 4. 레벨업 동작 (game.js)

두 업그레이드에 대해 각각 두 핸들러를 추가한다(공격력 기준, 오프라인도 동일 패턴):

```js
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
```

`refreshMenu()`는 현재 화면이 메인 메뉴일 때 `screens.showMenu(...)`를 최신 상태로 다시 호출하는 헬퍼로, 기존에 흩어져 있던 `screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get())` 반복 호출부를 이 함수 하나로 통합한다(아래 5절 참고).

버튼 텍스트/활성 상태는 UI 쪽(5절)에서 골드 잔액과 비용을 비교해 결정하고, `game.js`는 어느 액션이 눌렸는지만 받는다 — 상점 패널의 `handlers` 패턴과 동일하다.

## 5. UI: `screens.js` 리팩터링 + 카드 2개 추가

### 5.1 `showMenu` 시그니처 정리

현재 `showMenu(onStart, onSettings, onShop, onAdReward, gold)`는 인자 5개다. 이번에 레벨 2개, 비용 2개, 핸들러 4개(레벨업×2 + 광고강화×2)가 더 붙으면 위치 인자로는 관리가 안 되므로, 이 시점에 객체 파라미터로 정리한다:

```js
showMenu({
  gold,
  damageLevel, damageCost, canAffordDamage,
  offlineLevel, offlineCost, canAffordOffline,
}, {
  onStart, onSettings, onShop, onAdReward,
  onLevelUpDamage, onWatchAdDamage,
  onLevelUpOffline, onWatchAdOffline,
})
```

`showGameOver`/`showLoading`은 인자가 적어 그대로 둔다. `game.js`의 모든 `screens.showMenu(...)` 호출부(`returnToMenu`, `closeShop`, `closeSettings`, `closeAdReward`, 오프라인 보상 팝업 콜백, 레벨업 핸들러)를 이 새 시그니처로 맞추고, 상태 조립은 `buildMenuState()`라는 헬퍼 하나로 모은다(상점의 `buildShopState()`와 같은 패턴).

### 5.2 업그레이드 카드

참고 이미지대로 메인 메뉴 좌하단(공격력)·우하단(오프라인)에 작은 카드 2개를 추가한다. 각 카드:

- 제목("공격력" / "오프라인") + 현재 레벨("Lv.{n}")
- 골드 충분: `🪙 {cost} 강화` 버튼(주황, 상점 구매 버튼과 같은 스타일) → `onLevelUpDamage`/`onLevelUpOffline`
- 골드 부족: `📺 광고로 무료강화` 버튼(다른 색, 예: 하늘색 — 상점의 "장착하기" 버튼과 같은 outline 스타일) → `onWatchAdDamage`/`onWatchAdOffline`

두 카드 모두 상점의 `iconButton`/`goldBadge`와 마찬가지로 `screens.js` 안에 인라인 스타일로 만든다(현재 파일 전체가 이 방식이라 일관성 유지).

## 6. 인터페이스 변경 요약

| 파일 | 변경 |
|---|---|
| `game/src/config.js` | `CONFIG.damageUpgrade`, `CONFIG.offlineUpgrade`, `CONFIG.upgradeStorageKey` 추가 |
| `game/src/gameplay/upgradeStore.js` | **신규** — 레벨 저장 + `computeUpgradeCost` |
| `game/src/gameplay/offlineReward.js` | 변경 없음(호출부에서 조합한 설정을 그대로 받음) |
| `game/src/gameplay/game.js` | `upgradeStore` 연결, 데미지 계산에 강화분 합산, 오프라인 설정 조합, 레벨업/광고강화 핸들러 4개, `buildMenuState()`/`refreshMenu()` 추가 |
| `game/src/ui/screens.js` | `showMenu`를 객체 파라미터로 리팩터링, 좌하단/우하단 업그레이드 카드 2개 추가 |

## 7. 테스트

- `upgradeStore.test.js` (신규): 기본값 0, 레벨업 누적, 깨진 JSON 복구, `computeUpgradeCost`가 레벨 0/1/n에서 지수적으로 커지는지.
- `screens.js`는 기존 관행대로(DOM 의존) 단위 테스트 대상이 아니다 — 브라우저에서 두 카드가 뜨는지, 골드 충분/부족 상태에 따라 버튼이 바뀌는지, 강화 후 레벨·비용 표시가 갱신되는지 직접 확인한다.
- `game.js` 통합 동작(강화된 데미지가 실제로 `handleShot`에 반영되는지, 오프라인 골드 계산에 강화분이 들어가는지)은 `shooting.test.js`/기존 순수 함수 테스트에 케이스를 추가하는 대신, `computeUpgradeCost`·`upgradeStore`만 단위 테스트하고 나머지는 브라우저 확인으로 커버한다(기존 스펙의 관행과 동일 — HP/데미지 합산 로직 자체는 이미 `shooting.js`의 `computeHitDamage`가 순수 함수로 테스트되어 있고, 이번 변경은 그 앞단에서 숫자를 더하는 것뿐이라 새 순수 로직이 크지 않음).

## 8. 비목표 (YAGNI)

- 레벨 상한 — 무제한으로 둔다(비용 곡선이 사실상의 상한 역할).
- 공격력/오프라인 강화를 상점 캐러셀에 합치는 것 — 메인 메뉴 독립 카드로 유지.
- 강화 애니메이션/이펙트 — 레벨 숫자와 비용 텍스트만 갱신.
- 오프라인 강화의 `maxHours`(최대 적립 시간) 증가 — 이번엔 시간당 골드량만.
- 강화 레벨 초기화/환불.
- 개발용 골드 치트 — 여전히 localStorage 직접 수정으로 충분.

## 9. 열린 위험

- `screens.js`의 `showMenu` 시그니처 변경은 `game.js`의 호출부 6곳가량을 동시에 고쳐야 해서 구현 계획에서 한 태스크로 묶어야 한다(부분적으로 바꾸면 인자 순서가 깨진 채로 빌드된다).
- 광고 버튼이 "골드 부족일 때만" 나타나는 조건이라, 골드가 애매하게 걸쳐있는 상태(딱 비용만큼 있음)에서 버튼이 자주 바뀌는 게 어색해 보일 수 있다 — 실제로 확인 후 필요하면 임계값을 조정한다.
