# 바주카포 재구현 — 투사체 비행 + 화면 기준 폭발 판정

- **날짜**: 2026-07-27
- **상태**: 설계 승인됨, 구현 계획 대기

## 배경

바주카포는 광고를 보면 5발을 얻는 소모성 무기로 이미 구현되어 있지만, 실제로 쏴보면 바주카포답지 않다.

현재 [game.js](../../../game/src/gameplay/game.js)의 `handleBazookaShot`은 다음과 같이 동작한다.

- 레이캐스트 결과 `intersections[0]`이 없으면 — 즉 허공을 조준하면 — **아무 일도 일어나지 않는다.** 폭발도 없고 투사체도 없다.
- 폭발 중심이 "레이가 맞은 물체 표면의 점"이라, 원숭이나 기둥을 직접 맞히지 못하면 폭발 자체가 발생하지 않는다.
- 투사체 개념이 없다. 발사와 동시에 판정이 끝난다.
- `CONFIG.bazooka.blastRadius = 6`은 월드 단위 고정값이라 화면에 그려지는 조준 원 크기와 아무 관련이 없다.

목표는 "아무 곳이나 조준해도 포탄이 날아가 그 지점에서 폭발하고, 조준 범위 안의 원숭이가 전부 죽는다"이다.

## 핵심 결정 — 판정을 화면 픽셀로 통일

레티클을 픽셀 반경 `R`로 그리고, 원숭이를 화면 좌표로 투영해 **같은 `R`** 과 비교한다. 그리는 데 쓴 숫자와 죽이는 데 쓰는 숫자가 문자 그대로 동일하므로 "에임 안이면 죽는다"가 화면비·FOV와 무관하게 항상 성립한다.

월드 반경 방식은 이 성질을 만족하지 못한다. 같은 월드 반경이라도 멀리서 터지면 화면상 작게 보여 "원 안인데 안 죽네" 느낌이 난다.

```
R = container.clientHeight * CONFIG.bazooka.blastScreenRatio   // 0.25
```

프레임 지름이 화면 높이의 절반이 된다. 조준 FOV 9°에서 화면 세로가 월드 약 12.6유닛을 덮으므로(원숭이 대열 z≈-80 기준), `R`은 월드 약 3.1유닛에 해당한다. 레인 간격이 약 4.7유닛이라 한 레인과 옆 레인 일부가 들어온다. 밸런스는 `blastScreenRatio` 하나로 조절한다.

### 판정 도형은 원이 아니라 정사각형

브래킷이 이루는 정사각형을 그대로 판정 범위로 쓴다.

```
|dx| <= R  &&  |dy| <= R
```

원으로 판정하면 브래킷 모서리 안쪽인데 죽지 않는 영역이 생겨 눈에 보이는 것과 어긋난다. 화면에 그려진 그대로가 판정 범위여야 한다.

### 깊이는 보지 않는다

화면 투영 기준이므로 같은 레인의 앞뒤 원숭이가 전부 죽는다. 폭탄으로서 자연스러운 결과이고, 월드 반경 방식이 잡지 못하던 뒷줄 원숭이까지 잡힌다.

## 착탄 지점

포탄이 터지는 위치는 "폭발이 어디에 보이는가"만 결정한다. 사망 판정은 화면 기준이므로 착탄 지점에 의존하지 않는다.

1. 레이캐스트가 원숭이나 기둥에 맞으면 그 지점
2. 아무것도 맞지 않으면 카메라 정면 `CONFIG.bazooka.maxRange` = **85유닛** 지점

85유닛은 원숭이 대열(z ≈ -78 ~ -90) 부근이다. 이보다 짧으면 포탄이 원숭이들 한참 앞 허공에서 터져 어색하다.

## 구성 요소

| 파일 | 역할 |
|---|---|
| `game/src/gameplay/bazookaProjectile.js` (신규) | 비행 중인 포탄 보관 및 전진, 착탄 시 콜백 |
| `game/src/gameplay/screenTargeting.js` (신규) | 화면 사각형 안의 원숭이 선별 (순수 함수) |
| `game/src/ui/scopeOverlay.js` (수정) | 바주카포용 브래킷 레티클 |
| `game/src/gameplay/effects.js` (수정) | `spawnExplosion(position)` 추가 — 기존 `spawnHitBurst`보다 입자가 많고 크며 오래 남는다 |
| `game/src/audio/sfx.js` (수정) | `explosion()` 추가 — 현재 없다. 낮은 주파수로 떨어지는 sawtooth 굉음 |
| `game/src/gameplay/game.js` (수정) | `handleBazookaShot` 재작성 |
| `game/src/config.js` (수정) | `CONFIG.bazooka` 수치 갱신 |

### bazookaProjectile.js

```js
createBazookaProjectiles(scene) -> {
  spawn(fromWorld, toWorld, onImpact),  // onImpact(toWorld)는 정확히 1회 호출
  update(dt),
  hasPending(),
  clear(),                              // 대기 중 콜백은 호출하지 않고 폐기
}
```

`update(dt)`는 게임 루프에서 `scaledDt`를 받는다. `lastKillEffect`의 슬로모션과 자연스럽게 맞물리고, 일시정지 시 함께 멈춘다. `setTimeout`을 쓰면 라운드 전환이나 게임오버와 무관하게 발동해 버그가 생기므로 쓰지 않는다.

비행 시간은 `CONFIG.bazooka.flightSeconds` = **0.3초**, 총구에서 착탄점까지 직선 등속. 겉모습은 작은 주황 구체.

### screenTargeting.js

```js
findMonkeysInScreenBox(monkeys, camera, container, radiusPx) -> Monkey[]
```

순수 함수로 두어 카메라와 DOM 컨테이너 의존성을 `targetManager` 밖에 격리한다. `targetManager`는 원숭이 목록만 제공한다.

제외 조건:
- 이미 죽는 중인 원숭이 (`isDying()`)
- 카메라 뒤에 있는 원숭이 (투영 후 NDC z > 1)

기존 `targetManager.findMonkeysWithinRadius`는 더 이상 쓰이지 않으므로 함께 제거한다.

## 발사 흐름

1. `handleShot()` — 바주카 탄약이 있으면 `handleBazookaShot()`
2. **착탄점 결정** — 위 규칙대로
3. **대상 확정** — 발사 *그 순간* 화면 사각형 안의 원숭이 목록을 캡처한다. 비행 중 조준을 움직여도 결과가 바뀌지 않는다.
4. 탄약 1발 소모. 0이 되면 원래 무기 뷰모델로 복귀
5. 포탄 스폰
6. **착탄 시** — `effects.spawnExplosion()` + `sfx.explosion()`, 캡처된 원숭이 `kill()`, 점수 계산, 기둥 붕괴, 그리고 기존 `finishShot()` 호출

`finishShot()`은 이미 명중/미스/콤보 효과음과 점수 팝업, 라스트킬 연출을 처리한다. `sfx.explosion()`은 그와 별개로 착탄 순간에 겹쳐 재생한다.

## 경계 조건

- **비행 중 라운드 종료**: 착탄 콜백에서 `phase !== 'playing'`이면 연출만 재생하고 점수 처리는 건너뛴다.
- **라운드 전환 지연**: `targetManager.allCleared()` 검사에 `!projectiles.hasPending()` 조건을 추가한다. 없으면 포탄이 날아가는 도중에 다음 라운드가 시작된다.
- **게임오버 / 재시작**: `projectiles.clear()`로 비행 중인 포탄을 전부 제거한다.
- **미스**: 캡처된 원숭이 0마리이고 기둥도 맞지 않았으면 미스 1회. 누적 5회면 게임오버.
- **연속 발사**: 여러 포탄이 동시에 비행할 수 있다. 각자 자기 착탄점과 캡처 목록을 갖는다.

## 레티클

첨부된 참고 이미지 기준. 색은 `#e4503a`(주황빛 붉은색), 반경 `R`인 정사각형 프레임 안에:

- **코너 브래킷** 4개 — 각 변 길이 `0.42R`, 굵기 4px
- **안쪽 눈금** 4개 — 상하좌우 중앙에서 안쪽을 향한 짧은 선. 길이 `0.22R`, 중심에서 `0.45R` 떨어진 위치
- **중앙 원** — 반지름 `0.16R`의 채워진 원, 그 안에 살짝 어두운 반지름 `0.08R` 원

`scopeOverlay`는 바주카포일 때만 이 브래킷 레이아웃을 그린다. 나머지 4종(기본소총·전기총·저격소총·레이건)의 레티클은 지난 세션에 정한 그대로 유지한다.

레티클 크기 `R`은 판정에 쓰이는 값과 같아야 하므로, `scopeOverlay`는 `R`을 계산하는 함수를 노출하고 `game.js`가 같은 함수를 써서 판정한다. 두 곳에서 따로 계산하면 어긋난다.

## CONFIG 변경

```js
bazooka: {
  maxRounds: 5,
  blastScreenRatio: 0.25,   // blastRadius(월드 6) 대체
  maxRange: 85,
  flightSeconds: 0.3,
  weapon: { ... 기존 그대로 ... },
}
```

`blastRadius`는 제거한다.

## 테스트

vitest 단위 테스트:

- `screenTargeting` — 사각형 안/밖 판정, 모서리 경계값, 죽는 중인 원숭이 제외, 카메라 뒤 원숭이 제외
- `bazookaProjectile` — `update(dt)` 누적으로 착탄, `onImpact`가 정확히 1회만 호출됨, 착탄 후 `hasPending()`이 false, `clear()` 후 콜백이 호출되지 않음, 동시 다발 포탄이 각자 독립적으로 착탄

레티클 모양과 폭발 연출은 브라우저에서 사용자가 직접 확인한다. 이 세션의 브라우저 프리뷰는 rAF가 돌지 않아(pane 미표시) 자동 시각 검증이 불가능하다. 자세한 내용은 [2026-07-27-session-handoff.md](2026-07-27-session-handoff.md) 참고.
