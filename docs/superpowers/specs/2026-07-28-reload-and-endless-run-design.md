# 장전과 무한 플레이 설계 (2026-07-28)

두 가지를 한 번에 바꾼다. 게임오버를 없애 판이 끝나지 않게 하고, 한 발 쏠 때마다
장전을 거치게 한다. 둘 다 `game.js`의 플레이 루프를 건드리므로 스펙 하나로 묶는다.

구현 순서는 **게임오버 제거가 먼저다.** 그걸 없애면 장전의 까다로운 예외("장전
도중 게임오버가 나면 다음 판이 잠긴 채 시작한다")가 아예 생기지 않는다.

## 사용자가 확정한 결정

| 항목 | 결정 |
|---|---|
| 장전 시점 | 매 발마다 |
| 장전 시간 | 모든 무기 동일 (CONFIG 값 하나) |
| 장전 중 조준 | 불가. 확대도 안 된다 |
| 바주카포 | 장전한다, 일반 총과 같은 시간 |
| 게임오버 | 없앤다. 무한히 이어진다 |
| 골드 지급 | 라운드를 클리어할 때마다 정산 |
| 점수 구조 | 지금 그대로 (관통 배율 + 연속 배율) |
| 플레이 중 출구 | 설정 패널의 `메뉴로` 버튼 |
| 라운드 도중 퇴장 | 미정산 점수는 버린다 |
| 게임오버 화면 | 퇴장 요약 화면으로 재활용 |

## 현재 구조에서 확인한 사실

- 발사는 **누르면 조준, 떼면 발사**다. `input.onAimDown` 이 조준을 켜고
  `input.onAimUp(handleShot)` 이 쏜다.
- 조준 중에는 뷰모델이 숨는다 (`setVisible(!input.isAiming())`).
- `weaponViewmodel` 에 이미 반동이 있다 — `triggerRecoil()`, `RECOIL_DURATION = 0.15`.
  `update(dt)` 가 흔들림과 반동을 함께 돌린다.
- `handleShot` 첫머리에 `if (!aimApplied) return;` 가드가 있다. 조준이 한 프레임도
  적용되지 않은 발사를 막는 장치다.
- 게임오버의 유일한 조건은 `scoreState.misses >= CONFIG.missLimit` (`missLimit: 5`)다.
  누적이며 명중해도 줄지 않는다.
- 라운드는 `beginRound(round + 1)` 로 무한히 이어진다. 즉 미스 제한을 없애면
  **판이 영영 끝나지 않는다.**
- `endGame()` 이 세 가지를 한다: 최고점수 제출, `floor(score / scorePerGold)` 만큼
  골드 지급, 게임오버 화면 표시. 골드가 들어오는 유일한 통로다.
- **플레이 중에 메뉴로 나갈 방법이 없다.** `P` 로 설정을 열 수 있지만 닫으면 다시
  게임으로 돌아간다. 유일한 출구가 게임오버였다.
- `scoreState.misses` 를 읽는 곳은 게임오버 판정 한 곳뿐이다.

## A. 게임오버 제거와 라운드 정산

### 없애는 것

- `CONFIG.missLimit`
- `game.js` 의 `if (scoreState.misses >= CONFIG.missLimit) endGame();`
- `scoreState.misses` 필드 자체

`misses` 는 오직 미스 제한을 위해 존재했다. 빗맞힐 때 연속 배율이 0으로 끊기는 건
`applyShot` 의 별개 분기라 그대로 남는다. `scoring.js` 의 `createScoreState` 와
`applyShot` 에서 필드를 빼고, `test/scoring.test.js` 의 해당 단언을 함께 고친다.

### 라운드 정산

`scoreState.score` 는 판 전체 누적으로 그대로 두고 (최고점수가 이 값을 쓴다),
`settledScore` 를 하나 더 둔다. 정산 지점은 프레임 루프에서 라운드가 비었을 때
`sfx.roundClear()` / `stageBanner.show(round + 1)` / `beginRound(round + 1)` 를
부르는 그 분기다. 거기서:

```
pending = scoreState.score - settledScore
currencyStore.earn(settlementGold(pending, CONFIG.scorePerGold))
settledScore = scoreState.score
```

`settlementGold(pending, scorePerGold)` 는 `scoring.js` 에 두는 순수 함수다
(`Math.floor(pending / scorePerGold)`, 음수나 0이면 0). 정산 지점 자체는 프레임 루프
안이라 테스트가 닿지 않으므로, 계산만이라도 떼어 놓아야 검증할 수 있다.

라운드 도중에 나가면 정산을 하지 않으므로 `pending` 이 그대로 버려진다 — 사용자가
고른 동작이 별도 처리 없이 나온다.

`settledScore` 는 `startGame()` 에서 0으로 되돌린다.

나머지 몫(`pending % scorePerGold`)은 버린다. 라운드마다 최대 9점이 사라지지만,
이월을 만들면 상태가 하나 더 늘고 체감 차이가 없다.

### 출구

`settingsPanel.show(sensitivity, onChange, onClose)` 에 네 번째 인자 `onExit` 를
더한다. `onExit` 가 함수일 때만 패널에 `메뉴로` 버튼이 붙는다. `game.js` 는
`openSettingsFromPlay` 에서만 이 인자를 넘기고 `openSettingsFromMenu` 에서는 넘기지
않는다 — 메뉴에서 연 설정에 "메뉴로"가 있으면 말이 안 된다.

### 퇴장 흐름

`endGame()` 을 `exitRun()` 으로 바꾼다. 하는 일:

1. `settingsPanel.hide()`, `settingsOpen = false`
2. `targetManager.clear()`, `projectiles.clear()`
3. `highScoreStore.submit(scoreState.score)` — 판 전체 점수로 제출
4. `phase = 'gameover'`
5. `screens.showGameOver({ score, highScore, isNewHighScore }, returnToMenu)`

골드는 여기서 주지 않는다. 라운드 정산에서 이미 줬다.

`showGameOver` 는 지금 그대로 쓴다. 제목만 `게임 종료` 에서 판이 끝난 게 아니라
그만둔 것임이 드러나게 바꾼다 — `기록` 으로 한다. 나머지 구성(점수, 구분선,
최고점수, 신기록 트로피, `메인 메뉴로` 버튼)은 손대지 않는다.

`phase = 'gameover'` 를 유지하는 이유: 프레임 루프의 `if (phase === 'playing' && ...)`
가드들이 그대로 동작해서 요약 화면이 떠 있는 동안 사격과 조준이 멈춘다.

## B. 장전

### `game/src/gameplay/reloadState.js` (신규)

DOM 없이 도는 순수 타이머. 이 저장소의 `scoring.js`, `difficulty.js` 와 같은 결이고
유닛 테스트가 되는 유일한 부분이다.

```js
createReloadState(seconds) -> {
  start(),            // 남은 시간을 seconds 로 되돌린다
  tick(dt),           // 남은 시간을 깎는다. 0 아래로 내려가지 않는다
  isReloading(),      // 남은 시간 > 0
  remaining(),        // 남은 시간(초)
  reset(),            // 남은 시간을 0으로
}
```

상태를 `weaponViewmodel` 에 두지 않는 이유가 있다. `swapWeaponViewmodel` 이 뷰모델을
파괴하고 다시 만드는데, 그게 일어나는 시점이 하필 **바주카 마지막 발을 쏜 직후**다
(`bazookaStore.consumeRound() === 0`). 뷰모델이 상태를 들고 있으면 장전이 통째로
사라져 즉시 다시 쏠 수 있게 된다.

### `input.js` 에 `setEnabled(enabled)`

꺼져 있으면 `onMouseDown` 이 바로 반환한다. 그러면 `aiming` 이 false 로 유지되고,
확대·레티클·발사가 한 번에 막힌다. `onMouseUp` 에 이미 `if (!aiming) return;` 이
있어서 뗄 때도 아무 일이 없다.

초기값은 켜짐이다. 컨트롤러를 만들자마자 입력이 죽어 있으면 안 된다.

`game.js` 의 조준 분기 네 곳(`input.isAiming()` 사용처)은 손대지 않는다. 거기서
막으려 하면 한 곳만 빠뜨려도 티가 안 나고, 장전이 끝나는 순간 버튼을 누르고 있던
플레이어의 조준이 갑자기 켜진다.

### `weaponViewmodel.triggerReload(seconds)`

반동 옆에 붙는 두 번째 모션. 총을 내리고 앞으로 기울였다가 다시 올린다.

| 구간 | 비율 | 동작 |
|---|---|---|
| 내리기 | 0 ~ 0.25 | y 를 `RELOAD_DIP_DISTANCE` 만큼 내리고 x 회전 `RELOAD_TILT_ANGLE` |
| 유지 | 0.25 ~ 0.7 | 내려간 자세 유지 |
| 올리기 | 0.7 ~ 1 | 원래 자세로 복귀 |

값: `RELOAD_DIP_DISTANCE = 0.12`, `RELOAD_TILT_ANGLE = 0.5`.

장전은 반동보다 오래간다(0.8초 대 0.15초). 두 모션이 겹치는 구간에서 `position.z` 와
`rotation.x` 를 서로 덮어쓰지 않도록, `update` 에서 반동을 먼저 적용하고 장전이
그 위에 더한다.

조준 중에는 뷰모델이 숨지만 장전 중에는 조준 자체가 막히므로, 장전 모션은 항상 보인다.

### `game.js` 배선

- `const reload = createReloadState(CONFIG.reload.seconds);`
- `handleShot` 끝에서 `reload.start()` 와 `weaponViewmodel.triggerReload(CONFIG.reload.seconds)`.
  `handleShot` 은 이미 `phase !== 'playing'` 과 `!aimApplied` 를 걸러낸 뒤이므로
  발사가 실제로 일어난 경우에만 장전이 걸린다.
- 프레임 루프에서 `reload.tick(dt)` 후
  `input.setEnabled(phase === 'playing' && !settingsOpen && !reload.isReloading())`.
  설정이 열려 있을 때도 막는 게 맞다.
- `startGame()` 에서 `reload.reset()`.
- `swapWeaponViewmodel` 이 끝난 뒤, `reload.isReloading()` 이면 새 뷰모델에
  `triggerReload(reload.remaining())` 를 건다. 남은 시간으로 걸어야 총이 혼자 멀쩡히
  서 있지 않는다.

### CONFIG

```js
reload: {
  seconds: 0.8,
},
```

일반 총과 바주카포가 같은 값을 쓴다.

## 테스트

`vitest` 가 `environment: 'node'` 라 DOM이 없다. 테스트 가능한 것:

- `reloadState` — `start` 후 `isReloading()` 이 참, `tick` 으로 줄어듦, 남은 시간이
  0 아래로 안 내려감, `dt` 가 남은 시간보다 커도 정확히 0, `reset` 이 즉시 0으로.
- `scoring` — `misses` 제거에 맞춰 기존 단언 수정. `applyShot` 이 빗맞힘에 여전히
  연속을 0으로 끊는지 확인하는 단언은 남긴다.
- `settlementGold` — 정확히 나눠떨어질 때, 나머지가 있을 때, 0일 때, 음수일 때.

테스트 불가 (사용자 육안 확인):

- 장전 모션의 모양과 길이
- 장전 중에 눌러도 확대가 안 되는지
- 설정의 `메뉴로` 가 실제로 동작하는지
- 라운드 클리어 때 골드가 실제로 늘어나는지

## 위험 요소

1. **라운드 정산이 실제로 도는지 자동으로 못 잡는다.** 정산 지점은 프레임 루프
   안(라운드 클리어 분기)이라 유닛 테스트가 닿지 않는다. `pending` 계산 자체를
   순수 함수로 빼면 테스트할 수 있다 — 그렇게 한다.
2. **`input.setEnabled` 를 매 프레임 호출한다.** 값이 안 바뀌어도 호출되므로,
   `input.js` 쪽에서 불리언 대입만 하고 다른 일을 하지 않아야 한다.
3. **골드 획득 경로가 하나뿐이다.** 라운드 정산이 깨지면 게임 전체 경제가 멈춘다.
   퇴장 시 골드를 주지 않기로 했으므로 대체 경로가 없다.
4. **`misses` 제거가 저장된 데이터를 건드리지 않는지.** `scoreState` 는
   `localStorage` 에 저장되지 않는다 (`createScoreState()` 로 매 판 새로 만든다).
   저장되는 건 최고점수·골드·무기·강화·바주카뿐이라 마이그레이션이 필요 없다.

## 범위 밖

- 장전 효과음. `sfx.js` 에 발사·명중·콤보·헤드샷은 있으나 장전음은 없다.
- 무기별 장전 시간. 전부 같은 값으로 시작한다.
- 탄창 개념과 수동 장전.
- 남은 장전 시간을 HUD에 표시하기. 뷰모델 모션이 그 역할을 한다.
- 쏜 탄 수를 직접 세는 점수 항목. 관통 배율과 연속 배율로 충분하다고 정했다.
