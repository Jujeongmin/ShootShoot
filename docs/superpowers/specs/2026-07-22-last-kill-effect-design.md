# 마지막 원숭이 처치 연출 (설계 문서)

- **날짜**: 2026-07-22
- **선행 작업**: 없음(독립 기능) — 원숭이 사망 애니메이션(`monkey.js`), 조준 카메라(FOV/회전, `game.js`), 총알 소진 게임오버의 `hasDyingMonkeys()`(`targetManager.js`)와 상호작용.

## 1. 목표

라운드가 무한히 이어지는 구조이므로, "마지막 원숭이 처치"는 **매 라운드**에서 그 라운드의 마지막 원숭이를 잡는 순간을 뜻한다. 그 샷이 명중하는 순간 짧은 슬로우모션 + 화면 줌인 연출을 넣어 타격감을 살린다.

## 2. 아키텍처

### 2.1 발동 조건 — "이 샷으로 살아있는 원숭이가 다 없어졌는가"

- 원숭이 사망은 즉시가 아니라 애니메이션(`HIT_ANIMATION_DURATION = 0.6초`)을 거친다. 따라서 "마지막 원숭이 처치"는 `targetManager.allCleared()`(모든 원숭이가 배열에서 실제로 제거됨)가 아니라, **그 샷을 쏜 시점에 아직 살아있던(맞지 않은) 원숭이가 이 샷으로 전부 사라졌는가**로 판정한다.
- `targetManager.js`에 `hasAliveMonkeys()`를 추가한다 — 아직 `hit()`을 당하지 않은(죽어가는 중이 아닌) 원숭이가 하나라도 남아있으면 `true`. 기존에 총알 소진 게임오버 판정에 쓰인 `hasDyingMonkeys()`와 쌍을 이루는 함수다.
- `game.js`의 `handleShot()`이 명중 처리(각 원숭이의 `monkey.hit(part)` 호출)를 마친 직후, `!outcome.isMiss && !targetManager.hasAliveMonkeys()`이면(빗나가지 않았고, 이 샷 이후로 살아있는 원숭이가 하나도 없으면) 연출을 트리거한다. 이 판정은 `handleShot()` 안에서 그 샷 처리 중에 딱 한 번만 이루어지므로, 같은 라운드에서 여러 번 발동하는 일은 없다.

### 2.2 연출 내용 — 슬로우모션 + FOV 줌, 카메라 위치/회전은 불변

- 트리거되면 약 0.6초 동안: 게임 진행 속도가 0.3배로 느려지고(원숭이 사망 애니메이션, 라운드 타이머 감소 등), 동시에 화면 FOV가 처음엔 좁아졌다가(줌인) 0.6초에 걸쳐 원래 FOV로 자연스럽게 복귀한다.
- 카메라의 위치(`position`)와 회전(`rotation`)은 전혀 건드리지 않는다 — 기존 조준 카메라(마우스로 회전, FOV 전환)와 충돌하지 않도록 FOV만 오프셋으로 얹는다.
- 새 순수 모듈 `game/src/gameplay/lastKillEffect.js`:
  ```
  createLastKillEffect() -> { trigger(), update(realDt), getTimeScale() -> number, getFovDelta() -> number }
  ```
  - `trigger()`: 내부 경과 시간을 0으로 리셋해 연출을 시작한다("발사하고 잊는" 방식 — 호출자는 그 이후를 신경 쓸 필요 없음).
  - `update(realDt)`: **스케일되지 않은 실제 경과 시간**으로 내부 타이머를 진행시킨다(그렇지 않으면 슬로우모션 자체가 스스로를 계속 느리게 만들어 끝나지 않는 문제가 생긴다).
  - `getTimeScale()`: 연출 활성 중엔 0.3, 비활성이면 1.0.
  - `getFovDelta()`: 연출 활성 중엔 처음(연출 시작 직후) 가장 크고 0.6초에 걸쳐 0으로 줄어드는 값(줌인 폭), 비활성이면 0.

### 2.3 게임 루프 연결

`game.js`의 틱 콜백에서:
1. `lastKillEffect.update(dt)`를 (스케일 전) 실제 `dt`로 먼저 호출한다.
2. `scaledDt = dt * lastKillEffect.getTimeScale()`를 계산해, 원숭이(`targetManager.update`), 저격총 뷰모델(`rifleViewmodel.update`), 파티클 이펙트(`effects.update`), 라운드 타이머 감소(`timeRemaining -= scaledDt`)에 전부 이 `scaledDt`를 사용한다 — 슬로우모션 동안 원숭이 사망 애니메이션도, 라운드 타이머도 같이 느려져서 자연스럽다.
3. FOV 설정을 `engine.setFov((조준 여부에 따른 기존 normalFov/aimFov) - lastKillEffect.getFovDelta())`로 바꾼다 — 기존 조준 FOV 전환 로직 위에 연출용 오프셋을 얹는 방식이라, 조준 중에 연출이 겹쳐도 자연스럽게 합쳐진다.

## 3. 인터페이스 변경 요약

- `game/src/gameplay/lastKillEffect.js` (신규): `createLastKillEffect() -> { trigger(), update(realDt), getTimeScale(), getFovDelta() }`.
- `game/src/gameplay/targetManager.js`: `hasAliveMonkeys()` 함수 추가 + `return` 문에 노출.
- `game/src/gameplay/game.js`: `lastKillEffect` 인스턴스 생성, `handleShot()`에 트리거 판정 추가, 틱 콜백에서 `scaledDt` 계산 후 원숭이/저격총/이펙트/타이머에 적용, FOV 계산에 오프셋 반영.

## 4. 비목표 (YAGNI)

- 카메라 위치 이동이나 회전(죽은 원숭이 쪽으로 팬/줌)은 만들지 않음 — FOV만 조정.
- 화면 플래시, 필터, 특수 사운드 등 추가 연출은 만들지 않음 — 슬로우모션 + FOV 줌만.
- 라운드 타이머 외에 총알 소진 판정 타이밍 자체를 바꾸지 않음 — `scaledDt`가 `timeRemaining`을 늦출 뿐, 총알 소진 게임오버 판정 로직(`hasDyingMonkeys()` 가드 포함)은 그대로 유지.
- 연출 지속시간(0.6초)이나 배율(0.3배)을 설정 화면에서 조절하게 하는 기능은 만들지 않음 — 상수로 고정.

## 5. 열린 위험

- 슬로우모션 배율(0.3배)과 지속시간(0.6초, 실제 시간 기준)은 초기 추정치 — 실제 플레이해보면서 느낌을 조정할 수 있다.
- 지속시간(0.6초)은 **실제(wall-clock) 시간** 기준이다 — `update(realDt)`가 스케일 안 된 실제 dt로 내부 타이머를 진행시키기 때문이다. 그 실제 0.6초 동안 게임 내부 시간은 0.3배로만 흐르므로(약 0.18게임초), 원숭이 사망 애니메이션(0.6게임초 필요)이 연출 구간 안에 다 끝나지 않고, 연출이 끝난 뒤 정상 속도로 나머지가 이어서 재생된다 — 매끄러운 전환으로 의도된 동작이며 버그가 아니다.
- `scaledDt`가 라운드 타이머에도 적용되므로, 연출이 도는 실제 0.6초 동안 타이머가 거의 멈춘 것처럼 보인다 — 의도된 것(타격감을 위한 시간 왜곡)이며 밸런스에 미치는 영향은 미미하다(라운드당 한 번, 짧은 순간).
