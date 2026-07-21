# 광고 보상 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md), [2026-07-21-weapon-shop-design.md](2026-07-21-weapon-shop-design.md)
- **후속 작업(이번 범위 밖)**: 실제 Verse8 광고 SDK 연동(지금은 스텁), 바주카 무기 실제 구현(폭발/광역 피해 메커니즘).

## 1. 목표

메인 메뉴에서 광고를 시청하고 보상을 받는 화면을 만든다. 이번 범위에서는 골드 보상만 실제로 지급하고, 바주카는 상점의 "준비 중" 카드처럼 잠긴 자리로만 보여준다. 광고 SDK는 Verse8에서 나중에 제공할 예정이므로, 지금은 항상 성공하는 스텁으로 구현한다.

## 2. 아키텍처

### 2.1 광고 SDK 스텁

새 모듈 `game/src/gameplay/adSdk.js`:
```
showRewardedAd() -> Promise<boolean>
```
- 지금은 짧은 지연 후 항상 `true`(시청 완료)로 resolve하는 스텁이다.
- 이 함수 시그니처를 인터페이스 경계로 고정해서, 나중에 Verse8 SDK가 나오면 이 함수 내부 구현만 실제 SDK 호출로 교체하면 되고 호출부(`game.js`/UI)는 손댈 필요가 없게 한다.

### 2.2 골드 보상 규칙

- 광고 한 번 시청 완료 시 골드 30개 지급. `CONFIG.adReward = { goldAmount: 30 }`로 상수화한다.
- 하루 시청 횟수 제한 없음 — 몇 번이든 반복해서 볼 수 있다(실제 SDK 연동 시 대가/쿨다운 정책이 SDK 쪽에서 자연히 생길 수 있음 — 이번 범위에서는 다루지 않음).

### 2.3 상점 UI

새 모듈 `game/src/ui/adRewardPanel.js`:
```
createAdRewardPanel(container) -> { show(onClose: () => void, onWatchAd: () => Promise<void>) }
```
- `settingsPanel.js`/`shopPanel.js`와 동일한 전체 화면 오버레이 패턴.
- 화면 구성:
  - "골드 30개 받기" 버튼 — 클릭하면 비활성화되고 "광고 재생 중..."으로 문구가 바뀐 뒤, 스텁이 완료되면 자동으로 메인 메뉴로 복귀한다(별도의 "받기" 확인 단계 없이, 광고 시청 완료 자체가 보상 획득).
  - "바주카" 잠긴 카드(상점의 "준비 중" 카드와 같은 스타일, 클릭 불가).
  - "닫기" 버튼 — 광고를 보지 않고 메뉴로 돌아간다.

### 2.4 진입/복귀 흐름

- 메인 메뉴에 "광고 보상" 버튼 추가(기존 "시작하기"/"설정"/"상점" 옆). `screens.js`의 `showMenu`가 콜백 인자를 하나 더 받도록 확장한다.
- 플레이 중에는 접근하지 않는다 — 메인 메뉴에서만 진입.
- `game.js`에 `openAdRewardFromMenu()`/`closeAdReward()` 핸들러를 추가한다 — `openShopFromMenu`/`closeShop`과 동일한 패턴. "골드 30개 받기" 클릭 시 흐름:
  1. 버튼이 "광고 재생 중..."으로 바뀌고 비활성화된다.
  2. `adSdk.showRewardedAd()`를 호출한다.
  3. 완료(스텁은 항상 성공)되면 `currencyStore.earn(CONFIG.adReward.goldAmount)`로 골드를 지급하고, 메인 메뉴를 다시 보여준다(갱신된 골드가 표시됨).

## 3. 인터페이스 변경 요약

- `game/src/gameplay/adSdk.js` (신규): `showRewardedAd() -> Promise<boolean>`.
- `game/src/ui/adRewardPanel.js` (신규): `createAdRewardPanel(container) -> { show(onClose, onWatchAd) }`.
- `game/src/config.js`: `adReward: { goldAmount: 30 }` 추가.
- `game/src/ui/screens.js`: `showMenu`에 광고 보상 버튼용 콜백 인자 추가, "광고 보상" 버튼 추가.
- `game/src/gameplay/game.js`: `adRewardPanel` 인스턴스 생성, `openAdRewardFromMenu`/`closeAdReward` 핸들러 추가, 모든 `screens.showMenu(...)` 호출부에 인자 추가.

## 4. 비목표 (YAGNI)

- 바주카 실제 구현(폭발/광역 피해, 인벤토리, 사용 로직) — 잠긴 카드로만 표시.
- 실제 Verse8 광고 SDK 연동 — 이번 범위 밖, 스텁만 구현.
- 하루 시청 횟수 제한/쿨다운 — 만들지 않음.
- 광고 시청 실패(스킵/에러) 처리 — 스텁이 항상 성공하므로 이번 범위에서는 실패 경로를 다루지 않는다.

## 5. 열린 위험

- 골드 보상량(30개)과 무제한 시청은 초기 추정치 — 실제 SDK가 붙고 밸런스를 조정할 때 재검토가 필요할 수 있다.
- 스텁이 항상 성공만 하므로, 실제 SDK 연동 시 "시청 실패/중단" 처리 로직이 새로 필요해질 것 — 지금은 해당 분기가 없다는 것을 인지하고 넘어간다.
