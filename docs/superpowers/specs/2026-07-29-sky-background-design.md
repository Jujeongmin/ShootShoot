# 하늘 배경 설계 (2026-07-29)

## 문제

하늘이 단색 `0x87ceeb` 한 장이다. 섬 하나가 허공에 떠 있을 뿐 그 바깥은 비어 있어서
높은 고도에 떠 있다는 느낌도, 깊이도 없다. 화면이 심심하다.

## 목표

구름, 먼 섬 실루엣, 지나가는 새를 넣어 하늘을 채운다. **사격에는 어떤 영향도 주지
않는다** — 레이캐스트 대상이 아니고, 사격선을 가리지도 않는다.

## 하지 않는 것

- 새를 쏘는 것. 장식이다. 점수·연속 배율·정산 규칙을 건드리지 않는다.
- 하늘 그라디언트, 태양, 시간대 변화. 단색 하늘은 그대로 둔다.
- 외부 텍스처·모델 에셋. 전부 코드에서 만든 로우폴리 메시다.
- 스카이박스 큐브맵.

## 현재 구조 (확인함)

- `game/src/gameplay/world.js` 가 `scene.background`, `scene.fog`, 조명, 섬, 용골을 만든다.
  반환값은 `{ platforms: [platform] }`.
- 섬 중심 `z = -80`, 폭 26, 깊이 40, 윗면 `y = -1.0`.
- `scene.fog = new THREE.Fog(0x87ceeb, 80, 320)` — 320 너머는 완전히 하늘색이다.
- 카메라: `y = 1.6`, `z = 0`, FOV 60(조준 시 좁아짐), `far = 800`.
- 프레임 루프는 `game.js` 의 `engine.start((dt) => ...)` 하나뿐이다.
- 레이캐스트 대상은 `targetManager.getRaycastMeshes()`, `obstacles.getBlockingMeshes()`,
  `obstacles.getPillarMeshes()` 셋을 명시적으로 모은 배열이다. 씬에 메시를 더해도
  이 배열에 안 넣으면 사격 판정에 안 걸린다.

## 구조

새 파일 둘이다.

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/skyMotion.js` | 순수 함수. 구름 드리프트 랩어라운드, 새 무리 위치 계산 |
| `game/src/gameplay/skyDecor.js` | three.js 메시 생성과 매 프레임 갱신 |
| `test/skyMotion.test.js` | 순수 함수 테스트 |

three.js 씬 조립은 테스트하지 않는다. `world.js` 와 같은 취급이다 — 육안 확인 항목.
움직임 계산만 떼어 테스트한다.

### `skyMotion.js`

```js
// 구름이 x 축 한쪽 끝에 닿으면 반대편으로 넘어간다.
export function driftWrapped(x, dx, minX, maxX) -> number

// 새 무리가 경로를 t(0~1) 만큼 지난 위치. t 가 1 을 넘으면 0 으로 돌아간다.
export function flightProgress(t, dt, durationSeconds) -> number
```

두 함수 다 상태를 안 들고 값만 낸다.

### `skyDecor.js`

```js
export function createSkyDecor(scene) -> { update(dt), dispose() }
```

`update(dt)` 는 구름을 밀고 새 무리를 움직인다. `dispose()` 는 씬에서 떼고 지오메트리와
재질을 버린다 — `weaponViewmodel.dispose()` 와 같은 방식이다.

## 배치

좌표는 전부 월드 기준이다. 카메라가 원점 근처에 고정이라 월드 좌표가 곧 화면 배치다.

### 구름

- 덩이 14개. 한 덩이는 `SphereGeometry` 4~6개를 뭉친 `THREE.Group`.
- 재질 하나를 전 구름이 공유한다: `MeshLambertMaterial`, 흰색 `0xf2f6fa`.
- 배치 범위: `z` -130 ~ -300, `y` -25 ~ +35, `x` -160 ~ +160.
- **사격선 회피**: `z > -130` 인 구름은 만들지 않는다. 섬(z=-80)보다 항상 뒤다.
  섬은 폭 26이고 조준하면 화각이 더 좁아지므로, 뒤쪽에만 두면 표적을 가릴 일이 없다.
- 드리프트: `x` 축으로 초당 0.6 유닛. `driftWrapped` 로 ±170에서 반대편으로 넘긴다.
- 그림자 없음. `castShadow`, `receiveShadow` 둘 다 안 켠다.

배치 난수는 고정 시드로 만든다. 판마다 하늘이 달라지면 육안으로 회귀를 못 잡는다.
시드 난수는 `skyMotion.js` 에 작은 LCG 하나를 두고 쓴다.

### 먼 섬

- 5개. 각각 `ConeGeometry`(용골) 하나와 `BoxGeometry`(윗면) 하나.
- `z` -250 ~ -400. fog 끝이 320이라 대부분 하늘색에 잠겨 실루엣만 남는다.
- 크기는 지금 섬보다 크게 잡는다(폭 40~90). 멀어서 작아 보이므로 같은 크기면 사라진다.
- 색은 섬과 같은 계열 `0x6b4f3a` / `0x5a4230`. fog 가 알아서 흐린다.
- 고정. 안 움직인다.

### 새

- 무리 하나에 새 5마리.
- 한 마리는 `BufferGeometry` 삼각형 두 장(양 날개). `MeshBasicMaterial` 어두운 회색,
  `side: THREE.DoubleSide`. 조명 계산 없이 실루엣으로 보이면 된다.
- 경로: `x` -180 → +180 을 24초에 걸쳐 직선으로 지난다. `y` 는 22 ~ 38, `z` 는 -150 근처.
  새마다 조금씩 어긋나게 두어 V 대형처럼 보이게 한다.
- 다 지나가면 `flightProgress` 가 0 으로 돌아가 반대편에서 다시 시작한다.
- 날갯짓: 날개 두 장의 `rotation.z` 를 사인파로 흔든다. 초당 3회.

## 배선

`game.js` 한 곳이다.

1. `import { createSkyDecor } from './skyDecor.js';`
2. 월드를 만드는 자리 근처에서 `const skyDecor = createSkyDecor(engine.scene);`
3. 프레임 루프에서 `skyDecor.update(scaledDt);`

`scaledDt` 를 쓴다 — 마지막 처치 슬로모가 걸리면 하늘도 같이 느려지는 게 맞다.
배경만 제 속도로 흐르면 슬로모가 깨진다.

메뉴 화면에서도 움직인다. 프레임 루프는 `phase` 와 무관하게 돌고, 메뉴 뒤로 보이는
하늘이 멈춰 있으면 정지 화면처럼 보인다.

## 성능

- 메시 수: 구름 14×5 ≈ 70, 먼 섬 10, 새 10 → 90개 안쪽.
- 재질은 구름 1개, 섬 2개, 새 1개로 공유한다.
- 그림자 맵에 아무것도 안 올린다. 지금 그림자 카메라 범위(±36, far 160)는 배경까지
  못 닿으므로 켜도 효과가 없고 비용만 든다.
- 전부 정적 지오메트리다. 매 프레임 하는 일은 `position.x` 대입과 회전 대입뿐이다.

## 테스트

`test/skyMotion.test.js`:

- `driftWrapped` 가 범위 안에서는 그냥 더한다
- `driftWrapped` 가 `maxX` 를 넘으면 `minX` 쪽으로 넘어간다
- `driftWrapped` 가 음수 속도에서 반대로 넘어간다
- 한 프레임이 아주 길어도 범위 밖으로 안 나간다
- `flightProgress` 가 0 에서 1 로 진행한다
- `flightProgress` 가 1 을 넘으면 0 대로 돌아간다 (`- 1` 이지 `= 0` 이 아니다 — 튀지 않게)
- 시드 난수가 같은 시드에서 같은 수열을 낸다

`npm test` 는 기존 136개를 그대로 통과해야 한다.

## 육안 확인 항목 (사용자)

브라우저가 이 세션에서 안 열리므로 사용자가 본다.

1. 섬 뒤로 구름이 보이고 천천히 옆으로 흐르는가
2. 구름이 원숭이를 가리지 않는가 — 조준했을 때도
3. 지평선에 먼 섬 실루엣이 흐리게 보이는가
4. 새 무리가 하늘 위쪽을 가로지르고, 다 지나가면 다시 나타나는가
5. 새를 조준해서 쏴도 아무 일도 안 일어나는가 (맞힘 판정 없음)
6. 마지막 처치 슬로모가 걸릴 때 구름과 새도 같이 느려지는가
7. 프레임이 눈에 띄게 떨어지지 않는가
