# 전술 계기판 HUD 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이 중 화면의 라운드 숫자·점수 팝업·조준선을 전술 계기판 모양으로 다시 칠한다. 게임 규칙과 판정 치수는 하나도 안 바꾼다.

**Architecture:** 모양은 전부 `theme.css` 로 간다. `hud.ts` 는 클래스 이름만 붙인다. 브래킷은 라운드 숫자와 헤드샷 팝업 둘이 쓰므로 `.k-bracket` 하나로 구현하고 재사용한다. 팝업 세 종류를 고르는 우선순위 규칙은 순수 함수로 빼서 단위 테스트를 붙인다 — HUD에는 지금 테스트가 하나도 없다.

**Tech Stack:** TypeScript 5, Vite 5, vitest 1, 순수 CSS (프레임워크 없음)

**설계 문서:** [2026-08-02-hud-tactical-design.md](../specs/2026-08-02-hud-tactical-design.md)

## Global Constraints

- 작업 브랜치는 `dev` 직접 커밋. worktree 쓰지 말 것.
- **태스크마다 커밋하고 `git push` 까지 한다.** 사용자 상시 지시다.
- **브라우저를 쓰지 말 것.** 이 환경에서 브라우저 창이 안 열린다. 육안 확인은 사용자가 한다.
- `python` 이 없다. 파일 수정은 Edit 툴이나 `node -e` 로 한다.
- 셸 문법을 섞지 말 것. 커밋은 `git commit -m "제목" -m "본문"` 형태로 한다.
- **게임 규칙·수치·난이도를 바꾸지 말 것.** 이건 다시 칠하기다.
- **조준선 치수를 바꾸지 말 것.** 특히 `bazookaReticleHtml` 의 `arm` · `tickLength` · `tickOffset` · `outer` · `inner` 계산식. 이 수치는 바주카 판정 사각형의 경계다.
- **모듈 최상단에서 `window` · `document` · `localStorage` 를 읽지 말 것.** vitest가 `environment: 'node'` 로 돈다. `sfx.ts` 가 이걸 어겨서 import만 해도 `ReferenceError: window is not defined` 가 나던 버그가 커밋 `fe95b9a` 에서 고쳐졌다. 같은 실수를 반복하지 말 것.
- 새 파일은 처음부터 `.ts` 로 만든다. `game/src/ui/` 는 TypeScript 전환이 이미 끝났다.
- 색은 **반드시 CSS 변수**(`var(--k-face)` 등)를 쓴다. 새 색 리터럴을 만들지 말 것.
- 주석은 한국어로, 왜 그런지를 쓴다.
- 검증 명령 셋: `npm run typecheck`, `npm test`, `npm run build`. **시작 시점 테스트는 219개다.**

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `game/src/ui/scorePopupTone.ts` (신규) | 팝업 종류를 고르는 순수 함수 하나 | 1 |
| `test/scorePopupTone.test.ts` (신규) | 위 함수의 우선순위 계약 | 1 |
| `game/src/ui/theme.css` | 모양 전부 — `.k-bracket`, 라벨 막대, 팝업 세 클래스 | 2, 3 |
| `game/src/ui/hud.ts` | 클래스 이름만 붙인다 | 2, 3 |
| `game/src/gameplay/game.js` | 팝업 호출에 톤 인자 하나 추가 | 3 |
| `game/src/ui/scopeOverlay.ts` | 조준선 색·외곽선·눈금 | 4 |
| `test/scopeOverlay.test.ts` (신규) | 바주카 판정 치수 동결 | 4 |

`game.js` 는 아직 JavaScript다 (TypeScript 전환 Task 5가 나중에 옮긴다). **이름을 바꾸지 말 것.**

---

### Task 1: 팝업 종류를 고르는 순수 함수

**Files:**
- Create: `game/src/ui/scorePopupTone.ts`
- Test: `test/scorePopupTone.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: Task 3이 import한다 —

```ts
export type PopupTone = 'normal' | 'head' | 'combo';
export function scorePopupTone(outcome: {
  hits: { part: string }[];
  penetrationCount: number;
}): PopupTone;
```

**왜 따로 빼나.** HUD에는 지금 테스트가 하나도 없다. 우선순위 규칙을 순수 함수로 빼면 단위 테스트가 붙고 `hud.ts` 에는 DOM 조립만 남는다.

**우선순위는 관통 > 헤드샷 > 보통이다.** `game.js:453-463` 의 효과음 분기와 같은 순서여야 한다. 관통하면서 헤드샷인 발사는 소리가 `sfx.combo()` 로 나므로 화면도 관통으로 보여야 한다. 이 순서는 커밋 `54fa697` 에서 한 번 어긋났던 자리다 — 통로를 무너뜨려 둘을 죽였는데 콤보 효과음이 아니라 단발 효과음이 났었다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/scorePopupTone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scorePopupTone } from '../game/src/ui/scorePopupTone';

describe('scorePopupTone', () => {
  it('calls a plain body hit normal', () => {
    expect(scorePopupTone({ hits: [{ part: 'body' }], penetrationCount: 1 })).toBe('normal');
  });

  it('calls a single head hit a headshot', () => {
    expect(scorePopupTone({ hits: [{ part: 'head' }], penetrationCount: 1 })).toBe('head');
  });

  it('calls a multi-kill a combo', () => {
    expect(
      scorePopupTone({ hits: [{ part: 'body' }, { part: 'body' }], penetrationCount: 2 })
    ).toBe('combo');
  });

  // 회귀 방어. game.js는 효과음을 고를 때 penetrationCount를 part보다 먼저 본다.
  // 화면만 head로 뜨면 소리는 콤보인데 그림은 헤드샷인 불일치가 난다.
  it('lets a combo outrank a headshot, matching the sfx ordering', () => {
    expect(scorePopupTone({ hits: [{ part: 'head' }], penetrationCount: 3 })).toBe('combo');
  });

  it('falls back to normal when no hit was recorded', () => {
    expect(scorePopupTone({ hits: [], penetrationCount: 1 })).toBe('normal');
  });

  it('treats a zero penetration count as normal rather than combo', () => {
    expect(scorePopupTone({ hits: [{ part: 'body' }], penetrationCount: 0 })).toBe('normal');
  });
});
```

- [ ] **Step 2: 실패하는지 본다**

Run: `npx vitest run test/scorePopupTone.test.ts`
Expected: FAIL — `Failed to resolve import "../game/src/ui/scorePopupTone"`

- [ ] **Step 3: 최소 구현을 쓴다**

`game/src/ui/scorePopupTone.ts`:

```ts
export type PopupTone = 'normal' | 'head' | 'combo';

interface ToneInput {
  hits: { part: string }[];
  penetrationCount: number;
}

// 순서가 game.js의 효과음 분기와 같아야 한다. 관통이 헤드샷을 이긴다 —
// 통로를 무너뜨려 둘을 죽이면 소리가 sfx.combo()로 나므로 화면도 관통으로
// 보여야 한다. 뒤집으면 소리와 그림이 어긋난다.
export function scorePopupTone(outcome: ToneInput): PopupTone {
  if (outcome.penetrationCount > 1) return 'combo';
  // 효과음도 hits[0]만 본다. 같은 규칙을 쓴다.
  if (outcome.hits[0]?.part === 'head') return 'head';
  return 'normal';
}
```

- [ ] **Step 4: 통과하는지 본다**

Run: `npx vitest run test/scorePopupTone.test.ts`
Expected: PASS — 6개

- [ ] **Step 5: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS **225개** (219 + 6)
Run: `npm run build` → 성공

- [ ] **Step 6: 커밋하고 푸시한다**

```bash
git add game/src/ui/scorePopupTone.ts test/scorePopupTone.test.ts
git commit -m "feat: decide which tone a score popup should use" -m "The values were already in hand -- game.js reads the penetration count and the hit part two lines above the popup call, to pick a sound effect. This pins the ordering that the sounds already use: a penetrating headshot is a combo, not a headshot, because that is what the player hears."
git push
```

---

### Task 2: 브래킷과 라운드 숫자

**Files:**
- Modify: `game/src/ui/theme.css` (추가만)
- Modify: `game/src/ui/hud.ts:7-24`

**Interfaces:**
- Consumes: 없음
- Produces: Task 3이 쓰는 CSS 클래스 —
  - `.k-bracket` — 내용물 좌우에 `[` `]` 를 그린다. 어느 요소에나 붙일 수 있다

**핵심 주의 — CSS 순서가 의미를 갖는다.** `.k-bracket` 은 의사 요소를 놓을 자리를 만들려고 `position: relative` 를 건다. Task 3의 `.k-score-popup` 은 `position: absolute` 가 필요하다. 특이성이 같으므로 **파일에서 나중에 오는 쪽이 이긴다.** `.k-bracket` 을 반드시 `.k-score-popup` **앞에** 둔다. 절대 위치도 의사 요소의 기준이 되므로 브래킷은 그대로 그려진다.

- [ ] **Step 1: theme.css 에 브래킷을 넣는다**

`.k-round` 규칙 **바로 뒤**(현재 237행 근처)에 넣는다. 이 자리가 나중에 올 `.k-score-popup` 보다 앞이다.

```css
/* 라운드 숫자와 헤드샷 점수 팝업이 같이 쓴다. 의사 요소 둘로 [ 와 ] 를 그린다 —
   세 변만 그리고 안쪽 변을 지우는 방식이라 요소를 안 늘린다.

   치수가 em인 이유: 44px 라운드 숫자와 26px 팝업이 같은 클래스를 쓴다. px로 박으면
   둘 중 하나에서 브래킷 비율이 어긋난다. 테두리 두께만 2px 고정인데, 선은 굵기로
   읽혀야 해서 작은 쪽에서 얇아지면 흐려 보인다.

   position: relative 는 의사 요소의 기준을 만든다. 이 규칙보다 뒤에 오는 규칙이
   position 을 덮어써도(팝업은 absolute 다) 기준은 여전히 생기므로 문제없다. */
.k-bracket {
  position: relative;
  display: inline-block;
  padding: 0 0.32em;
}
.k-bracket::before,
.k-bracket::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.2em;
  border: 2px solid var(--k-face);
}
.k-bracket::before {
  left: 0;
  border-right: none;
}
.k-bracket::after {
  right: 0;
  border-left: none;
}
```

- [ ] **Step 2: theme.css 의 라운드 라벨에 막대를 붙인다**

기존 `.k-round-label` 규칙(현재 217-226행)을 **통째로** 아래로 바꾼다. `text-align: center` 는 flex가 대신하므로 지운다. 나머지 값은 그대로다.

```css
/* 라운드 표시. 프레임 없이 3D 장면 위에 바로 놓이므로 외곽선 그림자로 띄운다.
   양옆 막대는 라벨을 계기 눈금처럼 보이게 한다. flex라 글자 폭이 바뀌어도
   막대가 따라 움직인다. */
.k-round-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-family: var(--k-font);
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 2px;
  color: var(--k-grey);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.85);
  margin-bottom: 2px;
}
.k-round-label::before,
.k-round-label::after {
  content: '';
  width: 14px;
  height: 2px;
  background: var(--k-shadow);
}
```

- [ ] **Step 3: hud.ts 가 브래킷을 쓰게 한다**

`game/src/ui/hud.ts` 에서 두 곳을 고친다.

첫째, 컨테이너에 `text-align: center` 를 더한다 (7-12행). `.k-bracket` 이 `display: inline-block` 이라 폭이 내용에 맞게 줄어든다 — 가운데로 밀어 줄 부모가 필요하다.

```ts
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 21; text-align: center;
  `;
  container.appendChild(el);
```

둘째, 숫자에 `k-bracket` 을 더한다 (21-24행).

```ts
  const roundValue = document.createElement('div');
  roundValue.className = 'k-num k-round k-bracket';
  roundValue.textContent = INITIAL_ROUND;
  el.appendChild(roundValue);
```

- [ ] **Step 4: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS 225개
Run: `npm run build` → 성공

CSS만 바뀌었으므로 테스트 개수는 안 는다. 늘거나 줄면 뭔가 잘못된 것이다.

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add game/src/ui/theme.css game/src/ui/hud.ts
git commit -m "feat: frame the round counter in brackets" -m "The play screen carried one bare number with nothing around it. The brackets and the rules beside the label give it the instrument look without touching the palette, so the play screen and the menus stay one visual language.

The bracket is its own class because the headshot popup wants the same shape. Its dimensions are in em so both sizes get the same proportions from one rule."
git push
```

---

### Task 3: 점수 팝업 세 종류

**Files:**
- Modify: `game/src/ui/theme.css` (추가만 — **`.k-bracket` 규칙보다 뒤에**)
- Modify: `game/src/ui/hud.ts:56-72`
- Modify: `game/src/gameplay/game.js` (import 한 줄, 호출 한 줄)

**Interfaces:**
- Consumes:
  - Task 1의 `scorePopupTone(outcome): PopupTone` 과 `PopupTone` 타입
  - Task 2의 `.k-bracket` 클래스
- Produces: 없음

`hud.ts` 의 `showScorePopup` 이 네 번째 인자를 받는다. **기본값을 `'normal'` 로 둬서 호출부를 안 고쳐도 지금 동작이 유지되게 한다.**

```ts
function showScorePopup(
  text: string,
  clientX: number,
  clientY: number,
  tone: PopupTone = 'normal'
): void;
```

- [ ] **Step 1: theme.css 에 팝업 클래스를 넣는다**

파일 **맨 끝**에 붙인다. `.k-bracket` 보다 뒤여야 `position: absolute` 가 이긴다.

```css
/* 사격 점수 팝업. 지금까지 hud.ts의 인라인 cssText에 있던 것을 옮겼다 —
   세 종류로 갈라지면서 인라인 문자열로는 관리가 안 된다.
   left/top 만 hud.ts가 인라인으로 넣는다. 맞은 자리가 매번 다르다.

   이 규칙은 반드시 .k-bracket 뒤에 있어야 한다. 헤드샷 팝업이 두 클래스를 같이
   달고, 특이성이 같아서 나중에 오는 position 이 이긴다. 여기가 absolute 다. */
.k-score-popup {
  position: absolute;
  transform: translate(-50%, -50%);
  color: var(--k-face);
  font-family: var(--k-font-num);
  font-weight: bold;
  font-size: 24px;
  pointer-events: none;
  text-shadow: 0 2px 0 var(--k-deep), 0 1px 4px rgba(0, 0, 0, 0.8);
  transition: transform 0.6s ease-out, opacity 0.6s ease-out;
  z-index: 15;
}

/* 떠오르며 사라진다. 이 클래스는 requestAnimationFrame 뒤에 붙여야 한다 —
   처음부터 붙어 있으면 시작 상태가 없어서 transition 이 안 걸린다. */
.k-score-popup--rise {
  transform: translate(-50%, -120%);
  opacity: 0;
}

.k-score-popup--head {
  color: var(--k-hi);
  font-size: 26px;
}

/* 관통은 숫자 아래 눈금 줄로 표시한다. 브래킷은 헤드샷이 쓰고 있어서, 같은
   장식을 두 뜻으로 쓰면 무엇을 맞혔는지 구분이 안 된다. */
.k-score-popup--combo {
  color: var(--k-hi);
  font-size: 28px;
  border-bottom: 2px solid var(--k-face);
  padding-bottom: 2px;
}
```

- [ ] **Step 2: hud.ts 의 showScorePopup 을 다시 쓴다**

`game/src/ui/hud.ts` 맨 위 import에 톤 타입을 더한다.

**`TOKENS` import 줄을 지우고 톤 타입 import로 바꾼다.** 확인해 뒀다 — `hud.ts` 에서 `TOKENS` 를 쓰는 곳은 `showScorePopup` 의 `color` 와 `text-shadow` 두 자리뿐이고, 그 둘이 이번에 CSS로 옮겨간다. `noUnusedLocals` 가 켜져 있어서 남겨두면 `npm run typecheck` 가 `'TOKENS' is declared but its value is never read` 로 깨진다.

바꾸기 전 (1행):

```ts
import { TOKENS } from './kit';
```

바꾼 뒤:

```ts
import type { PopupTone } from './scorePopupTone';
```

색이 어긋나지 않는지 확인해 뒀다: `TOKENS.face` 는 `#ffcc00` 으로 `var(--k-face)` 와 같고, `TOKENS.deep` 은 `#b48000` 으로 `var(--k-deep)` 과 같다.

기존 `showScorePopup` (56-72행)을 **통째로** 아래로 바꾼다.

```ts
  // 톤별로 더 붙는 클래스. 헤드샷은 브래킷을 두르고 관통은 아래 눈금 줄을 쓴다 —
  // 같은 장식을 두 뜻으로 쓰지 않는다.
  const TONE_CLASS: Record<PopupTone, string> = {
    normal: '',
    head: 'k-score-popup--head k-bracket',
    combo: 'k-score-popup--combo',
  };

  function showScorePopup(text: string, clientX: number, clientY: number, tone: PopupTone = 'normal') {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.className = `k-score-popup ${TONE_CLASS[tone]}`.trim();
    // 맞은 자리는 매번 다르므로 위치만 인라인이다. 나머지 모양은 전부 CSS다.
    popup.style.left = `${clientX}px`;
    popup.style.top = `${clientY}px`;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.classList.add('k-score-popup--rise');
    });
    setTimeout(() => popup.remove(), 650);
  }
```

- [ ] **Step 3: game.js 가 톤을 넘기게 한다**

import 목록에 더한다. `hud` import 옆(현재 25행 근처)이 자연스럽다.

```js
import { scorePopupTone } from '../ui/scorePopupTone';
```

호출부(현재 465-468행)를 바꾼다.

```js
    if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y, scorePopupTone(effectiveOutcome));
    }
```

`effectiveOutcome` 은 `{ hits, penetrationCount, isMiss, ... }` 를 갖고 있다. 톤 함수가 필요한 두 필드가 그대로 있으므로 새로 만들 것이 없다.

- [ ] **Step 4: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음. **`TOKENS` 를 안 지웠으면 여기서 `'TOKENS' is declared but its value is never read` 가 난다**
Run: `npm test` → PASS 225개
Run: `npm run build` → 성공

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add game/src/ui/theme.css game/src/ui/hud.ts game/src/gameplay/game.js
git commit -m "feat: tell headshots and combos apart in the score popup" -m "The sounds already distinguished all three -- combo, headshot and plain hit -- and the screen showed the same yellow number for every one of them. Now it follows.

The popup's styling moves out of an inline cssText string into classes, because three variants of a hand-built style string is where that approach stops paying."
git push
```

---

### Task 4: 조준선 외곽선과 눈금

**Files:**
- Modify: `game/src/ui/scopeOverlay.ts`
- Test: `test/scopeOverlay.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces: `export function bazookaReticleHtml(radiusPx: number): string` — 테스트가 쓴다

**절대 바꾸면 안 되는 것.** `bazookaReticleHtml` 안의 `arm` · `tickLength` · `tickOffset` · `outer` · `inner` 계산식. 이 수치들이 바주카 판정 사각형의 경계를 그린다. Step 1의 테스트가 이걸 못 박는다.

**모듈 최상단에서 DOM을 만지지 말 것.** 이 파일은 지금 최상단에 상수만 두고 `document` 는 `createScopeOverlay` 안에서만 쓴다. 테스트가 이 모듈을 node 환경에서 import하므로 그 성질이 유지돼야 한다.

- [ ] **Step 1: 치수를 못 박는 테스트를 쓴다**

`test/scopeOverlay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bazookaReticleHtml } from '../game/src/ui/scopeOverlay';

// 바주카 조준선의 네 모서리 브래킷은 장식이 아니라 판정 사각형의 경계다.
// 여기 수치가 바뀌면 플레이어가 보는 상자와 실제로 죽는 범위가 어긋난다.
describe('bazookaReticleHtml', () => {
  it('keeps each corner arm at 0.42 of the blast radius', () => {
    expect(bazookaReticleHtml(100)).toContain('width:42px');
  });

  it('keeps the core centred on the radius, so the box stays 2r across', () => {
    expect(bazookaReticleHtml(100)).toContain('left:84px');
  });
});
```

`left:84px` 는 `r - outer` 다 — `100 - 100 * 0.16`. 중심이 반경 자리에 있다는 뜻이고, 상자가 `2r` 라는 것과 같은 말이다.

- [ ] **Step 2: 실패하는지 본다**

Run: `npx vitest run test/scopeOverlay.test.ts`
Expected: FAIL — `bazookaReticleHtml` 이 export되지 않아 import가 안 된다

- [ ] **Step 3: 함수를 export한다**

`game/src/ui/scopeOverlay.ts` 의 `function bazookaReticleHtml(radiusPx: number) {` 을 아래로 바꾼다.

```ts
export function bazookaReticleHtml(radiusPx: number) {
```

- [ ] **Step 4: 통과하는지 본다**

Run: `npx vitest run test/scopeOverlay.test.ts`
Expected: PASS — 2개

- [ ] **Step 5: 외곽선 상수와 눈금 상수를 넣는다**

`BRACKET_THICKNESS = 4;` 줄(현재 51행) 바로 뒤에 넣는다.

```ts
// 십자 팔의 길이. 상자 가장자리에서 안쪽으로 이만큼 온다. 중앙까지는 50%이므로
// 팔 끝과 조준점 사이에 12%가 남는다 — 조준점을 안 가리는 이유다.
const ARM_LENGTH = '38%';
const TICK_LENGTH = 10;
const TICK_THICKNESS = 2;

// 밝은 하늘 위에서 흰 조준선(basic)이 사라진다. box-shadow 는 레이아웃을 안 바꾸므로
// 조준선 치수가 그대로다 — 판정에 쓰이는 크기를 건드리면 안 된다.
const RETICLE_OUTLINE = '0 0 0 1px rgba(0, 0, 0, 0.55)';
```

- [ ] **Step 6: crosshairHtml 을 다시 쓴다**

기존 `crosshairHtml` (현재 60-68행)을 **통째로** 아래로 바꾼다. 팔 넷의 위치와 길이는 그대로고, 안쪽 끝 눈금 넷과 외곽선이 더해진다.

```ts
function crosshairHtml(style: ReticleStyle) {
  const bar = `position:absolute; background:${style.crosshairColor}; box-shadow:${RETICLE_OUTLINE};`;
  const t = TICK_THICKNESS;
  const half = TICK_LENGTH / 2;
  // 눈금은 팔의 안쪽 끝에 붙는다. 바깥쪽 끝은 70vmin 상자의 가장자리라 화면 구석이고
  // 거기 달면 안 보인다. 안쪽에 달면 조준점을 네 개의 T자가 감싸는 거리계가 된다.
  return `
    <div style="${bar} top:0; left:calc(50% - 1px); width:2px; height:${ARM_LENGTH};"></div>
    <div style="${bar} bottom:0; left:calc(50% - 1px); width:2px; height:${ARM_LENGTH};"></div>
    <div style="${bar} left:0; top:calc(50% - 1px); height:2px; width:${ARM_LENGTH};"></div>
    <div style="${bar} right:0; top:calc(50% - 1px); height:2px; width:${ARM_LENGTH};"></div>
    <div style="${bar} top:calc(${ARM_LENGTH} - ${t}px); left:calc(50% - ${half}px); width:${TICK_LENGTH}px; height:${t}px;"></div>
    <div style="${bar} bottom:calc(${ARM_LENGTH} - ${t}px); left:calc(50% - ${half}px); width:${TICK_LENGTH}px; height:${t}px;"></div>
    <div style="${bar} left:calc(${ARM_LENGTH} - ${t}px); top:calc(50% - ${half}px); height:${TICK_LENGTH}px; width:${t}px;"></div>
    <div style="${bar} right:calc(${ARM_LENGTH} - ${t}px); top:calc(50% - ${half}px); height:${TICK_LENGTH}px; width:${t}px;"></div>
    <div style="position:absolute; top:50%; left:50%; box-shadow:${RETICLE_OUTLINE}; ${centerShapeStyle(style)}"></div>
  `;
}
```

- [ ] **Step 7: 바주카 조준선에도 외곽선을 넣는다**

`bazookaReticleHtml` 안의 `bar` 상수 한 줄만 고친다. **다른 줄은 건드리지 말 것.**

바꾸기 전:

```ts
  const bar = `position:absolute; background:${BAZOOKA_COLOR};`;
```

바꾼 뒤:

```ts
  const bar = `position:absolute; background:${BAZOOKA_COLOR}; box-shadow:${RETICLE_OUTLINE};`;
```

같은 함수의 `core` 안 두 `div` 에도 붙인다.

```ts
  const core = `
    <div style="position:absolute; left:${r - outer}px; top:${r - outer}px; width:${outer * 2}px; height:${outer * 2}px; border-radius:50%; background:${BAZOOKA_COLOR}; box-shadow:${RETICLE_OUTLINE};"></div>
    <div style="position:absolute; left:${r - inner}px; top:${r - inner}px; width:${inner * 2}px; height:${inner * 2}px; border-radius:50%; background:${BAZOOKA_CORE_COLOR};"></div>
  `;
```

안쪽 점에는 외곽선을 안 넣는다. 바깥 점 안에 있어서 이미 대비가 있다.

- [ ] **Step 8: 셋 다 통과하는지 본다**

Run: `npm run typecheck` → 오류 없음
Run: `npm test` → PASS **227개** (225 + 2)
Run: `npm run build` → 성공

Step 1의 두 테스트가 계속 통과하는지가 핵심이다. 깨지면 판정 치수를 건드린 것이다.

- [ ] **Step 9: 커밋하고 푸시한다**

```bash
git add game/src/ui/scopeOverlay.ts test/scopeOverlay.test.ts
git commit -m "feat: outline the reticle and tick its inner arms" -m "The white crosshair disappeared against a bright sky. A box-shadow outline fixes that without touching layout, which matters because the bazooka reticle's brackets are the boundary of its blast box, not decoration.

The ticks sit at the inner end of each arm. The outer ends are at the rim of a 70vmin box -- a tick there is off in the corner of the screen where nobody is looking.

The bazooka geometry now has a test. It had none, and it is the one part of this file where a changed number is a gameplay change."
git push
```

---

### Task 5: 사용자 육안 확인 요청

**Files:** 없음

- [ ] **Step 1: 개발 서버가 도는지 본다**

이미 떠 있으면 다시 띄우지 말 것. 이 PC에서는 `http://127.0.0.1:5174/` 다. **브라우저를 직접 열지 말 것.**

- [ ] **Step 2: 사용자에게 확인을 요청한다**

**CSS는 자동 검증이 안 된다. 육안 확인이 유일한 증거다.** 아래를 물어본다.

1. 라운드 숫자 좌우 브래킷이 숫자에 너무 붙거나 너무 벌어지지 않았나 (`.k-bracket` 의 `padding: 0 0.32em`, `width: 0.2em`)
2. 라벨 `라운드` 양옆 막대 길이가 맞나 (`.k-round-label::before/after` 의 `width: 14px`)
3. 3자리 라운드(`localStorage.setItem('shootshoot.progress','100')` 로 확인)에서 브래킷이 숫자를 따라 벌어지나
4. 헤드샷과 관통 팝업이 보통 팝업과 구분되나. 크기 차이(24/26/28px)가 너무 작지 않나
5. 관통 팝업 아래 눈금 줄이 숫자에 너무 붙지 않았나 (`padding-bottom: 2px`)
6. 조준선이 밝은 하늘 위에서 안 사라지나. 무기 다섯 개(기본·돌격·저격·레이건·바주카) 전부
7. 십자 팔 안쪽 끝 눈금이 조준점을 가리지 않나 (`TICK_LENGTH = 10`)
8. **바주카 조준 상자 크기가 예전과 같아 보이나.** 테스트가 수치를 지키지만 눈으로도 확인받는다

- [ ] **Step 3: 문제가 있으면 고친다**

거의 전부 상수 한 줄이다. 위 목록의 괄호 안에 어느 값인지 적어 뒀다.

---

## 이 계획이 손대지 않는 것

- 게임 규칙·수치·난이도 일체
- 조준선 치수, 특히 바주카 판정 사각형
- P 힌트 (`.k-hint-key`, `.k-hint-text`), 튜토리얼 문구 (`.k-tutorial`)
- 메뉴·상점·설정·라운드 선택 패널
- 점수·연속타·남은 원숭이·장전 상태를 화면에 새로 띄우는 것
- `game.js` 를 `.ts` 로 옮기는 것 — TypeScript 전환 Task 5가 나중에 한다
