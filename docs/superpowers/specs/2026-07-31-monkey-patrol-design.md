# 원숭이 좌우 순찰 설계 (2026-07-31)

## 문제

원숭이가 과녁처럼 보인다. 좌우로 미끄러지듯 움직이기는 하는데 몸이 항상
플레이어를 정면으로 보고 있어서, 살아 움직이는 것이 아니라 레일 위의 표적으로 읽힌다.

사용자가 원하는 것: **진짜로 걸어다니는 옆모습.**

## 현재 동작

- `laneLayout.js` 가 슬롯마다 `swayAmplitude = 0.038 × |z|` 를 준다. `z = -78` 이면
  진폭 약 ±3유닛이다. **좌우 이동은 이미 있다.**
- `monkey.js` 의 `updateIdle` 이 그 진폭으로 `group.position.x` 를 sin으로 흔들고,
  `group.position.y` 를 위로만 bob 시킨다.
- `group.rotation.y` 는 평상시 0 — **항상 플레이어를 본다.** 2~4.5초마다 랜덤하게
  도발 동작이 들어와 `rotation.y` 를 `sin(t·10)·0.6` 으로 흔든다.
- 타워 위 원숭이는 `sway.amplitude = 0` 이라 제자리다.

## 에셋 제약

`game/public/textures/Monkey_animated/monkey.FBX` 에 애니메이션 클립이 **하나뿐이다**:

```
clips: 1
  [0] name="Take 001" duration=3.167s tracks=120
bones: 34
```

걷기 클립이 없다. 본 이름은 `b_Root`, `b_Hip`, `b_Left_Leg01/02`,
`b_Left_Foot01/02`, `b_Right_Leg01/02`, `b_Right_Foot01/02`, `b_Tail01`~`b_Tail07`,
`b_Spine01`~`b_Spine03`, `b_Neck`, `b_Head`, 양팔 순이다.

따라서 걸음은 **절차적으로** 만든다. 새 에셋을 받지 않는다.

## 시야 크기 (설계 판단 근거)

원숭이 키 약 2.1유닛, `FRONT_Z = -78`, 기본 FOV 60 → 화면 높이의 약 2.6%.
조준(FOV 9)하면 약 17%. **다리 디테일은 조준했을 때만 보인다.** 그래서 다리는
정교한 IK가 아니라 sin 스윙 하나로 충분하다.

## 확정된 결정

사용자 선택이다. 뒤집지 말 것.

1. **좌우 순찰.** 플레이어 쪽으로 접근하지 않는다. '지는 조건' 축은 이번 작업 밖이다.
2. **절차적 걸음.** 다리 본을 직접 흔든다. 걷기 클립을 구해오지 않는다.
3. **순찰 폭은 지금 그대로.** `laneLayout.js` 의 진폭·주기를 안 건드린다.
   난이도 균형이 이미 여기 맞춰져 있다.
4. **끝에서 플레이어를 한 번 본다.** sin 운동이라 양 끝에서 속도가 0이 되는데,
   그 구간에서 몸이 정면으로 돌아온다. 헤드샷 타이밍이 생긴다.
5. **도발은 그 정면 구간에만 나온다.** 랜덤 간격 로직은 없앤다.
6. **타워 위 원숭이는 제자리.** 발판이 좁다.

## 구조

세 조각이다.

### 1. `game/src/gameplay/patrolMotion.js` (새 파일, 순수)

THREE 의존이 없다. `difficulty.js`·`laneLayout.js`·`tutorialState.js` 와 같은 결이다.

```js
createPatrol({ amplitude, frequency, phase })
  .sample(elapsed, dt) -> { offsetX, facing, gaitDelta, taunt }
```

| 값 | 계산 | 의미 |
|---|---|---|
| `offsetX` | `sin(elapsed·f + p) · A` | **지금 `monkey.js` 가 하는 계산 그대로.** 궤적 불변 |
| `speedNorm` | `abs(cos(elapsed·f + p))` | 내부값. 0이면 순찰 끝, 1이면 최고속 |
| `facing` | 아래 참고 | `group.rotation.y` 에 넣을 각 |
| `gaitDelta` | `abs(cos(elapsed·f+p)) · A · f · dt` | 이번 프레임에 나아간 거리 |
| `taunt` | `max(0, 1 - speedNorm / FACE_THRESHOLD)` | 도발 세기. 정면일 때 1 |

`facing` 규칙:

- 모델은 `rotation.y = 0` 에서 +Z(플레이어)를 본다. +Z를 Y축으로 θ 돌리면
  `(sinθ, 0, cosθ)` 이므로 +X를 향하려면 `θ = +π/2` 다.
- 진행 방향 부호는 `cos(elapsed·f + p)` 의 부호다.
- `FACE_THRESHOLD = 0.25`. `speedNorm >= FACE_THRESHOLD` 면 온전히 옆을 본다
  (`±π/2`). 그 아래에서는 `speedNorm / FACE_THRESHOLD` 비율로 0까지 섞는다.
  별도 상태 기계 없이 끝에서 정면이 된다.

`amplitude === 0` (타워 위 원숭이)이면 `offsetX`·`facing`·`gaitDelta` 가 전부 0이고
`taunt` 만 돈다. 제자리에서 가끔 도발하는 지금 모습이 유지된다.

도발 빈도 확인: `frequency = 1.8 × monkeySpeed`, 1라운드 `monkeySpeed = 0.5` 이면
`f = 0.9 rad/s` → 주기 약 7초, 끝점은 3.5초마다. 없어지는 랜덤 간격
(2~4.5초)과 비슷하다. 슬롯마다 `swayPhase` 가 달라서 서로 다른 시점에 도발한다.

### 2. `game/src/gameplay/monkey.js` (수정)

`updateIdle` 이 `patrol.sample()` 결과를 바른다.

- `group.position.x = position.x + offsetX`
- `group.position.y` — 지금의 위로만 bob, 그대로 둔다
- `group.rotation.y = facing + sin(elapsed·10) · TAUNT_SWING · taunt`
  (`TAUNT_SWING = 0.6`, 지금 값)
- `gaitPhase += gaitDelta · STRIDE_PER_UNIT` 로 누적

다리는 `mixer.update(dt)` **뒤에** 덮어쓴다. 앞에 하면 클립이 지운다.

```js
b_Left_Leg01.rotation.x  += Math.sin(gaitPhase) * LEG_SWING;
b_Right_Leg01.rotation.x += -Math.sin(gaitPhase) * LEG_SWING;
```

`=` 가 아니라 `+=` 라서 idle 클립의 숨쉬기가 살아있고 그 위에 걸음만 얹힌다.
본은 생성 시 `model.getObjectByName('b_Left_Leg01')` 로 한 번 잡아 둔다.
없으면 다리 갱신을 건너뛴다 — 모델이 바뀌어도 터지지 않게.

**삭제되는 상태:** `state.isTaunting`, `state.tauntElapsed`, `state.nextTauntAt`,
그리고 상수 `TAUNT_INTERVAL_MIN` / `TAUNT_INTERVAL_MAX`.

### 3. `test/patrolMotion.test.js` (새 파일)

순수 모듈이라 전부 검증된다.

- `offsetX` 가 `sin(elapsed·f + p) · A` 와 일치한다
- 순찰 중간(최고속)에서 `facing` 이 `+π/2` 또는 `-π/2` 다
- 양 끝(`speedNorm = 0`)에서 `facing` 이 0이다
- `facing` 부호가 진행 방향을 따라 뒤집힌다
- 멈춰 있을 때 `gaitDelta` 가 0이고, 움직일 때 양수다
- `amplitude = 0` 이면 `facing`·`gaitDelta` 가 항상 0인데 `taunt` 는 주기적으로 1에 닿는다

## 안 건드리는 것

- `laneLayout.js` — 진폭·주기·슬롯 배치 그대로
- `classifyHit` — 로컬 Y만 보므로 회전과 무관하다. 헤드샷 판정 안 바뀐다
- `difficulty.js` 의 난이도 값
- 타워 원숭이 배치
- 죽는 연출(`updateHit`), 피격 플래시(`updateFlash`)

## 육안 확인이 필요한 값

`facing` 부호 하나다. 모델 forward 축을 코드에서 유도했지만 FBX 원본 회전이 껴 있으면
뒤집힐 수 있다. 뒤로 걷는 것처럼 보이면 `patrolMotion.js` 의 부호 상수 한 줄만 바꾼다.

`LEG_SWING` 과 `STRIDE_PER_UNIT` 도 첫 값은 추측이다. 조준해서 보고 조정한다.

## 이 작업이 열지 않는 것

플레이어 쪽으로 접근하는 움직임, 지는 조건, 난이도 상한. 전부 별개 작업이다.
