# 게임 골드(재화) 시스템 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-21-aim-sensitivity-settings-design.md](2026-07-21-aim-sensitivity-settings-design.md)
- **후속 작업(이번 범위 밖)**: 무기 상점(골드로 총 구매), 오프라인 보상, 광고 보상 — 모두 이 골드 시스템을 기반으로 나중에 별도로 설계/구현한다.

## 1. 목표

플레이어가 게임을 플레이해서 얻은 점수를 "골드"라는 영구 재화로 전환해 누적 저장한다. 이 골드는 앞으로 만들 무기 상점 등에서 쓰일 기반이 된다.

## 2. 아키텍처

### 2.1 전환 규칙

- 게임오버 시점의 최종 점수를 기준으로 골드를 지급한다: `골드 = floor(점수 / 10)` — 점수 10점당 골드 1개, 소수점은 버림.
- `CONFIG.scorePerGold = 10`으로 상수화한다.

### 2.2 저장

새 모듈 `game/src/gameplay/currencyStore.js` — 최고점수 저장(`createHighScoreStore`)과 동일한 패턴의 순수 함수:
```
createCurrencyStore(storage, key) -> { get() -> number, earn(amount) -> number }
```
- `get()`: 저장된 총 골드를 반환(없으면 0).
- `earn(amount)`: 현재 골드에 `amount`를 더해 저장하고, 새 총액을 반환.
- `game.js`가 `window.localStorage`를 주입해서 사용한다(키: `shootshoot.gold`).

### 2.3 흐름 변경

- **획득 시점**: `endGame()`에서 `골드 = floor(scoreState.score / CONFIG.scorePerGold)`를 계산해 `currencyStore.earn(골드)`를 호출한다.
- **표시**: 메인 메뉴에 "보유 골드: N" 텍스트를 상시 표시한다(`screens.js`의 `showMenu`가 현재 골드 총액을 인자로 받아 표시).
- **게임오버 화면 버튼 변경**: 기존 "다시하기"(클릭 시 바로 새 라운드 시작) 버튼을 **"메인 메뉴로"**로 바꾼다 — 클릭하면 메인 메뉴로 돌아가고, 메뉴에는 방금 갱신된 골드 총액이 보인다. 새 라운드를 시작하려면 메뉴에서 다시 "시작하기"를 눌러야 한다(이 변경은 나중에 상점을 메인 메뉴에 붙일 자리를 만들기 위함이기도 하다).

## 3. 인터페이스 변경 요약

- `game/src/gameplay/currencyStore.js` (신규): `createCurrencyStore(storage, key) -> { get(), earn(amount) }`.
- `game/src/config.js`: `scorePerGold: 10`, `currencyStorageKey: 'shootshoot.gold'` 추가.
- `game/src/ui/screens.js`:
  - `showMenu(onStart, onSettings, gold)` — 세 번째 인자로 현재 골드를 받아 화면에 표시.
  - `showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu)` — 버튼 라벨 "다시하기" → "메인 메뉴로", 클릭 시 `onReturnToMenu` 호출(더 이상 즉시 재시작하지 않음).
- `game/src/gameplay/game.js`: `currencyStore` 생성/주입, `endGame()`에서 골드 지급, 게임오버 콜백을 "메인 메뉴로 돌아가기"로 교체(메뉴를 보여줄 때마다 `currencyStore.get()`으로 최신 골드를 넘김).

## 4. 비목표 (YAGNI)

- 무기 상점, 오프라인 보상, 광고 보상은 이번 범위 밖 — 골드 시스템만 구현.
- 골드 획득 애니메이션/이펙트(숫자 카운트업 등)는 만들지 않음 — 단순 텍스트 표시.
- 라운드 중간에 골드를 부분적으로 지급하는 기능은 만들지 않음 — 게임오버 시점에 한 번만 지급.

## 5. 열린 위험

- 전환 비율(10점=1골드)은 상점 아이템 가격이 아직 정해지지 않은 상태에서의 추정치 — 나중에 무기 상점을 설계할 때 아이템 가격과 함께 재조정이 필요할 수 있다.
