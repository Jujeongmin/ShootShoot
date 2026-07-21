# 스테이지 전환 배너 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md)

## 1. 목표

라운드(스테이지)를 클리어하고 다음 라운드로 넘어갈 때, 화면 중앙에 "STAGE N" 텍스트가 잠깐 나타났다 사라지는 연출을 추가한다.

## 2. 아키텍처

### 2.1 배너 UI

새 모듈 `game/src/ui/stageBanner.js`:
```
createStageBanner(container) -> { show(stageNumber) }
```
- 화면 중앙에 큰 "STAGE N" 텍스트를 생성해 붙인 뒤, 페이드인(0.3초) → 잠깐 유지 → 페이드아웃(0.3초), 총 약 1초 후 DOM에서 제거한다.
- `pointer-events: none`이라 클릭을 가로막지 않는다 — 배너가 떠 있는 동안에도 플레이(조준/발사)는 그대로 계속된다. 게임 로직을 멈추는 별도의 일시정지 상태는 만들지 않는다.
- 매번 `show()`를 호출할 때마다 새 엘리먼트를 만들고 스스로 타이머로 제거하므로, 연속으로 여러 번 불려도(예: 매우 빠르게 라운드를 깰 때) 서로 충돌하지 않는다.

### 2.2 트리거 시점

`game.js`의 라운드 클리어 처리 지점(틱 루프의 `targetManager.allCleared()` 분기, `sfx.roundClear()` 및 `beginRound(round + 1)`가 호출되는 바로 그 자리)에서 `stageBanner.show(round + 1)`을 함께 호출한다.

## 3. 인터페이스 변경 요약

- `game/src/ui/stageBanner.js` (신규): `createStageBanner(container) -> { show(stageNumber) }`.
- `game/src/gameplay/game.js`: `stageBanner` 인스턴스 생성, 라운드 클리어 분기에서 `stageBanner.show(round + 1)` 호출 추가.

## 4. 비목표 (YAGNI)

- 배너가 떠 있는 동안 게임을 일시정지하는 기능은 만들지 않음.
- 라운드 1 시작 시(첫 스테이지)에는 배너를 띄우지 않음 — 라운드 클리어로 다음 스테이지로 "넘어갈 때"만 해당.
- 필요 에셋 없음 — 순수 텍스트/CSS로 구현.

## 5. 열린 위험

- 페이드 타이밍(0.3초 인/아웃, 총 1초)은 초기 추정 — 실제로 보면서 느낌을 조정할 수 있다.
