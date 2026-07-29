# 나무상자 관통 설계 (2026-07-29)

## 문제

타워 기둥으로 쓰이는 나무상자가 총알을 완전히 막는다. 두꺼운 궤짝이라 막히는 게
이상하지는 않지만, 엄폐물 뒤 원숭이를 노릴 방법이 하나도 없어 사격이 단조롭다.

## 목표

기둥 상자를 사격 방향으로 납작하게 만들고, 총알이 그것을 뚫고 지나가 뒤에 있는
원숭이까지 맞히게 한다. 기둥을 뚫으면 타워는 **지금처럼 무너진다.**

## 하지 않는 것

- **구조물 붕괴 연출 개선.** 붕괴가 부자연스러운 건 별건이며 다음 스펙에서 다룬다.
  이 스펙은 붕괴가 *언제* 일어나는지만 건드리고 *어떻게 보이는지*는 건드리지 않는다.
- 모래자루 참호 관통. 참호는 지금처럼 총알을 멈춘다.
- 바주카 경로. 바주카는 `findStructuresInBox` 로 별도 판정하며 이 변경과 무관하다.
- 관통 횟수 제한, 관통마다 감쇠하는 피해량. 관통해도 피해량은 그대로다.
- 상자에 내구도를 주는 것.

## 현재 구조 (확인함)

- 나무상자(`/models/crate.glb`)는 **타워 기둥에만** 쓰인다. 땅 엄폐물은 모래자루
  참호(`/models/sack-trench.glb`)다.
- 타워 하나는 상자 2단 × 2줄 = 4개이며 `crateInstance.scale.setScalar(CRATE_SCALE)`
  (`CRATE_SCALE = 6`) 로 균등 확대된다. 각 메시의 `userData` 는 `{ towerIndex }` 다.
- 단 높이는 `CRATE_UNIT_HEIGHT = 0.9614` 실측값으로 쌓고, 그 위 발판 높이에서
  원숭이 슬롯(`monkeySlot`)이 나온다. 둘 다 **y 축** 값이다.
- `game.js` 의 `handleWeaponShot(intersections)` 이 거리순 교차를 훑는다:
  - `monkeyId` 가 있으면 중복 제거 후 `hits` 에 담고 **계속 진행**한다 (원숭이는 관통).
  - `towerIndex` 가 있으면 `hitTowerIndex` 에 적고 `break` 한다.
  - 둘 다 없으면(참호) 그대로 `break` 한다.
- `applyTowerCollapse(hitTowerIndex, burstColor)` 가 붕괴를 걸고, 그 타워 위 원숭이가
  살아 있으면 죽이고 `{ monkeyId, worldPos }` 를 준다. 없으면 `null`.
- `isPureTowerHit` (원숭이 직격 0 + 타워 명중)일 때는 결과 객체를 직접 만든다.
  `finishShot` 이 이 값으로 효과음을 가른다.
- `shooting.js` 는 순수 함수만 있고 `test/shooting.test.js` 가 8개를 덮는다.

## 설계

### 1. 상자를 납작하게

`obstacles.js` 에서 상자만 비균등 스케일로 바꾼다.

```js
const CRATE_DEPTH_RATIO = 0.22;
```

`crateInstance.scale.setScalar(CRATE_SCALE)` 대신
`crateInstance.scale.set(CRATE_SCALE, CRATE_SCALE, CRATE_SCALE * CRATE_DEPTH_RATIO)`.

깊이만 줄어 약 0.96에서 0.21이 된다. **x·y 스케일을 안 건드리는 것이 핵심이다** —
`CRATE_UNIT_HEIGHT` 로 쌓는 단 높이, 발판 높이, `monkeySlot` 이 전부 y 기준이라
그대로 유지된다. 타워 실루엣도 정면에서는 달라지지 않는다.

### 2. 총알이 기둥을 통과

`game.js` 의 교차 루프에서 기둥을 만났을 때 멈추지 않는다. 참호는 지금처럼 멈춘다.

한 발이 기둥 여러 개를 지날 수 있다 — 앞 타워를 뚫고 뒤 타워 기둥까지 닿는다.
그래서 `hitTowerIndex` 하나를 **지나간 타워 번호 목록**으로 바꾸고, 그 전부를
무너뜨린다. `applyTowerCollapse` 를 부르는 자리가 반복문이 되고, 붕괴로 죽은
원숭이는 지금처럼 `killedHits` 에 들어간다.

`isPureTowerHit` 판정은 "원숭이 직격이 하나도 없고 타워를 하나 이상 지났다"로
바뀐다. 효과음 분기는 그대로 둔다.

### 3. 멈춤 규칙을 순수 함수로

총알을 무엇이 멈추는지가 이제 세 갈래다 — 원숭이는 통과, 상자는 통과, 참호는 정지.
프레임 루프 안에 있어 테스트가 닿지 않으므로 규칙만 떼어낸다.

`game/src/gameplay/shooting.js` 에 넣는다:

```js
// entries 는 거리순 교차를 { monkeyId, towerIndex } 로 단순화한 목록이다.
// three.js 객체를 받지 않으므로 프레임 루프 밖에서 테스트된다.
partitionShotPath(entries) -> { monkeyIds: string[], towerIndices: number[] }
```

규칙:

- `monkeyId` 가 있으면 목록에 담고 계속 간다. 같은 원숭이는 한 번만 담는다
  (한 원숭이의 여러 메시가 걸린다).
- `towerIndex` 가 있으면 목록에 담고 계속 간다. 같은 타워도 한 번만 담는다
  (기둥 2단 × 2줄이라 한 타워의 상자 여러 개가 걸린다).
- 둘 다 없으면 거기서 멈춘다. 그 뒤 항목은 아무것도 보지 않는다.

`game.js` 는 교차 결과를 이 모양으로 만들어 넘기고, 돌려받은 `monkeyIds` 로
`classifyHit(intersection.point)` 를 부른다. 부위 판정에 교차점이 필요하므로
`monkeyId` → 첫 교차점 대응표를 루프 밖에서 따로 만든다.

## 테스트

`test/shooting.test.js` 에 `partitionShotPath` describe 를 더한다:

- 원숭이 둘을 지나면 둘 다 나온다
- 상자를 지나 뒤 원숭이를 맞힌다 — `towerIndices` 와 `monkeyIds` 가 둘 다 찬다
- 참호에서 멈춘다 — 참호 뒤 원숭이는 안 나온다
- 같은 원숭이의 메시 여러 개는 한 번만 나온다
- 한 타워의 상자 여러 개는 한 번만 나온다
- 타워 둘을 지나면 번호 둘 다 나온다
- 빈 목록이면 둘 다 빈 배열이다
- `towerIndex` 가 `0` 인 타워도 걸린다 (0 을 거짓으로 보면 안 된다)

기존 145개는 그대로 통과해야 한다.

## 육안 확인 항목 (사용자)

1. 타워 기둥이 널빤지처럼 얇아 보이는가
2. 원숭이 발판 높이와 그 위 원숭이 위치가 그대로인가
3. 기둥을 쏘면 타워가 무너지는가 (지금과 같음)
4. 기둥 뒤에 있는 원숭이가 기둥 너머로 맞는가
5. 모래자루 참호는 여전히 총알을 막는가
6. 한 발로 타워 둘을 관통하면 둘 다 무너지는가
