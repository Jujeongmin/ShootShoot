# TypeScript 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `game/src` 48개 모듈과 `test` 27개 파일을 TypeScript로 옮기고, `tsc --noEmit` 이 깨끗한 상태로 `allowJs` 없이 빌드되게 한다.

**Architecture:** 도구 설정을 먼저 깔고, 그 안에서 의존성이 얕은 쪽부터 파일을 `git mv` 로 옮긴다. 전환 중에만 `allowJs` 를 켜서 `.ts` 가 아직 `.js` 인 모듈을 import할 수 있게 하고, 마지막 태스크에서 뗀다. vitest는 타입을 검사하지 않고 벗겨내기만 하므로 219개 테스트가 전 과정에서 안전망으로 계속 돈다.

**Tech Stack:** TypeScript 5, Vite 5, vitest 1, three 0.166 + `@types/three`

**설계 문서:** [2026-07-31-typescript-migration-design.md](../specs/2026-07-31-typescript-migration-design.md)

## Global Constraints

- 작업 브랜치는 `dev` 직접 커밋. worktree 쓰지 말 것.
- **태스크마다 커밋하고 `git push` 까지 한다.** 사용자 상시 지시다.
- **브라우저를 쓰지 말 것.** 이 환경에서 브라우저 창이 안 열린다. 육안 확인은 사용자가 한다.
- `python` 이 없다. 파일 수정은 Edit 툴이나 `node -e` 로 한다.
- 셸 문법을 섞지 말 것. 커밋은 `git commit -m "제목" -m "본문"` 형태로 한다.
- 파일 이름 변경은 **반드시 `git mv`** 로 한다. `rm` + 새로 쓰기를 하면 파일 이력이 끊긴다.
- **런타임 동작을 바꾸지 말 것.** 이건 언어 전환이다. 타입을 맞추려고 로직을 고쳐야 할 것 같으면 멈추고 보고한다.
- **`three` 버전을 올리지 말 것.** `@types/three` 를 현재 `three@^0.166.1` 에 맞춘다.
- `game.ts` 를 쪼개지 말 것. 795줄이지만 구조 변경은 이 계획 밖이다.
- `tools/*.mjs` 는 JavaScript로 남는다. 이름도 안 바꾼다.
- **타입은 추론에 맡기는 것이 기본이다.** 모듈 경계를 넘는 계약만 손으로 쓴다.
- 주석은 한국어로, 왜 그런지를 쓴다.
- 검증 명령 셋: `npx tsc --noEmit`, `npm test`, `npm run build`. 시작 시점 테스트는 219개다.

---

## 파일 구조

| 묶음 | 파일 | 특징 |
|---|---|---|
| 도구 설정 | `tsconfig.json`(신규), `vite.config.ts`, `vitest.config.ts`, `game/src/vite-env.d.ts`(신규), `package.json` | 소스는 안 건드린다 |
| 순수 모듈 23개 | `config`, `ui/weaponButtonState`, `gameplay/`의 `adSdk` `bazookaStore` `currencyStore` `debris` `difficulty` `gameReset` `laneLayout` `lastKillEffect` `monkeyAllocation` `offlineReward` `patrolMotion` `progressStore` `reloadState` `scoring` `screenTargeting` `settingsStore` `shooting` `skyMotion` `tutorialState` `tutorialStore` `upgradeStore` `weaponStore` | THREE도 DOM도 안 쓴다. 스토어는 `storage` 를 주입받는다 |
| THREE·런타임 12개 | `core/engine` `core/input` `audio/sfx`, `gameplay/`의 `world` `skyDecor` `effects` `monkeyModel` `monkey` `targetManager` `obstacles` `weaponViewmodel` `bazookaProjectile` | `@types/three` 가 필요한 곳 |
| UI 11개 | `ui/`의 `kit` `screens` `shopPanel` `hud` `scopeOverlay` `settingsPanel` `roundSelect` `confirmPopup` `offlineRewardPopup` `stageBanner` `tutorialPrompt` | DOM 조립 |
| 마지막 2개 | `gameplay/game`(795줄), `main` | 앞이 다 올라와야 타입이 흘러든다 |
| 테스트 27개 | `test/*.test.js` | |

---

### Task 1: 도구 설정과 import 지정자 정리

**Files:**
- Create: `tsconfig.json`, `game/src/vite-env.d.ts`
- Rename: `vite.config.js` → `vite.config.ts`, `vitest.config.js` → `vitest.config.ts`
- Modify: `package.json`, `game/src/**/*.js`와 `test/**/*.js`의 import 줄

**Interfaces:**
- Consumes: 없음
- Produces: 이후 모든 태스크가 기대는 두 가지 —
  1. `tsconfig.json` 이 `allowJs: true` 로 켜져 있어 `.ts` 가 `.js` 를 import할 수 있다
  2. `game/src` 와 `test` 안의 상대 import가 **전부 확장자 없는 형태**다

**왜 지정자를 먼저 정리하나.** Vite는 `./foo.js` 라는 지정자를 `foo.ts` 로 다시 찾아 주는 일을 **importer가 TypeScript 파일일 때만** 한다. 아직 `.js` 인 모듈이 이미 `.ts` 가 된 모듈을 `./foo.js` 로 가리키면 dev 서버와 빌드가 거기서 깨진다. 확장자를 미리 다 떼어 두면 이후 태스크는 `git mv` 만 하면 되고 중간 상태가 항상 돌아간다.

- [ ] **Step 1: 패키지를 넣는다**

```bash
npm install --save-dev typescript@^5.6.3 @types/three@^0.166.0
```

`three` 는 `^0.166.1` 그대로 둔다. 버전을 올리지 말 것.

- [ ] **Step 2: tsconfig.json 을 만든다**

TowerWar 것과 같되 `include` 에 `test` 가 더 있고, 전환 중에만 쓰는 두 줄이 붙는다.

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
    "noEmit": true,

    "allowJs": true,
    "checkJs": false
  },
  "include": ["game/src", "test"]
}
```

`allowJs` / `checkJs` 두 줄은 **Task 7에서 지운다.** 그때까지는 아직 `.js` 인 모듈을
`.ts` 가 import할 수 있게 해 주는 임시 장치다. 빈 줄과 함께 맨 아래 둔 이유가 그것이다.

- [ ] **Step 3: vite-env.d.ts 를 만든다**

`main.js` 가 `./ui/theme.css` 를 import한다. Vite의 앰비언트 타입이 없으면 `.css` import에서 타입 오류가 난다.

`game/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: 설정 파일 둘을 TypeScript로 옮긴다**

```bash
git mv vite.config.js vite.config.ts
git mv vitest.config.js vitest.config.ts
```

내용은 안 바꾼다 — 둘 다 `defineConfig` 를 쓰는 ESM이라 그대로 타입이 붙는다.
두 파일은 `include` 밖이라 `tsc` 가 검사하지 않는다. Vite와 vitest가 각자 처리한다.

`vitest.config.ts` 의 `include` 만 전환 기간 동안 양쪽을 받게 고친다.

```ts
    include: ['test/**/*.test.{js,ts}'],
```

Task 6이 끝나면 `.ts` 만 남긴다.

- [ ] **Step 5: 빌드 스크립트에 타입 검사를 넣는다**

`package.json` 의 `scripts.build` 를 바꾼다.

```json
    "build": "tsc && vite build",
```

같은 자리에 검사 전용 스크립트를 더한다. 이후 태스크가 이걸 쓴다.

```json
    "typecheck": "tsc --noEmit",
```

- [ ] **Step 6: import 지정자에서 확장자를 뗀다**

`game/src` 와 `test` 안의 **상대 경로** import에서만 `.js` 를 뗀다.

```bash
node -e "const fs=require('fs'),p=require('path');function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.js')){const s=fs.readFileSync(f,'utf8');const o=s.replace(/(from\s+['\"])(\.[^'\"]*?)\.js(['\"])/g,'\$1\$2\$3');if(o!==s){fs.writeFileSync(f,o);console.log('rewrote',f);}}}}walk('game/src');walk('test');"
```

건드리면 안 되는 것들 — 위 정규식이 상대 경로(`.` 로 시작)만 잡으므로 자동으로 빠지지만, 확인은 해라:

- `main.js` 의 `import './ui/theme.css'` — CSS는 확장자가 필요하다
- `'three'`, `'three/examples/jsm/...'` — 패키지 지정자다
- `game/index.html` 의 `src="/src/main.js"` — Task 5에서 바꾼다
- `game/thumb.html` 의 `'./src/config.js'` — Task 2에서 바꾼다
- `tools/bake-weapon-art.mjs` 의 `'../game/src/config.js'` — Node가 실행하므로 확장자가 **필요하다**. Task 2에서 `.ts` 로 바꾼다

- [ ] **Step 7: 셋 다 통과하는지 본다**

Run: `npm run typecheck`
Expected: 오류 없음 (`.ts` 소스가 아직 없고 `.js` 는 `checkJs: false` 로 검사 대상이 아니다)

Run: `npm test`
Expected: PASS — 219개

Run: `npm run build`
Expected: 성공

- [ ] **Step 8: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "build: set up TypeScript alongside the existing JavaScript" -m "The compiler is wired in with allowJs so files can move one group at a time, and the build now typechecks before bundling. Relative imports lose their .js extension up front because Vite only remaps a .js specifier onto a .ts file when the importer is itself TypeScript -- doing it now keeps every intermediate state runnable."
git push
```

---

### Task 2: 순수 모듈 23개

**Files:**
- Rename: 아래 23개를 `.ts` 로
- Modify: `game/thumb.html:71`, `tools/bake-weapon-art.mjs:36`

```
game/src/config.js
game/src/ui/weaponButtonState.js
game/src/gameplay/adSdk.js
game/src/gameplay/bazookaStore.js
game/src/gameplay/currencyStore.js
game/src/gameplay/debris.js
game/src/gameplay/difficulty.js
game/src/gameplay/gameReset.js
game/src/gameplay/laneLayout.js
game/src/gameplay/lastKillEffect.js
game/src/gameplay/monkeyAllocation.js
game/src/gameplay/offlineReward.js
game/src/gameplay/patrolMotion.js
game/src/gameplay/progressStore.js
game/src/gameplay/reloadState.js
game/src/gameplay/scoring.js
game/src/gameplay/screenTargeting.js
game/src/gameplay/settingsStore.js
game/src/gameplay/shooting.js
game/src/gameplay/skyMotion.js
game/src/gameplay/tutorialState.js
game/src/gameplay/tutorialStore.js
game/src/gameplay/upgradeStore.js
game/src/gameplay/weaponStore.js
```

**Interfaces:**
- Consumes: Task 1의 `tsconfig.json`(`allowJs` 켜짐)과 확장자 없는 import
- Produces: 이후 태스크가 import할 타입들 —

```ts
// config.ts
export interface WeaponModel {
  id: string;
  name: string;
  model: string;
  format: 'glb' | 'fbx';
  scale: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface Weapon extends WeaponModel {
  damage: number;
  price: number;
  image: string;
}
```

```ts
// difficulty.ts
export interface RoundParams {
  roundNumber: number;
  monkeyCount: number;
  monkeySpeed: number;
  monkeyScale: number;
  monkeyHp: number;
}
```

```ts
// patrolMotion.ts
export interface PatrolSample {
  offsetX: number;
  facing: number;
  gaitDelta: number;
  stride: number;
  taunt: number;
}
```

`CONFIG.bazooka.weapon` 은 `damage`·`price`·`image` 가 없다. 그래서 `WeaponModel` 과
`Weapon` 이 나뉘어 있다 — 바주카는 `WeaponModel`, `CONFIG.weapons` 원소는 `Weapon` 이다.

- [ ] **Step 1: 파일을 옮긴다**

23개를 `git mv` 로 하나씩 옮긴다. 예:

```bash
git mv game/src/config.js game/src/config.ts
```

- [ ] **Step 2: config.ts 에 타입을 붙인다**

위 `WeaponModel` / `Weapon` 인터페이스를 넣고 `CONFIG` 의 해당 자리에 붙인다.
나머지 필드는 추론에 맡긴다 — `CONFIG` 전체를 인터페이스로 다시 쓰지 말 것.

**`config.ts` 는 지울 수 있는(erasable) 문법만 써야 한다.** `enum`, `namespace`,
생성자 매개변수 프로퍼티는 안 된다. `tools/bake-weapon-art.mjs` 가 Node로 이 파일을
직접 import하는데, Node의 타입 제거가 그 문법들을 거부한다. 인터페이스·타입 별칭·
`satisfies` 는 괜찮다.

- [ ] **Step 3: Node와 HTML이 가리키는 경로를 고친다**

`tools/bake-weapon-art.mjs:36` — Node가 실행하므로 확장자가 필요하다:

```js
const { CONFIG } = await import('../game/src/config.ts');
```

`game/thumb.html:71`:

```js
      import { CONFIG } from './src/config.ts';
```

- [ ] **Step 4: 타입 오류를 없앤다**

Run: `npm run typecheck`

나오는 오류를 고친다. 이 묶음에서 예상되는 것들:

- 함수 매개변수에 암묵적 `any` — 인자 타입을 적는다
- 스토어의 `storage` 매개변수 — DOM 라이브러리의 `Storage` 타입을 쓴다
- `Number.parseInt` 가 `string | null` 을 못 받는 자리 — 이미 `raw === null` 로 갈라
  놓았으므로 대개 좁혀진다
- `noUnusedParameters` 에 걸리는 콜백 인자 — 지우거나 `_` 를 앞에 붙인다

**로직을 바꾸지 말 것.** 타입을 맞추려고 동작을 고쳐야 할 것 같으면 멈추고 보고한다.

- [ ] **Step 5: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 219개
Run: `npm run build` → 성공
Run: `node tools/bake-weapon-art.mjs heavy` → 성공. **Node의 타입 제거 경로가 실제로
도는지 여기서 처음 확인한다.** 실패하면 `config.ts` 에 지울 수 없는 문법이 들어간 것이다

마지막 명령이 `heavy.png` 를 다시 쓴다. 내용이 같아야 정상이다:

```bash
git status --porcelain game/public/images/weapons/heavy.png
```

Expected: 아무것도 안 나온다. 뭔가 나오면 굽기 결과가 달라진 것이니 보고한다.
(다시 자를 필요는 없다 — `crop-weapon-art.mjs` 는 돌리지 말 것. 이미 잘린 파일이다.)

- [ ] **Step 6: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "refactor: move the pure modules to TypeScript" -m "The logic, the stores and the config. None of these touch three or the DOM, so they type cleanly and give the rest of the migration something to lean on.

Weapon splits into WeaponModel and Weapon because the bazooka entry carries no damage, price or art. config.ts stays free of enums and namespaces so Node's type stripping can keep importing it from the art baker."
git push
```

---

### Task 3: THREE와 런타임 모듈 12개

**Files:**
- Rename: 아래 12개를 `.ts` 로

```
game/src/core/engine.js
game/src/core/input.js
game/src/audio/sfx.js
game/src/gameplay/world.js
game/src/gameplay/skyDecor.js
game/src/gameplay/effects.js
game/src/gameplay/monkeyModel.js
game/src/gameplay/monkey.js
game/src/gameplay/targetManager.js
game/src/gameplay/obstacles.js
game/src/gameplay/weaponViewmodel.js
game/src/gameplay/bazookaProjectile.js
```

**Interfaces:**
- Consumes: Task 2의 `Weapon`, `WeaponModel`, `RoundParams`, `PatrolSample`
- Produces:

```ts
// obstacles.ts
export interface StructureSlot {
  x: number;
  y: number;
  z: number;
  towerIndex: number;
  sway: { amplitude: number; frequencyPerSpeed: number; phase: number };
}
```

```ts
// monkey.ts
export type Monkey = ReturnType<typeof createMonkey>;
```

`Monkey` 를 손으로 나열하지 않는 이유: `createMonkey` 가 반환하는 객체 리터럴에서
TypeScript가 메서드 열 몇 개를 그대로 뽑아낸다. 손으로 쓰면 같은 목록이 두 벌이 된다.

- [ ] **Step 1: 파일을 옮긴다**

12개를 `git mv` 로 옮긴다.

- [ ] **Step 2: userData 인터페이스를 만든다**

three의 `Object3D.userData` 는 `any` 다. 심는 쪽과 읽는 쪽이 서로를 모른 채 문자열
키로 통신하고 있는데, 이게 이 코드베이스에서 타입이 가장 쉽게 어긋나는 자리다.

`game/src/gameplay/hitUserData.ts` 를 새로 만든다.

```ts
// three의 Object3D.userData는 any라서, 심는 쪽(monkey/obstacles)과 읽는 쪽(game)이
// 서로를 모른 채 문자열 키로 통신한다. 그 계약을 한 곳에 적어 둔다.
export interface HitUserData {
  monkeyId?: string;
  towerIndex?: number;
}
```

`monkey.ts` 가 `{ monkeyId: id }` 를, `obstacles.ts` 가 `{ towerIndex }` 를 심을 때
이 타입을 붙인다. 읽는 쪽인 `game.ts` 는 Task 5에서 붙인다.

- [ ] **Step 3: 타입 오류를 없앤다**

Run: `npm run typecheck`

이 묶음에서 예상되는 것들:

- `document.createElement('canvas')` 의 `getContext('2d')` 가 `null` 을 반환할 수 있다
  (`monkey.ts` 의 HP 바). 한 번 확인하고 넘긴다
- `THREE.Material` 의 `color` / `specular` 는 기본 `Material` 에 없다. 실제로 쓰는
  타입(`MeshPhongMaterial` 등)으로 좁히거나 존재를 확인하고 쓴다. 지금 코드가
  `material.color ? ... : ...` 로 이미 확인하는 자리가 있다
- `getObjectByName` 이 `Object3D | undefined` 를 반환한다. `obstacles.ts` 와 `monkey.ts`가
  이미 `null` 검사를 하고 있다
- `sfx.ts` 의 `AudioContext` — `window.webkitAudioContext` 같은 접두사 접근이 있으면
  타입 단언이 필요하다

**로직을 바꾸지 말 것.**

- [ ] **Step 4: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 219개
Run: `npm run build` → 성공

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "refactor: move the three.js and runtime modules to TypeScript" -m "The scene, the models, the monkeys, the obstacles and the audio.

Object3D.userData is any, which is where the monkey id and the tower index cross between the module that plants them and the module that reads them. That contract now lives in one file instead of being two string keys that happen to agree."
git push
```

---

### Task 4: UI 모듈 11개

**Files:**
- Rename: 아래 11개를 `.ts` 로

```
game/src/ui/kit.js
game/src/ui/screens.js
game/src/ui/shopPanel.js
game/src/ui/hud.js
game/src/ui/scopeOverlay.js
game/src/ui/settingsPanel.js
game/src/ui/roundSelect.js
game/src/ui/confirmPopup.js
game/src/ui/offlineRewardPopup.js
game/src/ui/stageBanner.js
game/src/ui/tutorialPrompt.js
```

**Interfaces:**
- Consumes: Task 2의 `Weapon`
- Produces: UI 패널들의 `show(state, handlers)` 시그니처. 손으로 인터페이스를 쓰지 말고
  추론에 맡긴다 — 호출부인 `game.ts` 가 Task 5에서 붙으면서 맞춰진다

- [ ] **Step 1: 파일을 옮긴다**

11개를 `git mv` 로 옮긴다.

- [ ] **Step 2: 타입 오류를 없앤다**

Run: `npm run typecheck`

이 묶음에서 예상되는 것들:

- `document.getElementById` / `querySelector` 가 `null` 을 반환한다
- `createElement('img')` 의 결과가 `HTMLElement` 로 좁혀지지 않아 `.src` 가 없다고 나온다.
  `createElement` 는 태그 이름 리터럴을 주면 정확한 타입을 준다 — 변수로 넘기고 있으면
  그 자리를 리터럴로 바꾼다
- 이벤트 핸들러의 `event.target` 이 `EventTarget | null` 이다
- `kit.ts` 의 `button(label, onClick, variant)` 같은 헬퍼는 `variant` 를 문자열 유니온으로
  좁혀 두면 호출부 오타가 잡힌다 (`'primary' | 'ghost' | 'off'` 등 실제 쓰이는 값으로)

**로직을 바꾸지 말 것.**

- [ ] **Step 3: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 219개
Run: `npm run build` → 성공

- [ ] **Step 4: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "refactor: move the UI modules to TypeScript" -m "Panels, popups, the HUD and the shared kit. The panel variants become string unions, so a typo in a button style is now a compile error rather than a button that silently renders wrong."
git push
```

---

### Task 5: game.ts 와 main.ts, 그리고 진입점

**Files:**
- Rename: `game/src/gameplay/game.js` → `.ts`, `game/src/main.js` → `.ts`
- Modify: `game/index.html:15`

**Interfaces:**
- Consumes: 앞의 모든 타입. 특히 `Monkey`, `StructureSlot`, `HitUserData`, `Weapon`, `RoundParams`
- Produces: 없음. 여기가 잎이 아니라 뿌리다

`game.ts` 는 795줄이고 앞 태스크에서 만든 타입이 전부 여기로 모인다. 오류가 가장
많이 나올 태스크다.

- [ ] **Step 1: 파일을 옮긴다**

```bash
git mv game/src/gameplay/game.js game/src/gameplay/game.ts
git mv game/src/main.js game/src/main.ts
```

- [ ] **Step 2: HTML 진입점을 고친다**

`game/index.html:15`:

```html
    <script type="module" src="/src/main.ts"></script>
```

- [ ] **Step 3: main.ts 의 null 을 처리한다**

`document.getElementById('app')` 은 `HTMLElement | null` 이다. 여기서 한 번 확인하고
넘긴다 — 아래로 내려가면 확인할 자리가 흩어진다.

```ts
const container = document.getElementById('app');
// index.html이 이 요소를 갖고 있다. 없으면 게임이 붙을 곳이 없으니 조용히 넘어가면 안 된다.
if (!container) throw new Error('#app 요소를 찾을 수 없다');
```

- [ ] **Step 4: 타입 오류를 없앤다**

Run: `npm run typecheck`

이 묶음에서 예상되는 것들:

- `intersection.object.userData` 를 읽는 자리에 Task 3의 `HitUserData` 를 붙인다.
  `towerIndex` 는 `0` 일 수 있어서 `!== undefined` 로 검사하는 기존 코드가 이미 맞다
- `targetManager` / `obstacles` 가 `Promise` 뒤에 늦게 채워지는 모듈 변수라 `strict` 가
  "할당 전 사용"으로 잡을 수 있다. 지금 구조를 바꾸지 말고 타입으로 표현한다
- `startGame(round)` 의 인자가 모듈 변수 `round` 를 가린다는 건 예전부터 알려진 것이다.
  **이번에 고치지 말 것** — 타입 오류가 아니다
- `noUnusedLocals` 가 안 쓰는 지역 변수를 잡는다. 지운다

**로직을 바꾸지 말 것.**

- [ ] **Step 5: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 219개
Run: `npm run build` → 성공

- [ ] **Step 6: game/src 에 .js 가 남았는지 본다**

Grep 툴로 `game/src` 에서 `\.js$` 로 끝나는 파일을 찾는다.
Expected: 없음. `game/src` 는 이제 전부 `.ts` 다

- [ ] **Step 7: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "refactor: move the game loop and entry point to TypeScript" -m "The last of game/src. Every type the earlier groups defined converges here, which is why it went last.

The raycast hit path now reads userData through the declared shape instead of poking at any, and main.ts refuses to start rather than continuing with a null container."
git push
```

---

### Task 6: 테스트 27개 파일

**Files:**
- Rename: `test/*.test.js` 27개를 `.ts` 로
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `game/src` 의 모든 타입
- Produces: 없음

- [ ] **Step 1: 파일을 옮긴다**

27개를 `git mv` 로 옮긴다.

```bash
for f in test/*.test.js; do git mv "$f" "${f%.js}.ts"; done
```

- [ ] **Step 2: vitest 가 .ts 만 보게 한다**

`vitest.config.ts`:

```ts
    include: ['test/**/*.test.ts'],
```

- [ ] **Step 3: 타입 오류를 없앤다**

Run: `npm run typecheck`

이 묶음에서 예상되는 것들:

- 테스트가 만드는 가짜 객체(스토어에 넘기는 메모리 `storage` 등)가 실제 타입에 안 맞는다.
  **테스트 쪽을 실제 타입에 맞춘다.** 소스 타입을 느슨하게 풀어서 맞추지 말 것
- 잘못된 입력을 일부러 넣는 테스트(예: `localStorage` 에 `'3.7'` 같은 소수 문자열)는
  의도된 것이다. 그 자리에는 왜 단언이 필요한지 한국어 주석을 달고 좁힌다
- `test/weapons.test.js` 가 무기 필드 열 개의 존재를 검사한다. `Weapon` 인터페이스가
  생겼으니 이제 컴파일 시점에도 잡히지만, **런타임 테스트를 지우지 말 것** —
  `toHaveProperty` 는 `undefined` 값도 통과시킨다는 한계가 이미 문서에 적혀 있고,
  그건 별개 문제다

- [ ] **Step 4: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 219개. **개수가 줄면 vitest가 파일을 놓친 것이다**
Run: `npm run build` → 성공

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "test: move the suite to TypeScript" -m "All 27 files. The fakes the tests hand to the stores now have to match the real shapes, which is most of what this change is."
git push
```

---

### Task 7: allowJs 제거와 최종 확인

**Files:**
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: 앞의 전부
- Produces: `.js` 소스가 하나도 없는 최종 상태

- [ ] **Step 1: 임시 두 줄을 지운다**

`tsconfig.json` 에서 아래 두 줄과 그 위 빈 줄을 지운다.

```json
    "allowJs": true,
    "checkJs": false
```

- [ ] **Step 2: 남은 .js 가 없는지 본다**

Grep 툴로 `game/src` 와 `test` 에서 `.js` 로 끝나는 파일을 찾는다.
Expected: 없음

`tools/*.mjs` 는 남아 있어야 한다. tsconfig `include` 밖이라 상관없다.

- [ ] **Step 3: 전부 다시 확인한다**

Run: `npm run typecheck`
Expected: 오류 없음. **`allowJs` 없이 통과해야 전환이 끝난 것이다**

Run: `npm test`
Expected: PASS — 219개

Run: `npm run build`
Expected: 성공

Run: `node tools/bake-weapon-art.mjs heavy`
Expected: 성공하고 `git status --porcelain game/public/images/weapons/heavy.png` 이 비어 있다

- [ ] **Step 4: 파일 이력이 안 끊겼는지 본다**

```bash
git log --follow --oneline -- game/src/gameplay/patrolMotion.ts | tail -3
```

Expected: `git mv` 를 썼다면 `.js` 시절 커밋이 같이 나온다. 안 나오면 이력이 끊긴 것이니
보고한다.

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "build: drop allowJs now that nothing is JavaScript" -m "game/src and test are entirely TypeScript, so the compiler no longer has to tolerate .js sources. tsc passing without that escape hatch is what finishes the migration."
git push
```

---

### Task 8: 사용자 육안 확인 요청

**Files:** 없음

- [ ] **Step 1: 개발 서버가 도는지 확인한다**

이미 떠 있으면 다시 띄우지 말 것. 주소는 `http://127.0.0.1:5174/` 다.

- [ ] **Step 2: 사용자에게 알린다**

브라우저를 직접 열지 말 것. **타입 검사는 런타임을 보장하지 않는다** — 이 전환에서
게임이 실제로 도는지는 육안 확인이 유일한 증거다. 아래를 물어본다.

1. 게임이 뜨고 라운드가 시작되나 (진입점 `main.ts` 가 제대로 물렸는지)
2. 상점·설정·라운드 선택 패널이 열리고 닫히나 (UI 묶음)
3. 사격·장전·바주카가 되나 (`game.ts`)
4. 원숭이가 걷고 구조물이 무너지나 (THREE 묶음)
5. 골드·무기·진행도가 새로고침 뒤에도 남아 있나 (스토어 묶음)

- [ ] **Step 3: 문제가 있으면 보고한다**

런타임이 깨졌다면 어느 묶음인지가 위 다섯 항목으로 좁혀진다. 고치고 다시 확인을 받는다.

---

## 이 계획이 손대지 않는 것

- `three` 버전 (0.166 유지)
- `@agent8/deploy` 와 배포 절차
- `tools/*.mjs`
- `game.ts` 795줄을 쪼개는 것
- 게임 로직·수치·연출 일체
- 이미 알려진 미결 사항들 (`startGame(round)` 의 변수 가림, `roundSelect` 가상화 없음,
  `progressStore` 의 소수 문자열 처리)
