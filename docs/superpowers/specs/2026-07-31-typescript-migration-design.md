# TypeScript 전환 설계 (2026-07-31)

## 문제

ShootShoot을 [Verse8](https://about.verse8.io/)에 출시하려면 TypeScript 기반이어야 한다.
같은 사용자의 [TowerWar](https://github.com/Jujeongmin/TowerWar)가 이미 그 규약으로 올라가 있고,
그 저장소가 이 작업의 기준선이다.

## 이미 맞는 것

TowerWar의 `vite.config.ts` 주석이 규약을 명시한다 —
*"Verse8 업로드 규약에 맞춰 클라이언트 소스 전체를 game/ 아래에 둔다."*

ShootShoot의 배치는 **이미 같다**:

```
root: 'game'   outDir: '../dist'   game/index.html   game/public/
```

그래서 이 작업의 범위는 **언어 전환 하나**다. 디렉터리 구조도, 빌드 산출물 위치도 안 바뀐다.

## TowerWar와의 차이

| | TowerWar | ShootShoot (현재) |
|---|---|---|
| 빌드 | `tsc && vite build` | `vite build` |
| tsconfig | strict 외 4개 옵션, `include: ["game/src"]` | 없음 |
| 타입 패키지 | `@types/three` | 없음 |
| 설정 파일 | `vite.config.ts` | `vite.config.js`, `vitest.config.js` |
| 테스트 | **없음** | vitest 218개 (27개 파일) |
| 배포 | `npx @agent8/deploy` | 없음 |
| 멀티플레이 | `@agent8/gameserver` | 불필요 (싱글플레이) |

**TowerWar에는 테스트가 없어서 참고할 선례가 없다.** ShootShoot의 218개 테스트를 어떻게
다룰지는 이 문서가 새로 정한다.

## 규모

- `game/src` — 48개 모듈, 4,303줄. 가장 큰 파일은 `gameplay/game.js` 795줄, 다음이
  `gameplay/obstacles.js` 462줄
- `test` — 27개 파일, 1,858줄
- `tools` — 7개 `.mjs` 스크립트

## 확정된 결정

사용자 선택이다. 뒤집지 말 것.

1. **테스트도 TypeScript로 옮긴다.** `test/*.ts`, tsconfig가 `test` 도 본다.
2. **한 번에 전부 옮긴다.** 절반만 TS인 상태로 두지 않는다.
3. **엄격함은 TowerWar와 동일하게** 간다.

## tsconfig

TowerWar 것을 그대로 쓰되 `include` 만 다르다 — 테스트를 같이 검사해야 하기 때문이다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["game/src", "test"]
}
```

`noEmit: true` 이므로 `tsc` 는 **타입 검사만** 한다. 실제 번들은 Vite가 만든다.
빌드 스크립트가 `tsc && vite build` 가 되어, 타입이 깨지면 빌드가 멈춘다.

## 전환 중에만 켜는 `allowJs`

파일을 한꺼번에 다 옮길 수는 없다. `.ts` 파일이 아직 `.js` 인 모듈을 import하면
`allowJs` 없이는 선언 파일을 못 찾아 `tsc` 가 멈춘다.

그래서 전환 작업 동안만 `"allowJs": true, "checkJs": false` 를 켜 두고, **마지막 태스크에서
두 줄을 지운다.** 지운 뒤 `tsc` 가 깨끗해야 전환이 끝난 것이다.

이건 컴파일러 옵션 하나를 임시로 켜는 기계적인 조치이지, 사용자가 거절한
"점진 전환"이 아니다. 최종 상태에 `.js` 소스는 한 개도 남지 않는다.

## import 지정자

현재는 `./foo.js` 로 확장자를 붙여 쓴다. `moduleResolution: bundler` 는 확장자 없는
지정자를 위해 만들어진 모드이고 Vite와 vitest 둘 다 해석한다.

**`game/src` 와 `test` 안에서는 확장자를 뗀다** (`./foo`). `.ts` 파일을 `.js` 로 가리키는
지정자를 남기면 읽는 사람이 매번 헷갈린다.

## 손봐야 하는 진입점

파일 이름이 바뀌므로 이름을 박아 둔 곳이 같이 바뀐다.

| 위치 | 지금 | 바뀔 값 |
|---|---|---|
| `game/index.html:15` | `src="/src/main.js"` | `src="/src/main.ts"` |
| `game/thumb.html:71` | `from './src/config.js'` | `from './src/config.ts'` |
| `vitest.config.js` | `include: ['test/**/*.test.js']` | `test/**/*.test.ts` |
| `package.json` build | `vite build` | `tsc && vite build` |

`vite.config.js` 와 `vitest.config.js` 도 `.ts` 로 바꾼다 — TowerWar가 `vite.config.ts` 를 쓴다.
설정 파일은 `include` 밖이라 `tsc` 가 검사하지 않지만, Vite가 자체적으로 처리한다.

## `tools/` 는 JavaScript로 남는다

7개 `.mjs` 스크립트는 게임이 아니라 Node로 직접 돌리는 도구다. tsconfig `include` 밖이고
이름도 안 바꾼다.

하나만 걸린다. `tools/bake-weapon-art.mjs:36` 이 `await import('../game/src/config.js')` 로
무기 목록을 읽는다. 이 프로젝트의 Node는 **v24.18.0** 이고 `.ts` 파일의 타입을 자체적으로
벗겨 실행한다 — 확인했다:

```
$ node _t.ts
strip ok 1
```

따라서 지정자를 `../game/src/config.ts` 로 바꾸면 그대로 돈다. **대신 `config.ts` 는
지울 수 있는(erasable) 문법만 써야 한다** — `enum`, `namespace`, 생성자 매개변수 프로퍼티는
Node의 타입 제거가 거부한다. 타입 별칭·인터페이스·`satisfies` 는 괜찮다.

전환이 끝나면 `node tools/bake-weapon-art.mjs heavy` 가 실제로 도는지 확인한다.

## 타입을 어디까지 손으로 쓸 것인가

**기본값은 추론이다.** 이 코드베이스는 팩토리 함수가 객체 리터럴을 반환하는 형태라
TypeScript가 반환 타입을 잘 뽑아낸다. 반환 타입을 전부 손으로 적으면 4,300줄짜리
프로젝트에 중복 선언이 한 겹 더 생긴다.

**손으로 쓰는 것은 모듈 경계를 넘나드는 계약뿐이다.** 그 계약이 곧 이 프로젝트의 설계 문서
여기저기에 이미 글로 적혀 있는 것들이다:

| 타입 | 사는 곳 | 왜 손으로 쓰나 |
|---|---|---|
| `Weapon` | `config.ts` | `CONFIG.weapons` 원소. 상점·뷰모델·사격이 전부 읽는다. `test/weapons.test.js` 가 필드 열 개를 검사한다 |
| `RoundParams` | `difficulty.ts` | `getRoundParams` 반환. `targetManager` 가 통째로 쓴다 |
| `StructureSlot` | `obstacles.ts` | `{ x, y, z, towerIndex, sway: { amplitude, frequencyPerSpeed, phase } }`. 통로 작업이 방금 정한 계약이다 |
| `PatrolSample` | `patrolMotion.ts` | `{ offsetX, facing, gaitDelta, taunt, speed }` |
| `Monkey` | `monkey.ts` | `createMonkey` 반환. `targetManager` 와 `game` 이 메서드 열 개 남짓을 부른다 |

나머지는 추론에 맡긴다.

## strict가 실제로 터뜨릴 자리

미리 알아 두면 계획서가 이 지점들을 태스크로 나눌 수 있다.

1. **`Object3D.userData` 가 `any` 다.** `monkey.js` 는 `{ monkeyId }`, `obstacles.js` 는
   `{ towerIndex }` 를 심고 `game.js` 가 읽는다. 공용 인터페이스를 선언하고 심는 쪽·읽는
   쪽 양쪽에 붙인다.
2. **DOM이 `null` 을 돌려준다.** `main.js` 의 `document.getElementById('app')` 은
   `HTMLElement | null` 이다. 여기서 한 번 확인하고 넘긴다.
3. **CSS import.** `main.js` 가 `./ui/theme.css` 를 import한다. `game/src/vite-env.d.ts` 에
   `/// <reference types="vite/client" />` 를 넣어야 타입이 잡힌다.
4. **`noUnusedParameters`.** 콜백에서 안 쓰는 인자는 지우거나 `_` 를 앞에 붙인다.
5. **`isolatedModules`.** 타입만 다시 내보낼 때는 `export type` 을 써야 한다.
6. **`@types/three` 버전을 `three` 에 맞춘다.** 현재 `three@^0.166.1` 이므로
   `@types/three@^0.166` 이다. **three 버전을 올리지 않는다** — 그건 별개의 위험이다.

## 순서

의존성이 얕은 쪽부터 올린다. `.ts` 가 `.js` 를 import하는 구간은 `allowJs` 가 받쳐 준다.

1. **도구 설정** — 패키지, tsconfig, 설정 파일 `.ts` 화, `vite-env.d.ts`, 진입점.
   소스는 아직 안 건드린다
2. **순수 모듈** — THREE도 DOM도 안 쓰는 것들. `difficulty`, `monkeyAllocation`,
   `patrolMotion`, `laneLayout`, `scoring`, `shooting`, `reloadState`, `tutorialState`,
   `screenTargeting`, `offlineReward`, `weaponButtonState`, `skyMotion`, `config`,
   그리고 `localStorage` 만 쓰는 `*Store` 들
3. **THREE를 쓰는 게임플레이** — `engine`, `input`, `world`, `skyDecor`, `debris`,
   `effects`, `monkeyModel`, `monkey`, `targetManager`, `obstacles`, `weaponViewmodel`,
   `bazookaProjectile`, `lastKillEffect`, `sfx`, `adSdk`
4. **UI** — `kit`, `screens`, `shopPanel`, `hud`, `scopeOverlay`, `settingsPanel`,
   `roundSelect`, `confirmPopup`, `offlineRewardPopup`, `stageBanner`, `tutorialPrompt`
5. **`game.ts` 와 `main.ts`** — 795줄짜리가 여기 있다. 앞 단계가 다 올라와 있어야
   타입이 흘러들어온다
6. **테스트 27개 파일**
7. **`allowJs` 제거와 최종 확인**

## 검증

단계마다 이 셋이 통과해야 한다:

- `npx tsc --noEmit` — 그 단계까지 올린 파일에 타입 오류가 없다
- `npm test` — 218개 통과. **vitest는 타입을 검사하지 않고 벗겨내기만 하므로 전환 중에도
  계속 돈다.** 이게 이 작업의 안전망이다
- `npm run build` — 성공

마지막에 추가로:

- `node tools/bake-weapon-art.mjs heavy` 가 돈다 (Node의 타입 제거 경로)
- `git mv` 로 이름을 바꿔 파일 이력이 끊기지 않는다
- 사용자가 개발 서버에서 게임이 뜨는지 확인한다. **타입 검사는 런타임을 보장하지 않는다** —
  이 전환에서 게임이 실제로 도는지는 육안 확인이 유일한 증거다

## 범위 밖

- **`three` 버전 올리기.** TowerWar는 0.185, 여기는 0.166이다. 별개 작업이다
- **`@agent8/deploy` 와 배포 절차.** 실제로 올릴 때 정한다
- **`@agent8/gameserver`.** ShootShoot은 싱글플레이라 필요 없다
- **`tools/*.mjs` 를 TS로 올리기.** 게임 코드가 아니다
- **코드 구조 개선.** `game.ts` 795줄을 쪼개고 싶은 마음이 들겠지만, 언어 전환과
  구조 변경을 한 커밋에 섞으면 무엇이 무엇을 깨뜨렸는지 못 가린다. 나중에 따로 한다
