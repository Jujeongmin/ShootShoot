# 오프라인 보상 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md)

## 1. 목표

플레이어가 게임을 켜지 않고 있던 시간(오프라인 시간)에 비례해 골드를 지급한다. 재접속 시 팝업으로 알려주고 "받기" 버튼을 눌러야 실제로 지급된다.

## 2. 아키텍처

### 2.1 적립 규칙

- 오프라인 시간당 골드 10개, 최대 8시간(80골드)까지만 인정한다 — 그 이상 오래 자리를 비워도 추가 적립은 없다.
- `CONFIG.offlineReward = { goldPerHour: 10, maxHours: 8 }`로 상수화한다.
- 계산식: `골드 = floor(min(경과시간(시간 단위), maxHours) × goldPerHour)`.

### 2.2 마지막 접속 시각 저장

새 모듈 `game/src/gameplay/offlineReward.js`에 두 가지를 둔다:
- 순수 계산 함수 `calculateOfflineGold(elapsedMs, config) -> number` — 위 계산식을 그대로 구현, 테스트 가능.
- 저장소 팩토리 `createLastSeenStore(storage, key) -> { get() -> number|null, set(timestamp) }` — 기존 `currencyStore`/`highScoreStore`와 동일한 패턴. `get()`은 저장된 적이 없으면 `null`을 반환한다(최초 실행 판별용).
- `game.js`가 `window.localStorage`를 주입해서 사용한다(키: `shootshoot.lastseen`).

### 2.3 부팅 시 처리 흐름

`game.js`의 `start()`가 로딩(모델/에셋 로드)을 마친 직후, 메뉴를 보여주기 전에 한 번만 처리한다:

1. `lastSeenStore.get()`으로 마지막 접속 시각을 읽는다.
2. **즉시** `lastSeenStore.set(현재 시각)`으로 갱신한다 — 팝업을 실제로 열고 "받기"를 누르는지와 무관하게, 이 시점에 기준 시각을 리셋해서 새로고침을 반복해도 중복 적립되지 않게 한다.
3. 읽은 값이 `null`(최초 실행)이면 팝업 없이 바로 메뉴를 보여준다.
4. 값이 있으면 `calculateOfflineGold(현재시각 - 마지막접속시각, CONFIG.offlineReward)`로 골드를 계산한다.
   - 0이면(경과 시간이 너무 짧아 골드가 1개도 안 됨) 팝업 없이 바로 메뉴를 보여준다.
   - 0보다 크면 메뉴 대신 오프라인 보상 팝업을 먼저 보여준다. "받기"를 누르면 `currencyStore.earn(골드)`를 호출해 실제로 지급하고, 그 다음 메뉴를 보여준다(메뉴에는 갱신된 골드가 표시됨).
- 이 체크는 게임을 새로 로드(브라우저에서 페이지를 열거나 새로고침)할 때 딱 한 번만 일어난다 — 같은 세션 안에서 게임오버 후 메인 메뉴로 돌아가는 것은 다시 체크하지 않는다.

### 2.4 팝업 UI

새 모듈 `game/src/ui/offlineRewardPopup.js`:
```
createOfflineRewardPopup(container) -> { show(goldAmount: number, onClaim: () => void) }
```
- `settingsPanel.js`/`shopPanel.js`와 동일한 전체 화면 오버레이 패턴.
- "자리를 비운 사이 골드 N개를 모았습니다!" 문구 + "받기" 버튼. 버튼을 누르면 `onClaim()`을 호출하고 팝업을 닫는다.

## 3. 인터페이스 변경 요약

- `game/src/gameplay/offlineReward.js` (신규): `calculateOfflineGold(elapsedMs, config) -> number`, `createLastSeenStore(storage, key) -> { get(), set(timestamp) }`.
- `game/src/ui/offlineRewardPopup.js` (신규): `createOfflineRewardPopup(container) -> { show(goldAmount, onClaim) }`.
- `game/src/config.js`: `offlineReward: { goldPerHour: 10, maxHours: 8 }`, `lastSeenStorageKey: 'shootshoot.lastseen'` 추가.
- `game/src/gameplay/game.js`: `lastSeenStore`/`offlineRewardPopup` 인스턴스 생성, `start()`의 부팅 흐름(로딩 완료 → 메뉴 표시 직전)에 위 2.3 로직 삽입.

## 4. 비목표 (YAGNI)

- 오프라인 중에도 게임이 실제로 진행되는 것처럼 보이는 연출(가짜 라운드 진행 등)은 만들지 않음 — 단순 시간 경과 기반 골드 지급.
- 오프라인 보상 배율을 올려주는 아이템/광고(예: "광고 보고 2배 받기")는 이번 범위 밖 — 광고 보상은 별도 기능으로 진행 예정.
- 여러 탭/기기 동기화는 다루지 않음 — `localStorage`는 브라우저(기기) 로컬 저장소이므로 기존 골드/최고점수 시스템과 동일한 한계를 그대로 따른다.
- 최초 실행 시 팝업을 띄우는 옵션은 만들지 않음 — 항상 조용히 기준 시각만 기록.

## 5. 열린 위험

- 적립률(시간당 10골드, 최대 8시간)은 초기 추정치 — 실제 플레이 리듬에 맞춰 나중에 조정할 수 있다.
- `Date.now()`는 사용자가 시스템 시계를 되돌리면 음수 경과시간이 나올 수 있다 — `calculateOfflineGold`는 `elapsedMs`가 음수면 0을 반환하도록 방어적으로 구현한다(악용을 막기 위한 것이 아니라 단순 클라이언트 게임이므로 크래시 방지 수준의 처리).
