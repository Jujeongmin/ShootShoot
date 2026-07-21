# 조준 민감도 설정 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-20-scope-aim-camera-design.md](2026-07-20-scope-aim-camera-design.md)

## 1. 목표

조준 중 카메라가 마우스를 따라 회전하는 정도(민감도)를 플레이어가 직접 조절할 수 있게 한다. 설정은 저장되어 다음 플레이에도 유지되고, 메인 메뉴뿐 아니라 플레이 도중에도(P 키) 열 수 있다.

## 2. 아키텍처

### 2.1 민감도 적용 방식

기존 조준 회전 계산(`rotation.y = -ndc.x * lookLimitX`, `rotation.x = ndc.y * lookLimitY`)은 그대로 두되, `ndc` 값에 민감도를 곱한 뒤 `[-1, 1]`로 클램프한 값을 사용한다:

```
effectiveNdcX = clamp(ndc.x * sensitivity, -1, 1)
effectiveNdcY = clamp(ndc.y * sensitivity, -1, 1)
rotation.y = -effectiveNdcX * lookLimitX
rotation.x = effectiveNdcY * lookLimitY
```

이렇게 하면 **최대 회전각(lookLimit)은 그대로 유지**하면서, 민감도가 높을수록 화면을 적게 움직여도 최대치에 도달한다(더 "예민"해짐), 낮을수록 더 많이 움직여야 한다.

- 범위: **0.5x ~ 2.0x**, 기본값 **1.0x**, 슬라이더 단위 0.1.

### 2.2 저장

새 모듈 `game/src/gameplay/settingsStore.js` — 최고점수 저장(`createHighScoreStore`)과 동일한 패턴의 순수 함수:
```
createSettingsStore(storage, key) -> { get() -> { sensitivity }, set({ sensitivity }) }
```
`get()`은 저장된 값이 없거나 손상된 경우 기본값(`{ sensitivity: 1.0 }`)을 반환한다. `game.js`가 `window.localStorage`를 주입해서 사용한다(키: `shootshoot.settings`).

### 2.3 설정 패널 UI

새 모듈 `game/src/ui/settingsPanel.js`:
```
createSettingsPanel(container) -> { show(sensitivity, onChange, onClose), hide() }
```
- 슬라이더(민감도) + 현재 값 표시 + "닫기" 버튼으로 구성된 전체 화면 오버레이.
- 기존 `screens.js`(메뉴/게임오버, z-index 20)나 HUD/스코프 오버레이(z-index 10~13)보다 위(z-index 25)에 그려진다.
- 슬라이더 조작 시 즉시 `onChange(value)` 호출(실시간 반영 + 저장).

### 2.4 접근 방법 & 일시정지 동작

- **메인 메뉴**: "설정" 버튼 추가(`screens.js`의 `showMenu(onStart, onSettings)` — 시그니처에 콜백 하나 추가). 누르면 메뉴를 숨기고 설정 패널을 띄운다. 닫으면 다시 메뉴로 돌아간다.
- **플레이 중**: **P 키**를 누르면 설정 패널이 열린다. 이때 `phase === 'playing'`은 유지하되 별도의 `settingsOpen` 플래그로 라운드 타이머 감소를 멈춘다(일시정지). 설정 패널이 화면을 덮고 있어 클릭이 캔버스에 닿지 않으므로 조준/발사는 자연히 막힌다(별도 처리 불필요 — 기존 메뉴/게임오버 오버레이와 같은 원리). 닫으면 `settingsOpen`이 풀리고 타이머가 다시 흐른다.
- 게임오버 화면에서 P를 누르는 것은 이번 범위에서 굳이 막지 않는다(설정 패널이 위에 뜨고, 닫으면 게임오버 화면으로 돌아가는 것으로 충분 — 별도 처리 불필요, `settingsOrigin` 개념으로 통일 처리).

## 3. 인터페이스 변경 요약

- `game/src/gameplay/settingsStore.js` (신규): `createSettingsStore(storage, key) -> { get(), set(settings) }`.
- `game/src/ui/settingsPanel.js` (신규): `createSettingsPanel(container) -> { show(sensitivity, onChange, onClose), hide() }`.
- `game/src/ui/screens.js`: `showMenu(onStart, onSettings)` — 콜백 파라미터 추가, "설정" 버튼 추가.
- `game/src/gameplay/game.js`: 민감도 상태 로드/적용, P 키 리스너, 설정 열기/닫기 흐름(메뉴 경유/플레이 중 경유 구분), 라운드 타이머에 `settingsOpen` 게이팅 추가.

## 4. 비목표 (YAGNI)

- 민감도 외 다른 설정 항목(볼륨, 그래픽 옵션 등)은 만들지 않음 — 요청된 것만.
- 설정 패널에 애니메이션 전환 효과는 만들지 않음.
- 키 리바인딩(P 키를 다른 키로 바꾸는 기능)은 만들지 않음.

## 5. 열린 위험

- 민감도 범위(0.5x~2.0x)와 기본값은 초기 추정 — 실제 플레이해보며 조정이 필요할 수 있다.
