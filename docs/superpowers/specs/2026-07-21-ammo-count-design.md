# 총알 수 표시 + 소진 시 게임오버 (설계 문서)

- **날짜**: 2026-07-21
- **선행 작업**: [2026-07-20-obstacles-design.md](2026-07-20-obstacles-design.md)
- **관련 후속 작업(이번 범위 밖, 별도 스펙으로 진행)**: 구조물(상자/모래주머니)을 쏴서 그 위에 있는 원숭이를 추락시켜 죽이는 기능 — 원숭이 배치 로직, 구조물 피격 판정, 낙하/사망 상태머신이 별도로 필요해 규모가 커서 이 스펙에서 분리한다.

## 1. 목표

플레이어가 무제한으로 쏠 수 있던 것을 바꿔서, 라운드마다 정해진 수의 총알만 쏠 수 있게 하고 HUD에 남은 총알 수를 표시한다. 재장전 기능은 만들지 않는다 — 총알을 다 쓰면 그 즉시 게임오버.

## 2. 아키텍처

### 2.1 총알 수 공식

- 라운드당 총알 수 = `max(CONFIG.round.minAmmo, ceil(그 라운드 원숭이 수 × CONFIG.round.ammoMultiplier))`.
- `CONFIG.round.ammoMultiplier = 0.7`, `CONFIG.round.minAmmo = 3`.
- 예: 원숭이 3마리(1라운드) → 3발, 5마리 → 4발, 10마리(최대) → 7발.
- 항상 원숭이 수보다 총알이 적다 — 관통샷(한 발로 여러 마리)과 정확도가 중요해지도록 의도한 밸런스.
- `game/src/gameplay/difficulty.js`의 `getRoundParams(roundNumber, config)`가 기존 `monkeyCount`/`monkeySpeed`/`monkeyScale`/`timeLimit`과 같은 자리에서 `ammo` 필드도 함께 계산해 반환한다(이 함수는 라운드 난이도 곡선을 담당하는 기존 순수 함수이므로, 총알 수도 같은 곳에서 계산하는 게 일관적이다).

### 2.2 재장전 없음, 라운드마다 리셋

- 재장전 메커니즘(키 입력, 애니메이션, 타이머)은 만들지 않는다.
- `game.js`에 `ammoRemaining` 상태를 추가한다. `beginRound(roundNumber)`가 `targetManager.spawnRound(roundNumber)`의 반환값(`roundParams.ammo`)으로 매 라운드 시작 시 리셋한다.
- `handleShot()`은 맨 앞에서 `phase !== 'playing' || ammoRemaining <= 0`이면 그대로 반환(발사 자체가 안 됨 — 사운드도, 반동도, 레이캐스트도 없음). 그 다음 실제로 쏠 때는 명중/빗맞음과 무관하게 `ammoRemaining`을 1 차감한다(방아쇠를 당기면 총알이 소모됨).

### 2.3 총알 소진 게임오버 — 타이밍이 중요함

기존 게임오버 조건(미스 5회, 타이머 만료)은 손대지 않고 그대로 유지한다. 총알 소진은 **추가** 게임오버 조건이다.

이 체크는 `handleShot()` 안에서 즉시 하지 않는다. 대신 틱 루프의 라운드 클리어 체크(`targetManager.allCleared()`)와 같은 자리에서, **라운드 클리어 체크를 먼저** 한 뒤에만 확인한다:

```
if (targetManager.allCleared()) {
  // 기존 라운드 클리어 처리 (그대로)
} else if (ammoRemaining <= 0 && !targetManager.hasDyingMonkeys()) {
  // 원숭이가 남아있고, 죽어가는 애니메이션 중인 원숭이도 없는데 총알이 없음 -> 게임오버
  endGame();
}
```

이유: `handleShot()`은 총알을 **즉시** 차감하지만, 맞은 원숭이는 그 자리에서 바로 사라지지 않는다 — `monkey.js`의 피격 애니메이션(`HIT_ANIMATION_DURATION = 0.6초`)이 끝나야 `targetManager`의 배열에서 실제로 제거되고, 그래야 `allCleared()`가 `true`가 된다. 단순히 "라운드 클리어 체크를 먼저 한다"는 순서만으로는 이 경쟁 상태를 막지 못한다 — 마지막 총알로 마지막 원숭이를 맞힌 순간부터 애니메이션이 끝날 때까지(최대 0.6초, 약 36프레임) `allCleared()`는 계속 `false`이고 `ammoRemaining <= 0`은 이미 `true`라서, 그 사이의 매 프레임마다 `else if`가 오탐으로 발동한다.

실제 해법은 "죽어가는 중인 원숭이가 있으면 총알 소진 게임오버 판정을 유예한다"는 상태 기반 체크다: `monkey.js`에 `isDying()`(내부 `phase === 'hit'`)을, `targetManager.js`에 `hasDyingMonkeys()`(살아있는 원숭이 중 하나라도 `isDying()`이면 `true`)를 추가하고, 게임오버 조건에 `!targetManager.hasDyingMonkeys()`를 추가로 걸어야 한다. 이러면 원숭이가 죽어가는 동안은 판정을 미루다가, 그 원숭이가 실제로 제거된 시점에 `allCleared()`가 `true`면 라운드 클리어가, `false`면(다른 원숭이가 남아있으면) 그제서야 총알 소진 게임오버가 정확히 발동한다. 타이머가 아니라 상태(`phase`)를 근거로 하므로 특정 지속시간 값에 의존하지 않고, `updateHit()`이 매 프레임 무조건 진행되므로 무한히 유예될 위험도 없다.

### 2.4 HUD 표시

- `game/src/ui/hud.js`의 `render()`가 받는 객체에 `ammo`, `ammoMax` 필드를 추가하고, 기존 "남은 시간" 줄 옆에 "총알: 현재/최대" 형식으로 표시한다(예: "총알: 3/7").

## 3. 인터페이스 변경 요약

- `game/src/config.js`: `CONFIG.round`에 `ammoMultiplier: 0.7`, `minAmmo: 3` 추가.
- `game/src/gameplay/difficulty.js`: `getRoundParams(roundNumber, config)`의 반환 객체에 `ammo` 필드 추가.
- `game/src/gameplay/game.js`: `ammoRemaining` 상태 추가, `beginRound()`에서 리셋, `handleShot()` 맨 앞에 발사 가능 여부 체크 + 소모 로직 추가, 틱 루프의 라운드 클리어 분기 옆에 총알 소진 게임오버 분기 추가, `updateHud()` 호출에 `ammo`/`ammoMax` 전달.
- `game/src/ui/hud.js`: `render({ score, streak, round, timeRemaining, ammo, ammoMax })` — 총알 표시 줄 추가.

## 4. 비목표 (YAGNI)

- 재장전 기능(키 입력, 애니메이션, 부분 재장전) — 만들지 않음.
- 구조물을 쏴서 원숭이를 추락시켜 죽이는 기능 — 별도 스펙으로 분리(선행 작업 섹션 참고).
- 총알을 상점에서 구매하거나 총알 소지량이 라운드를 넘어 누적되는 기능 — 만들지 않음(라운드마다 항상 리셋).
- 총알 소진 시 특별한 연출(느린 화면, 카메라 흔들림 등)은 만들지 않음 — 기존 게임오버 화면 그대로 재사용.

## 5. 열린 위험

- 총알 공식(`max(3, ceil(원숭이수 × 0.7))`)은 초기 추정치 — 실제로 플레이해보면서 너무 빡빡하거나 너무 여유로우면 배율/최솟값을 조정할 수 있다.
- 기존 미스 제한(5회)과 총알 소진이 동시에 거의 같은 시점에 발동할 수 있는 라운드(총알이 아주 적은 초반 라운드)에서는 사실상 미스 제한이 의미가 없어질 수 있음 — 의도된 밸런스 변화로 보고 이번 스펙에서는 손대지 않는다.
