# 무기 상점 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md), [2026-07-21-ammo-count-design.md](2026-07-21-ammo-count-design.md)
- **후속 작업(이번 범위 밖)**: 실제 구매 가능한 무기/업그레이드(현재 저격총의 데미지 레벨 업그레이드 형태로 예정), 무기 데미지가 점수 배율에 실제로 반영되는 로직, 새 총 3D 모델 에셋 확보.

## 1. 목표

메인 메뉴에서 진입할 수 있는 "무기 상점" 화면을 만든다. 이번 범위에서는 화면 구조와 진입/복귀 흐름만 만들고, 실제로 구매할 수 있는 상품은 없다("준비 중" 잠금 상태로만 보여줌) — 다음에 새 총 에셋이 생기거나 업그레이드 시스템을 설계할 때 이 화면에 채워 넣는다.

## 2. 아키텍처

### 2.1 데미지 스탯의 의미 (참고용, 이번 범위에는 미반영)

현재 게임은 원숭이가 HP 없이 한 발이라도 맞으면 즉사한다(머리/몸통 구분은 점수 배율만 다름, `resolveShot`/`calculateShotScore` 로직 변경 없음). 향후 무기의 "데미지"는 명중/즉사 여부에는 영향을 주지 않고, 점수 배율 차이로만 작동할 예정이다. 이번 스펙에서는 실제 구현하지 않고 다음 단계(실제 구매 가능한 무기가 생길 때)를 위한 설계 방향으로만 남겨둔다.

### 2.2 상점 UI

새 모듈 `game/src/ui/shopPanel.js`:
```
createShopPanel(container) -> { show(onClose), hide() }
```
- `settingsPanel.js`와 같은 패턴(전체 화면을 덮는 오버레이, 닫기 콜백을 받아 호출).
- 화면 구성:
  - "장착 중: 저격총" 카드 1개(항상 표시, 현재 유일한 무기).
  - "준비 중" 회색 잠금 카드 2개 — 특정 총 이름 없이 자리만 표시(클릭 불가, 향후 확장 자리).
  - 닫기 버튼 — 누르면 `onClose` 호출.

### 2.3 진입/복귀 흐름

- 메인 메뉴에 "상점" 버튼 추가(기존 "시작하기"/"설정" 옆). `screens.js`의 `showMenu(onStart, onSettings, onShop, gold)`로 시그니처를 확장한다.
- 플레이 중에는 접근하지 않는다 — 메인 메뉴에서만 진입(설정 패널의 P 키 같은 플레이 중 접근은 만들지 않음).
- `game.js`에 `openShopFromMenu()`/`closeShop()` 핸들러를 추가한다. `openShopFromMenu()`는 메뉴를 숨기고 `shopPanel.show(closeShop)`를 호출하고, `closeShop()`은 `shopPanel.hide()` 후 다시 `screens.showMenu(...)`로 메뉴를 보여준다 — `openSettingsFromMenu`/`closeSettings`와 동일한 패턴이며, 서로 독립적으로 동작한다(상점이 열려 있는 동안 설정 버튼은 안 보이고, 그 반대도 마찬가지 — 메뉴가 완전히 가려지므로 자연히 배타적이다).

## 3. 인터페이스 변경 요약

- `game/src/ui/shopPanel.js` (신규): `createShopPanel(container) -> { show(onClose), hide() }`.
- `game/src/ui/screens.js`: `showMenu(onStart, onSettings, onShop, gold)` — 세 번째 자리에 `onShop` 콜백 추가(순서: `onStart, onSettings, onShop, gold`), "상점" 버튼 추가.
- `game/src/gameplay/game.js`: `shopPanel` 인스턴스 생성, `openShopFromMenu`/`closeShop` 핸들러 추가, 모든 `screens.showMenu(...)` 호출부에 `openShopFromMenu` 인자 추가.

## 4. 비목표 (YAGNI)

- 실제 구매 가능한 무기/업그레이드 — 이번 범위 밖(잠긴 자리만 표시).
- 데미지 스탯이 점수 배율에 실제로 반영되는 로직 — 이번 범위 밖.
- 무기 전환/장착 로직 — 총이 하나뿐이라 전환 개념 자체가 없음.
- 플레이 중 상점 접근(단축키 등) — 만들지 않음, 메뉴에서만 진입.
- 새 총 3D 모델 에셋 확보 — 이번 범위 밖.

## 5. 열린 위험

- 없음 — 이번 범위는 UI 틀만 다루므로 실제 게임플레이/밸런스에 영향을 주는 위험 요소가 없다.
