# Kenney UI 리스킨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `game/src/ui/`의 8개 모듈을 Kenney UI 팩 Yellow 스프라이트로 전면 교체하고, 인라인 `cssText`를 공유 `theme.css` + `kit.js` 구조로 바꾼다.

**Architecture:** 정적 CSS(`theme.css`)가 토큰·컴포넌트 클래스·눌림 상태를 갖고, 얇은 `kit.js`가 그 클래스를 붙인 엘리먼트를 만든다. 8개 모듈은 `kit.js`만 부르고 `cssText`를 쓰지 않는다. `vitest`가 `environment: 'node'`라 DOM이 없으므로 순수 함수만 테스트한다.

**Tech Stack:** Vite 5, vitest 1.6, three.js 0.166, 바닐라 DOM (프레임워크 없음), CSS `border-image` 9-slice.

## Global Constraints

- 작업 브랜치는 `master` 직접 커밋. worktree 사용 금지.
- 기존 114개 테스트는 전부 통과 상태를 유지한다. 실행: `npm test`
- `game/src/gameplay/game.js`는 **수정하지 않는다.** 8개 UI 모듈의 export 이름, 팩토리
  시그니처, 반환 객체의 메서드 이름·인자 순서를 전부 그대로 유지한다. game.js가 부르는
  것: `hud.render({score,streak,round})`, `hud.showScorePopup(text, x, y)`,
  `screens.showMenu(state, handlers)`, `screens.showGameOver({score,highScore,isNewHighScore}, onReturnToMenu)`,
  `screens.showLoading(text)`, `screens.hide()`, `shopPanel.show(state, handlers)`,
  `shopPanel.hide()`, `settingsPanel.show(sensitivity, onChange, onClose)`,
  `settingsPanel.hide()`, `adRewardPanel.show(onClose, onWatchAd)`, `adRewardPanel.hide()`,
  `offlineRewardPopup.show(goldAmount, onClaim)`, `stageBanner.show(stageNumber)`,
  `scopeOverlay.show(weaponId, blastRadiusPx)`, `scopeOverlay.hide()`.
- `menuHandlers` 키 이름 고정: `onStart`, `onSettings`, `onShop`, `onAdReward`,
  `onLevelUpDamage`, `onWatchAdDamage`, `onLevelUpOffline`, `onWatchAdOffline`,
  `onWatchAdBazooka`. `shopHandlers` 키: `onBuy`, `onEquip`, `onClose`.
- 색은 실측값만 쓴다: `#ffcc00` `#ffea9c` `#dea312` `#b48000` `#dadce7` `#989aaf`
  `#ffffff` `#1a1a2e` `#4a4a5e` `#e4503a`.
- 9-slice를 쓰는 요소에서 `border-radius`와 `background`(색)를 제거한다. 남기면
  스프라이트 뒤로 색이 비친다.
- 한글은 시스템 폰트, 숫자/영문만 Kenney. 폰트 스택은 항상
  `'Kenney Future', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif` 형태로 쓴다.

## 스펙에서 바뀐 점 (구현 중 확정)

1. **round/square 버튼은 9-slice를 쓰지 않는다.** `button_round_*`는 원형이라 9-slice가
   깨진다. 아이콘 버튼은 크기가 고정이므로 `background-size: 100% 100%`로 충분하다.
   9-slice가 실제로 필요한 건 폭이 가변인 `.k-panel` / `.k-btn` / `.k-badge` 셋뿐이다.
2. **`sliceCss()` 순수 함수를 만들지 않는다.** `theme.css`가 정적이라 런타임에서 부를
   일이 없다. 만들면 죽은 코드가 된다. 테스트 대상 순수 함수는 `iconUrl`, `TOKENS`,
   `weaponButtonState` 셋.
3. **골드 아이콘은 `🪙` 이모지를 유지한다.** `kenney_game-icons` 105종에 코인/골드
   아이콘이 없다. `star`는 상점 데미지 핍에 이미 쓰므로 골드에 겹쳐 쓰면 헷갈린다.
4. **슬라이더 트랙은 가로만 슬라이스한다.** `slide_horizontal_color`가 96x16인데 트랙
   본체는 y=4..12뿐이라, 상하 슬라이스를 넣으면 가운데가 사라진다. `0 4 fill stretch` +
   `border-width: 0 4px` + `height: 16px`.

## 파일 구조

**새로 만들 파일**

| 파일 | 책임 |
|---|---|
| `game/src/ui/theme.css` | `@font-face`, CSS 변수 토큰, 컴포넌트 클래스, 눌림 상태 |
| `game/src/ui/kit.js` | 엘리먼트 팩토리 + 순수 함수 `iconUrl` / `TOKENS` |
| `game/src/ui/weaponButtonState.js` | 상점 버튼 상태 판정 (순수) |
| `test/uiKit.test.js` | `iconUrl`, `TOKENS` 테스트 |
| `test/weaponButtonState.test.js` | 4가지 분기 테스트 |

**수정할 파일**

`game/src/main.js`(css import 1줄 추가), `game/src/ui/` 8개 모듈 전부, `.gitignore`

**건드리지 않는 파일**

`game/src/gameplay/game.js`, `game/src/config.js`, 기존 테스트 15개.

## 에셋 인벤토리

Task 1에서 복사할 파일 목록이다. 원본 경로는 전부
`game/public/kenney_ui-pack/PNG/` 아래.

**스프라이트 -> `game/public/ui/`**

| 원본 | 사본 | 크기 | 용도 |
|---|---|---|---|
| `Yellow/Default/button_rectangle_border.png` | `ui/panel.png` | 192x64 | `.k-panel` |
| `Yellow/Default/button_rectangle_depth_flat.png` | `ui/btn.png` | 192x64 | `.k-btn` |
| `Yellow/Default/button_rectangle_flat.png` | `ui/btn-down.png` | 192x64 | `.k-btn:active` |
| `Grey/Default/button_rectangle_depth_flat.png` | `ui/btn-ghost.png` | 192x64 | `.k-btn--ghost` |
| `Grey/Default/button_rectangle_flat.png` | `ui/btn-ghost-down.png` | 192x64 | ghost active / `--off` |
| `Yellow/Default/button_square_depth_flat.png` | `ui/sq.png` | 64x64 | `.k-icon-btn` |
| `Yellow/Default/button_square_flat.png` | `ui/sq-down.png` | 64x64 | `.k-icon-btn:active` |
| `Yellow/Default/button_round_depth_flat.png` | `ui/round.png` | 64x64 | 상점 화살표 |
| `Yellow/Default/button_round_flat.png` | `ui/round-down.png` | 64x64 | 화살표 active |
| `Extra/Default/input_rectangle.png` | `ui/badge.png` | 192x64 | `.k-badge` |
| `Extra/Default/divider.png` | `ui/divider.png` | 64x4 | `.k-divider` |
| `Yellow/Default/star.png` | `ui/star.png` | 64x60 | 데미지 핍 채움 |
| `Yellow/Default/star_outline.png` | `ui/star-empty.png` | 64x60 | 데미지 핍 빈칸 |
| `Yellow/Default/arrow_basic_w.png` | `ui/arrow-w.png` | 32x32 | 상점 이전 |
| `Yellow/Default/arrow_basic_e.png` | `ui/arrow-e.png` | 32x32 | 상점 다음 |
| `Yellow/Default/slide_horizontal_color.png` | `ui/slider-track.png` | 96x16 | 설정 슬라이더 |
| `Yellow/Default/slide_hangle.png` | `ui/slider-thumb.png` | 24x32 | 설정 슬라이더 |

**아이콘 -> `game/public/icons/{white,black}/`**

`kenney_game-icons/PNG/{White,Black}/2x/` 에서 6종을 각 톤별로: `cart.png`,
`gear.png`, `video.png`, `locked.png`, `cross.png`, `trophy.png` (총 12개)

**폰트 -> `game/public/fonts/`**

| 원본 | 사본 |
|---|---|
| `kenney_ui-pack/Font/Kenney Future.ttf` | `fonts/KenneyFuture.ttf` |
| `kenney_ui-pack/Font/Kenney Future Narrow.ttf` | `fonts/KenneyFutureNarrow.ttf` |

파일명에서 공백을 없앤다. CSS `url()`에서 공백 이스케이프가 필요 없어진다.

---

### Task 1: 에셋 벤더링과 gitignore

원본 팩 두 개가 10.6MB로 `game/public/` 전체의 88%다. Vite는 `public/`을 통째로
`dist`에 복사한다. 실제 쓰는 31개 파일만 복사해 커밋하고 원본 팩은 무시한다.

**Files:**
- Create: `game/public/ui/` (스프라이트 17개)
- Create: `game/public/icons/white/`, `game/public/icons/black/` (각 6개)
- Create: `game/public/fonts/` (ttf 2개)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 없음
- Produces: `/ui/*.png`, `/icons/{white,black}/*.png`, `/fonts/KenneyFuture*.ttf`
  경로. Task 2 이후 전부가 이 경로에 의존한다.

- [ ] **Step 1: 스프라이트 17개 복사**

```bash
cd game/public
mkdir -p ui
P=kenney_ui-pack/PNG
cp "$P/Yellow/Default/button_rectangle_border.png"      ui/panel.png
cp "$P/Yellow/Default/button_rectangle_depth_flat.png"  ui/btn.png
cp "$P/Yellow/Default/button_rectangle_flat.png"        ui/btn-down.png
cp "$P/Grey/Default/button_rectangle_depth_flat.png"    ui/btn-ghost.png
cp "$P/Grey/Default/button_rectangle_flat.png"          ui/btn-ghost-down.png
cp "$P/Yellow/Default/button_square_depth_flat.png"     ui/sq.png
cp "$P/Yellow/Default/button_square_flat.png"           ui/sq-down.png
cp "$P/Yellow/Default/button_round_depth_flat.png"      ui/round.png
cp "$P/Yellow/Default/button_round_flat.png"            ui/round-down.png
cp "$P/Extra/Default/input_rectangle.png"               ui/badge.png
cp "$P/Extra/Default/divider.png"                       ui/divider.png
cp "$P/Yellow/Default/star.png"                         ui/star.png
cp "$P/Yellow/Default/star_outline.png"                 ui/star-empty.png
cp "$P/Yellow/Default/arrow_basic_w.png"                ui/arrow-w.png
cp "$P/Yellow/Default/arrow_basic_e.png"                ui/arrow-e.png
cp "$P/Yellow/Default/slide_horizontal_color.png"       ui/slider-track.png
cp "$P/Yellow/Default/slide_hangle.png"                 ui/slider-thumb.png
```

- [ ] **Step 2: 아이콘 12개 복사**

기존 `game/public/icons/{cart,gear,video}.png`는 **아직 지우지 않는다.** 현재
`screens.js`가 쓰고 있어서 Task 5 전에 지우면 메뉴 아이콘이 깨진다.

```bash
cd game/public
mkdir -p icons/white icons/black
G=kenney_game-icons/PNG
for n in cart gear video locked cross trophy; do
  cp "$G/White/2x/$n.png" "icons/white/$n.png"
  cp "$G/Black/2x/$n.png" "icons/black/$n.png"
done
```

- [ ] **Step 3: 폰트 2개 복사**

```bash
cd game/public
mkdir -p fonts
cp "kenney_ui-pack/Font/Kenney Future.ttf"        fonts/KenneyFuture.ttf
cp "kenney_ui-pack/Font/Kenney Future Narrow.ttf" fonts/KenneyFutureNarrow.ttf
```

- [ ] **Step 4: 복사 결과 확인**

Run: `ls game/public/ui | wc -l && ls game/public/icons/white | wc -l && ls game/public/icons/black | wc -l && ls game/public/fonts | wc -l`
Expected: `17`, `6`, `6`, `2`

- [ ] **Step 5: `.gitignore`에 원본 팩 추가**

`.gitignore` 끝에 두 줄을 덧붙인다. 기존 4줄(`node_modules`, `dist`, `*.log`,
`.superpowers`)은 그대로 둔다.

```
game/public/kenney_ui-pack
game/public/kenney_game-icons
```

- [ ] **Step 6: 원본 팩이 무시되는지 확인**

Run: `git status --porcelain game/public | grep kenney`
Expected: 출력 없음 (exit 1). 원본 팩이 목록에 안 뜨면 성공.

- [ ] **Step 7: 커밋**

```bash
git add .gitignore game/public/ui game/public/icons game/public/fonts
git commit -m "chore: vendor the Kenney sprites, icons and fonts the UI actually uses

The two source packs are 10.6MB and Vite copies public/ verbatim into
dist. Copy in only the 31 files the reskin needs and ignore the packs."
```

---

### Task 2: `theme.css`와 `kit.js` 순수 함수

**Files:**
- Create: `test/uiKit.test.js`
- Create: `game/src/ui/kit.js`
- Create: `game/src/ui/theme.css`
- Modify: `game/src/main.js`

**Interfaces:**
- Consumes: Task 1의 `/ui/*.png`, `/icons/{white,black}/*.png`, `/fonts/*.ttf`
- Produces:
  - `iconUrl(name: string, tone: 'white'|'black') -> string`
  - `TOKENS: Record<string, string>` — 키:
    `face, hi, shadow, deep, grey, greyShadow, white, ink, inkSoft, danger`
  - `theme.css`의 클래스: `.k-scrim .k-panel .k-btn .k-btn--ghost .k-btn--off
    .k-icon-btn .k-icon-btn--round .k-badge .k-divider .k-num .k-title .k-slider`

`kit.js`는 **모듈 최상위에서 `document`를 만지면 안 된다.** node 환경 테스트가
import만 해도 터진다. 팩토리 함수 본문 안에서만 `document`를 쓴다.

`kit.js`는 `theme.css`를 import하지 않는다. import하면 node 테스트가 CSS를 파싱하려다
실패한다. CSS는 `main.js`가 한 번만 불러온다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/uiKit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { iconUrl, TOKENS } from '../game/src/ui/kit.js';

describe('iconUrl', () => {
  it('builds a path under the requested tone folder', () => {
    expect(iconUrl('cart', 'white')).toBe('/icons/white/cart.png');
    expect(iconUrl('gear', 'black')).toBe('/icons/black/gear.png');
  });

  it('rejects an unknown tone instead of building a 404 path', () => {
    expect(() => iconUrl('cart', 'yellow')).toThrow(/tone/);
  });

  it('rejects an empty icon name', () => {
    expect(() => iconUrl('', 'white')).toThrow(/name/);
  });
});

describe('TOKENS', () => {
  it('exposes every colour the UI needs', () => {
    expect(Object.keys(TOKENS).sort()).toEqual([
      'danger', 'deep', 'face', 'grey', 'greyShadow', 'hi', 'ink', 'inkSoft', 'shadow', 'white',
    ]);
  });

  it('holds the measured Kenney values as six-digit hex', () => {
    for (const value of Object.values(TOKENS)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(TOKENS.face).toBe('#ffcc00');
    expect(TOKENS.grey).toBe('#dadce7');
    expect(TOKENS.danger).toBe('#e4503a');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/uiKit.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/ui/kit.js"`

- [ ] **Step 3: `kit.js`의 순수 함수 구현**

Create `game/src/ui/kit.js`:

```js
// theme.css의 CSS 변수와 값이 같아야 한다. 한쪽만 바꾸면 어긋난다.
export const TOKENS = {
  face: '#ffcc00',
  hi: '#ffea9c',
  shadow: '#dea312',
  deep: '#b48000',
  grey: '#dadce7',
  greyShadow: '#989aaf',
  white: '#ffffff',
  ink: '#1a1a2e',
  inkSoft: '#4a4a5e',
  danger: '#e4503a',
};

const TONES = ['white', 'black'];

// Kenney 아이콘은 White/Black 두 벌이다. 회색 패널 위의 흰 아이콘은 안 보이므로
// 밝은 면에는 black, 어두운 스크림 위에는 white를 쓴다.
export function iconUrl(name, tone) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('iconUrl: name must be a non-empty string');
  }
  if (!TONES.includes(tone)) {
    throw new Error(`iconUrl: tone must be one of ${TONES.join(', ')}`);
  }
  return `/icons/${tone}/${name}.png`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/uiKit.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: `theme.css` 작성**

Create `game/src/ui/theme.css`:

```css
@font-face {
  font-family: 'Kenney Future';
  src: url('/fonts/KenneyFuture.ttf') format('truetype');
  font-display: swap;
}
@font-face {
  font-family: 'Kenney Future Narrow';
  src: url('/fonts/KenneyFutureNarrow.ttf') format('truetype');
  font-display: swap;
}

:root {
  --k-face: #ffcc00;
  --k-hi: #ffea9c;
  --k-shadow: #dea312;
  --k-deep: #b48000;
  --k-grey: #dadce7;
  --k-grey-shadow: #989aaf;
  --k-white: #ffffff;
  --k-ink: #1a1a2e;
  --k-ink-soft: #4a4a5e;
  --k-danger: #e4503a;
  --k-scrim: rgba(12, 12, 20, 0.62);

  /* 한글 글리프가 없는 Kenney 폰트를 앞에 두면 브라우저가 글자별로 폴백한다. */
  --k-font: 'Kenney Future', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  --k-font-num: 'Kenney Future Narrow', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
}

.k-scrim {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--k-scrim);
  color: var(--k-white);
  font-family: var(--k-font);
}

/* 폭이 가변인 세 요소만 9-slice가 필요하다. 실측 슬라이스는 8px
   (외곽 2 + 하이라이트 2 + 코너 반경 약 4). depth 스프라이트만 밑단 립 때문에 12. */
.k-panel {
  border-style: solid;
  border-width: 8px;
  border-image: url('/ui/panel.png') 8 fill stretch;
  border-radius: 0;
  background: none;
  padding: 18px 20px;
  color: var(--k-ink);
  font-family: var(--k-font);
}

.k-btn {
  border-style: solid;
  border-width: 8px 8px 12px 8px;
  border-image: url('/ui/btn.png') 8 8 12 8 fill stretch;
  border-radius: 0;
  background: none;
  padding: 8px 22px 4px;
  color: var(--k-ink);
  font-family: var(--k-font);
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
}
.k-btn:active {
  border-width: 8px;
  border-image: url('/ui/btn-down.png') 8 fill stretch;
  padding: 8px 22px;
  transform: translateY(3px);
}

.k-btn--ghost {
  border-image: url('/ui/btn-ghost.png') 8 8 12 8 fill stretch;
  color: var(--k-ink-soft);
}
.k-btn--ghost:active {
  border-image: url('/ui/btn-ghost-down.png') 8 fill stretch;
}

.k-btn--off {
  border-width: 8px;
  border-image: url('/ui/btn-ghost-down.png') 8 fill stretch;
  padding: 8px 22px;
  color: var(--k-grey-shadow);
  cursor: default;
}
.k-btn--off:active {
  border-image: url('/ui/btn-ghost-down.png') 8 fill stretch;
  transform: none;
}

.k-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-style: solid;
  border-width: 8px;
  border-image: url('/ui/badge.png') 8 fill stretch;
  border-radius: 0;
  background: none;
  padding: 2px 10px;
  color: var(--k-ink);
  font-family: var(--k-font);
  font-size: 15px;
  font-weight: bold;
}

/* 아이콘 버튼은 크기가 고정이라 9-slice가 필요 없다. 원형 스프라이트는 9-slice로
   자르면 원이 깨지므로 반드시 background-image로 그린다. */
.k-icon-btn {
  border: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  background-image: url('/ui/sq.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-color: transparent;
  display: grid;
  place-items: center;
}
.k-icon-btn:active {
  background-image: url('/ui/sq-down.png');
  transform: translateY(3px);
}
.k-icon-btn > img {
  width: 52%;
  height: 52%;
  object-fit: contain;
}

.k-icon-btn--round {
  background-image: url('/ui/round.png');
}
.k-icon-btn--round:active {
  background-image: url('/ui/round-down.png');
}

.k-icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.k-icon-btn:disabled:active {
  transform: none;
}

.k-divider {
  height: 4px;
  background-image: url('/ui/divider.png');
  background-repeat: repeat-x;
  background-size: auto 4px;
  margin: 12px 0;
}

.k-title {
  font-family: var(--k-font);
  font-size: 22px;
  font-weight: bold;
  color: var(--k-ink);
  margin: 0 0 6px;
}

.k-num {
  font-family: var(--k-font-num);
  font-weight: bold;
}

/* 트랙 본체는 96x16 중 y=4..12뿐이라 세로를 자르면 가운데가 사라진다.
   가로만 자르고 세로는 원본 높이를 유지한다. */
.k-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 240px;
  height: 32px;
  background: none;
  cursor: pointer;
}
.k-slider::-webkit-slider-runnable-track {
  height: 16px;
  border-style: solid;
  border-width: 0 4px;
  border-image: url('/ui/slider-track.png') 0 4 fill stretch;
  background: none;
}
.k-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 32px;
  margin-top: -8px;
  background-image: url('/ui/slider-thumb.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  border: none;
}
.k-slider::-moz-range-track {
  height: 16px;
  border-style: solid;
  border-width: 0 4px;
  border-image: url('/ui/slider-track.png') 0 4 fill stretch;
  background: none;
}
.k-slider::-moz-range-thumb {
  width: 24px;
  height: 32px;
  background-image: url('/ui/slider-thumb.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  border: none;
  border-radius: 0;
}
```

- [ ] **Step 6: `main.js`에서 CSS 로드**

Modify `game/src/main.js` — 첫 줄 위에 import 한 줄을 넣는다. 나머지 4줄은 그대로.

```js
import './ui/theme.css';
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();
```

- [ ] **Step 7: 전체 테스트와 빌드 확인**

Run: `npm test`
Expected: 119 tests passed (기존 114 + 신규 5)

Run: `npm run build`
Expected: 빌드 성공. `dist/`에 CSS 번들이 생기고 에러가 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add game/src/ui/theme.css game/src/ui/kit.js game/src/main.js test/uiKit.test.js
git commit -m "feat: add the Kenney theme stylesheet and UI kit tokens

theme.css carries the design tokens, the nine-slice component classes and
the pressed states that inline styles cannot express. kit.js stays free of
top-level DOM access so the pure helpers can be unit tested under node."
```

---

### Task 3: 상점 버튼 상태 추출

`shopPanel.js`의 `actionButton`에 if/else 사슬로 묻혀 있는 판정을 순수 함수로 꺼낸다.
UI 모듈에서 DOM 없이 테스트할 수 있는 유일한 로직이다.

**Files:**
- Create: `test/weaponButtonState.test.js`
- Create: `game/src/ui/weaponButtonState.js`

**Interfaces:**
- Consumes: 없음
- Produces: `weaponButtonState(weapon, gold) -> 'equipped'|'equip'|'buy'|'insufficient'`
  — Task 7의 `shopPanel.js`가 쓴다. `weapon`은 `game.js`의 `buildShopState()`가 만드는
  모양이다: `{ id, name, image, damage, price, owned, equipped }`.

우선순위가 중요하다. `equipped`인 무기는 `owned`이기도 하므로 `equipped`를 먼저 본다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/weaponButtonState.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { weaponButtonState } from '../game/src/ui/weaponButtonState.js';

function weapon(overrides) {
  return { id: 'basic', name: '기본총', image: '/images/basic.png', damage: 1, price: 100, owned: false, equipped: false, ...overrides };
}

describe('weaponButtonState', () => {
  it('reports equipped before owned, since an equipped weapon is also owned', () => {
    expect(weaponButtonState(weapon({ owned: true, equipped: true }), 99999)).toBe('equipped');
  });

  it('offers equipping for an owned weapon that is not the active one', () => {
    expect(weaponButtonState(weapon({ owned: true }), 0)).toBe('equip');
  });

  it('offers buying when the player can afford an unowned weapon', () => {
    expect(weaponButtonState(weapon({ price: 100 }), 100)).toBe('buy');
    expect(weaponButtonState(weapon({ price: 100 }), 250)).toBe('buy');
  });

  it('reports insufficient gold one coin short of the price', () => {
    expect(weaponButtonState(weapon({ price: 100 }), 99)).toBe('insufficient');
    expect(weaponButtonState(weapon({ price: 100 }), 0)).toBe('insufficient');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/weaponButtonState.test.js`
Expected: FAIL — `Failed to resolve import "../game/src/ui/weaponButtonState.js"`

- [ ] **Step 3: 구현**

Create `game/src/ui/weaponButtonState.js`:

```js
// 장착 중인 무기는 보유 중이기도 하다. 순서를 바꾸면 장착 중인 무기에
// '장착하기' 버튼이 뜬다.
export function weaponButtonState(weapon, gold) {
  if (weapon.equipped) return 'equipped';
  if (weapon.owned) return 'equip';
  if (gold >= weapon.price) return 'buy';
  return 'insufficient';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/weaponButtonState.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: 커밋**

```bash
git add game/src/ui/weaponButtonState.js test/weaponButtonState.test.js
git commit -m "refactor: extract the shop button state out of the if/else chain

It is the only shop logic that can be tested without a DOM, and the
equipped-before-owned ordering is easy to get backwards."
```

---

### Task 4: `kit.js` 엘리먼트 팩토리

DOM을 만드는 부분이라 node 환경에서 테스트할 수 없다. 검증은 빌드 성공과 Task 5 이후의
육안 확인으로 한다.

**Files:**
- Modify: `game/src/ui/kit.js`

**Interfaces:**
- Consumes: Task 2의 `TOKENS`, `iconUrl`, `theme.css` 클래스
- Produces (Task 5-9 전부가 쓴다):
  - `panel(): HTMLDivElement` — `.k-panel`
  - `button(label: string, onClick: Function, variant?: 'primary'|'ghost'|'off'): HTMLButtonElement`
    — `off`면 `disabled = true`이고 `onClick`을 붙이지 않는다
  - `iconButton(icon: string, alt: string, onClick: Function, size: number, opts?: { round?: boolean, tone?: 'white'|'black' }): HTMLButtonElement`
  - `badge(text: string, opts?: { icon?: string, tone?: 'white'|'black' }): HTMLDivElement`
  - `divider(): HTMLDivElement`
  - `title(text: string): HTMLDivElement` — `.k-title`
  - `num(text: string): HTMLSpanElement` — `.k-num`
  - `scrim(): HTMLDivElement` — `.k-scrim`, `display: none`으로 시작

`button()`이 `onClick`을 반드시 붙이는 이유: UI만 바꾸는 작업이라 기존 114개 테스트가
핸들러 배선 파손을 못 잡는다. 팩토리가 강제하는 편이 안전하다.

- [ ] **Step 1: 팩토리 추가**

`game/src/ui/kit.js`의 `iconUrl` 아래에 덧붙인다. 기존 `TOKENS`, `TONES`, `iconUrl`은
그대로 둔다.

```js
const BUTTON_VARIANT_CLASS = {
  primary: '',
  ghost: 'k-btn--ghost',
  off: 'k-btn--off',
};

export function scrim() {
  const el = document.createElement('div');
  el.className = 'k-scrim';
  el.style.display = 'none';
  return el;
}

export function panel() {
  const el = document.createElement('div');
  el.className = 'k-panel';
  return el;
}

export function title(text) {
  const el = document.createElement('div');
  el.className = 'k-title';
  el.textContent = text;
  return el;
}

export function num(text) {
  const el = document.createElement('span');
  el.className = 'k-num';
  el.textContent = text;
  return el;
}

export function divider() {
  const el = document.createElement('div');
  el.className = 'k-divider';
  return el;
}

// variant가 'off'면 클릭이 아무 일도 하지 않아야 한다. 핸들러를 붙이지 않고
// disabled까지 세워 둔다.
export function button(label, onClick, variant = 'primary') {
  const variantClass = BUTTON_VARIANT_CLASS[variant];
  if (variantClass === undefined) {
    throw new Error(`button: unknown variant ${variant}`);
  }
  const el = document.createElement('button');
  el.className = variantClass ? `k-btn ${variantClass}` : 'k-btn';
  el.textContent = label;
  if (variant === 'off') {
    el.disabled = true;
  } else {
    if (typeof onClick !== 'function') {
      throw new Error('button: onClick must be a function');
    }
    el.addEventListener('click', onClick);
  }
  return el;
}

export function iconButton(icon, alt, onClick, size, opts = {}) {
  const { round = false, tone = 'black' } = opts;
  if (typeof onClick !== 'function') {
    throw new Error('iconButton: onClick must be a function');
  }
  const el = document.createElement('button');
  el.className = round ? 'k-icon-btn k-icon-btn--round' : 'k-icon-btn';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.title = alt;
  const img = document.createElement('img');
  img.src = iconUrl(icon, tone);
  img.alt = alt;
  el.appendChild(img);
  el.addEventListener('click', onClick);
  return el;
}

export function badge(text, opts = {}) {
  const { icon, tone = 'black' } = opts;
  const el = document.createElement('div');
  el.className = 'k-badge';
  if (icon) {
    const img = document.createElement('img');
    img.src = iconUrl(icon, tone);
    img.alt = '';
    img.style.width = '16px';
    img.style.height = '16px';
    el.appendChild(img);
  }
  const span = document.createElement('span');
  span.className = 'k-num';
  span.textContent = text;
  el.appendChild(span);
  return el;
}
```

- [ ] **Step 2: 기존 테스트가 여전히 통과하는지 확인**

`kit.js`에 DOM 코드가 들어갔지만 전부 함수 본문 안이라, node에서 import만 하는
`test/uiKit.test.js`는 그대로 통과해야 한다.

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add game/src/ui/kit.js
git commit -m "feat: add the UI kit element factories

button() and iconButton() refuse a missing handler on purpose: the reskin
touches only UI, so the existing suite cannot catch a severed callback."
```

---

### Task 5: `screens.js` 재배치

가장 큰 변경이다. 흩어져 있던 요소를 상단 바 / 중앙 / 하단 독 3단으로 모은다.

**Files:**
- Modify: `game/src/ui/screens.js` (전체 교체)
- Delete: `game/public/icons/cart.png`, `game/public/icons/gear.png`, `game/public/icons/video.png`

**Interfaces:**
- Consumes: Task 4의 `scrim`, `panel`, `button`, `iconButton`, `badge`, `divider`, `title`, `num`
- Produces: `createScreens(container)` -> `{ showMenu, showGameOver, showLoading, hide, dispose }`
  — 시그니처는 Global Constraints 그대로 유지

- [ ] **Step 1: `screens.js` 전체 교체**

Replace the entire contents of `game/src/ui/screens.js`:

```js
import { scrim, panel, button, iconButton, badge, divider, title, num, iconUrl } from './kit.js';

const BAZOOKA_MAX_ROUNDS = 5;

export function createScreens(container) {
  const overlay = scrim();
  overlay.style.zIndex = '20';
  container.appendChild(overlay);

  function clear() {
    overlay.innerHTML = '';
  }

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  // 상단 바: 좌측 로고, 우측 골드 배지 + 아이콘 버튼 3개.
  function topBar(gold, handlers) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; top: 16px; left: 20px; right: 20px;
      display: flex; align-items: center; justify-content: space-between;
    `;

    const logo = document.createElement('div');
    logo.textContent = 'SHOOTSHOOT';
    logo.style.cssText = `
      font-family: 'Kenney Future', sans-serif; font-size: 22px; letter-spacing: 2px;
      color: #ffcc00; text-shadow: 0 2px 0 #b48000;
    `;
    bar.appendChild(logo);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    right.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    right.appendChild(iconButton('cart', '상점', handlers.onShop, 44));
    right.appendChild(iconButton('video', '광고 보상', handlers.onAdReward, 44));
    right.appendChild(iconButton('gear', '설정', handlers.onSettings, 44));
    bar.appendChild(right);

    return bar;
  }

  // 하단 독의 카드 한 장. 강화 카드 두 장과 바주카 카드가 같은 틀을 쓴다.
  function dockCard(headingText, subtitleNode, actionNode) {
    const card = panel();
    card.style.cssText = 'width: 220px; text-align: center;';
    card.appendChild(title(headingText));
    card.appendChild(subtitleNode);
    card.appendChild(actionNode);
    return card;
  }

  function levelLine(level) {
    const line = document.createElement('div');
    line.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
    line.appendChild(document.createTextNode('Lv.'));
    line.appendChild(num(String(level)));
    return line;
  }

  function upgradeCard(headingText, level, cost, canAfford, onUpgrade, onWatchAd) {
    const action = canAfford
      ? button(`🪙 ${cost.toLocaleString()} 강화`, onUpgrade, 'primary')
      : button('📺 무료강화', onWatchAd, 'ghost');
    action.style.width = '100%';
    return dockCard(headingText, levelLine(level), action);
  }

  function bazookaCard(rounds, onWatchAd) {
    let subtitle;
    let action;
    if (rounds > 0) {
      subtitle = document.createElement('div');
      subtitle.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
      subtitle.appendChild(num(`${rounds}/${BAZOOKA_MAX_ROUNDS}`));
      action = button('보유 중', () => {}, 'off');
    } else {
      subtitle = document.createElement('div');
      subtitle.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
      subtitle.appendChild(num(`0/${BAZOOKA_MAX_ROUNDS}`));
      action = button('📺 획득', onWatchAd, 'ghost');
    }
    action.style.width = '100%';
    return dockCard('바주카포', subtitle, action);
  }

  function showMenu(state, handlers) {
    const {
      gold, damageLevel, damageCost, canAffordDamage,
      offlineLevel, offlineCost, canAffordOffline, bazookaRounds,
    } = state;
    clear();

    overlay.appendChild(topBar(gold, handlers));

    const centre = document.createElement('div');
    centre.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 14px;';
    const startBtn = button('탭하여 시작', handlers.onStart, 'primary');
    startBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
    centre.appendChild(startBtn);
    const hint = document.createElement('div');
    hint.textContent = '클릭하여 조준, 놓아서 발사!';
    hint.style.cssText = 'color: #dadce7; font-size: 15px;';
    centre.appendChild(hint);
    overlay.appendChild(centre);

    const dock = document.createElement('div');
    dock.style.cssText = `
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: flex-end; gap: 16px;
    `;
    dock.appendChild(
      upgradeCard('공격력', damageLevel, damageCost, canAffordDamage, handlers.onLevelUpDamage, handlers.onWatchAdDamage)
    );
    dock.appendChild(bazookaCard(bazookaRounds, handlers.onWatchAdBazooka));
    dock.appendChild(
      upgradeCard('오프라인', offlineLevel, offlineCost, canAffordOffline, handlers.onLevelUpOffline, handlers.onWatchAdOffline)
    );
    overlay.appendChild(dock);

    show();
  }

  function showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu) {
    clear();

    const card = panel();
    card.style.cssText = 'width: 340px; text-align: center;';

    card.appendChild(title('게임 종료'));

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size: 46px; color: #1a1a2e; margin: 6px 0 2px;';
    scoreEl.appendChild(num(score.toLocaleString()));
    card.appendChild(scoreEl);

    card.appendChild(divider());

    const highRow = document.createElement('div');
    highRow.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; color: #4a4a5e; font-size: 16px;';
    if (isNewHighScore) {
      const trophy = document.createElement('img');
      trophy.src = iconUrl('trophy', 'black');
      trophy.alt = '';
      trophy.style.cssText = 'width: 20px; height: 20px;';
      highRow.appendChild(trophy);
    }
    highRow.appendChild(document.createTextNode(isNewHighScore ? '신기록! ' : '최고점수 '));
    highRow.appendChild(num(highScore.toLocaleString()));
    card.appendChild(highRow);

    const backBtn = button('메인 메뉴로', onReturnToMenu, 'primary');
    backBtn.style.cssText += 'width: 100%; margin-top: 16px;';
    card.appendChild(backBtn);

    overlay.appendChild(card);
    show();
  }

  function showLoading(text) {
    clear();
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'color: #dadce7; font-size: 18px;';
    overlay.appendChild(el);
    show();
  }

  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
}
```

- [ ] **Step 2: 낡은 아이콘 3개 삭제**

`screens.js`가 `/icons/cart.png` 같은 옛 경로를 더는 참조하지 않으므로 지운다.

```bash
git rm game/public/icons/cart.png game/public/icons/gear.png game/public/icons/video.png
```

- [ ] **Step 3: 옛 경로 참조가 남아 있지 않은지 확인**

Run: `grep -rn "/icons/\(cart\|gear\|video\)\.png" game/src`
Expected: 출력 없음 (exit 1)

- [ ] **Step 4: 테스트와 빌드**

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add game/src/ui/screens.js game/public/icons
git commit -m "feat: rebuild the menu and game over screens on the Kenney kit

The menu had a shop icon at mid-left, a bazooka card at mid-right, gold at
top-right and two upgrade cards in the bottom corners. Those now sit in a
top bar, a centre column and one bottom dock."
```

---

### Task 6: `hud.js`와 `stageBanner.js`

둘 다 렌더 루프 위에 뜨는 얇은 레이어다. 한 커밋으로 묶는다.

**Files:**
- Modify: `game/src/ui/hud.js` (전체 교체)
- Modify: `game/src/ui/stageBanner.js` (전체 교체)

**Interfaces:**
- Consumes: Task 4의 `badge`, Task 2의 `TOKENS`
- Produces: `createHud(container)` -> `{ render, showScorePopup, dispose }`,
  `createStageBanner(container)` -> `{ show }` — 시그니처 그대로

`hud.render`는 매 프레임 불릴 수 있다. 기존 코드처럼 `innerHTML`을 매번 새로 만들면
배지 엘리먼트가 계속 버려진다. 배지 3개를 한 번만 만들고 숫자 텍스트만 갱신한다.

- [ ] **Step 1: `hud.js` 전체 교체**

Replace the entire contents of `game/src/ui/hud.js`:

```js
import { badge, TOKENS } from './kit.js';

export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px;
    display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  // render는 매 프레임 불릴 수 있다. 배지를 한 번만 만들고 숫자만 갈아 끼운다.
  function row(labelText) {
    const wrapper = badge('0');
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'font-size: 13px; color: #4a4a5e; margin-right: 2px;';
    wrapper.insertBefore(label, wrapper.firstChild);
    el.appendChild(wrapper);
    return wrapper.querySelector('.k-num');
  }

  const scoreValue = row('점수');
  const streakValue = row('연속');
  const roundValue = row('라운드');

  function render({ score, streak, round }) {
    scoreValue.textContent = score.toLocaleString();
    streakValue.textContent = String(streak);
    roundValue.textContent = String(round);
  }

  function showScorePopup(text, clientX, clientY) {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.cssText = `
      position: absolute; left: ${clientX}px; top: ${clientY}px; transform: translate(-50%, -50%);
      color: ${TOKENS.face}; font-family: 'Kenney Future Narrow', sans-serif; font-weight: bold;
      font-size: 24px; pointer-events: none;
      text-shadow: 0 2px 0 ${TOKENS.deep}, 0 1px 4px rgba(0,0,0,0.8);
      transition: transform 0.6s ease-out, opacity 0.6s ease-out; z-index: 15;
    `;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -120%)';
      popup.style.opacity = '0';
    });
    setTimeout(() => popup.remove(), 650);
  }

  function dispose() {
    el.remove();
  }

  return { render, showScorePopup, dispose };
}
```

- [ ] **Step 2: `stageBanner.js` 전체 교체**

`STAGE 3`은 라틴 + 숫자라 Kenney Future가 그대로 적용된다. 페이드 타이밍(300ms 등장,
600ms 유지, 1000ms 제거)은 기존 값을 유지한다.

Replace the entire contents of `game/src/ui/stageBanner.js`:

```js
import { TOKENS } from './kit.js';

export function createStageBanner(container) {
  function show(stageNumber) {
    const el = document.createElement('div');
    el.textContent = `STAGE ${stageNumber}`;
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: 'Kenney Future', sans-serif; font-size: 56px; font-weight: bold;
      color: ${TOKENS.face}; letter-spacing: 4px;
      text-shadow: 0 4px 0 ${TOKENS.deep}, 0 6px 12px rgba(0,0,0,0.7);
      pointer-events: none; z-index: 16; opacity: 0; transition: opacity 0.3s ease;
    `;
    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });

    setTimeout(() => {
      el.style.opacity = '0';
    }, 600);

    setTimeout(() => {
      el.remove();
    }, 1000);
  }

  return { show };
}
```

- [ ] **Step 3: 테스트와 빌드**

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add game/src/ui/hud.js game/src/ui/stageBanner.js
git commit -m "feat: put the HUD readouts in Kenney badges and restyle the stage banner

render() runs on the frame loop, so the badges are built once and only the
numbers are swapped instead of rebuilding innerHTML every frame."
```

---

### Task 7: `shopPanel.js`

캐러셀 구조(좌우 화살표 + 도트)는 잘 동작하므로 유지하고 스킨만 바꾼다.

**Files:**
- Modify: `game/src/ui/shopPanel.js` (전체 교체)

**Interfaces:**
- Consumes: Task 3의 `weaponButtonState`, Task 4의 `scrim`, `panel`, `button`,
  `iconButton`, `badge`, `divider`, `title`
- Produces: `createShopPanel(container)` -> `{ show, hide }` — 시그니처 그대로.
  `handlers`는 `{ onBuy, onEquip, onClose }`.

- [ ] **Step 1: `shopPanel.js` 전체 교체**

Replace the entire contents of `game/src/ui/shopPanel.js`:

```js
import { scrim, panel, button, iconButton, badge, divider, title } from './kit.js';
import { weaponButtonState } from './weaponButtonState.js';

const MAX_DAMAGE_PIPS = 5;

export function createShopPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  let index = 0;
  let current = null;

  // 데미지를 별 5개로 표시한다. 채운 별과 빈 별 스프라이트가 따로 있다.
  function damagePips(damage) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: center; gap: 3px; margin-top: 6px;';
    const filled = Math.min(damage, MAX_DAMAGE_PIPS);
    for (let i = 0; i < MAX_DAMAGE_PIPS; i += 1) {
      const star = document.createElement('img');
      star.src = i < filled ? '/ui/star.png' : '/ui/star-empty.png';
      star.alt = '';
      star.style.cssText = 'width: 20px; height: 19px;';
      row.appendChild(star);
    }
    return row;
  }

  function actionButton(weapon, gold, handlers) {
    const state = weaponButtonState(weapon, gold);
    let el;
    if (state === 'equipped') {
      el = button('장착 중', () => {}, 'off');
    } else if (state === 'equip') {
      el = button('장착하기', () => handlers.onEquip(weapon.id), 'ghost');
    } else if (state === 'buy') {
      el = button(`🪙 ${weapon.price.toLocaleString()} 구매`, () => handlers.onBuy(weapon.id), 'primary');
    } else {
      el = button(`🪙 ${weapon.price.toLocaleString()} · 골드 부족`, () => {}, 'off');
    }
    el.style.cssText += 'width: 100%; margin-top: 12px;';
    return el;
  }

  function render() {
    const { gold, weapons, error } = current.state;
    const handlers = current.handlers;
    const weapon = weapons[index];
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'width: min(420px, 88%);';
    overlay.appendChild(box);

    const bar = document.createElement('div');
    bar.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    bar.appendChild(title('무기 상점'));
    bar.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    box.appendChild(bar);
    box.appendChild(divider());

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const prev = iconButton('cross', '이전', () => { index -= 1; render(); }, 44, { round: true });
    prev.querySelector('img').src = '/ui/arrow-w.png';
    prev.disabled = index === 0;
    row.appendChild(prev);

    const card = document.createElement('div');
    card.style.cssText = 'flex: 1; text-align: center;';

    const frame = document.createElement('div');
    frame.className = 'k-badge';
    frame.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      height: 120px; width: 100%; box-sizing: border-box; padding: 4px;
    `;
    const img = document.createElement('img');
    img.src = weapon.image;
    img.alt = weapon.name;
    img.style.cssText = 'max-width: 90%; max-height: 100%; object-fit: contain;';
    frame.appendChild(img);
    card.appendChild(frame);

    const name = document.createElement('div');
    name.textContent = weapon.name;
    name.style.cssText = 'font-size: 19px; font-weight: bold; color: #1a1a2e; margin-top: 10px;';
    card.appendChild(name);
    card.appendChild(damagePips(weapon.damage));
    card.appendChild(actionButton(weapon, gold, handlers));

    if (typeof error === 'string' && error.length > 0) {
      const errorText = document.createElement('div');
      errorText.style.cssText = 'color: #e4503a; font-size: 12px; margin-top: 8px;';
      errorText.textContent = error;
      card.appendChild(errorText);
    }

    row.appendChild(card);

    const next = iconButton('cross', '다음', () => { index += 1; render(); }, 44, { round: true });
    next.querySelector('img').src = '/ui/arrow-e.png';
    next.disabled = index === weapons.length - 1;
    row.appendChild(next);

    box.appendChild(row);

    const dots = document.createElement('div');
    dots.style.cssText = 'display: flex; justify-content: center; gap: 6px; margin-top: 14px;';
    weapons.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.style.cssText = `
        display: inline-block; height: 8px; border-radius: 4px;
        width: ${i === index ? '20px' : '8px'};
        background: ${i === index ? '#ffcc00' : '#989aaf'};
      `;
      dots.appendChild(dot);
    });
    box.appendChild(dots);

    const closeBtn = button('닫기', handlers.onClose, 'ghost');
    closeBtn.style.cssText += 'display: block; margin: 14px auto 0;';
    box.appendChild(closeBtn);
  }

  function show(state, handlers) {
    current = { state, handlers };
    if (index >= state.weapons.length) index = 0;
    render();
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

`iconButton`에 `'cross'`를 넘긴 뒤 곧바로 `img.src`를 화살표 스프라이트로 덮어쓰는 게
어색해 보이지만 의도한 것이다. 화살표는 `kenney_game-icons`가 아니라 `kenney_ui-pack`
쪽에 있어서 `iconUrl`의 `/icons/{tone}/` 규칙에 맞지 않는다. `iconUrl`을 두 팩 모두
다루도록 넓히는 건 이 한 곳을 위해 과하다.

- [ ] **Step 2: 테스트와 빌드**

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add game/src/ui/shopPanel.js
git commit -m "feat: reskin the weapon shop on the Kenney kit

The carousel works, so only the surface changes: nine-slice panel, round
arrow buttons, an inset frame for the weapon art and star pips for damage."
```

---

### Task 8: 모달 3개 (`adRewardPanel`, `settingsPanel`, `offlineRewardPopup`)

셋 다 작고 구조가 같다. 한 커밋으로 묶는다.

**Files:**
- Modify: `game/src/ui/adRewardPanel.js` (전체 교체)
- Modify: `game/src/ui/settingsPanel.js` (전체 교체)
- Modify: `game/src/ui/offlineRewardPopup.js` (전체 교체)

**Interfaces:**
- Consumes: Task 4의 `scrim`, `panel`, `button`, `iconButton`, `divider`, `title`, `num`
- Produces: `createAdRewardPanel(container)` -> `{ show, hide }`,
  `createSettingsPanel(container)` -> `{ show, hide }`,
  `createOfflineRewardPopup(container)` -> `{ show }` — 시그니처 그대로

- [ ] **Step 1: `adRewardPanel.js` 전체 교체**

```js
import { scrim, panel, button, iconButton, title, iconUrl } from './kit.js';

export function createAdRewardPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function lockedCard(label) {
    const el = document.createElement('div');
    el.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      min-width: 150px; padding: 16px 12px;
    `;
    const lock = document.createElement('img');
    lock.src = iconUrl('locked', 'black');
    lock.alt = '';
    lock.style.cssText = 'width: 28px; height: 28px; opacity: 0.5;';
    el.appendChild(lock);
    el.appendChild(button(label, () => {}, 'off'));
    return el;
  }

  function show(onClose, onWatchAd) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('광고 보상'));

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 10px;';

    const goldWrap = document.createElement('div');
    goldWrap.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      min-width: 150px; padding: 16px 12px;
    `;
    const video = document.createElement('img');
    video.src = iconUrl('video', 'black');
    video.alt = '';
    video.style.cssText = 'width: 28px; height: 28px;';
    goldWrap.appendChild(video);

    const goldBtn = button('🪙 30개 받기', () => {
      goldBtn.disabled = true;
      goldBtn.textContent = '광고 재생 중...';
      onWatchAd();
    }, 'primary');
    goldWrap.appendChild(goldBtn);
    list.appendChild(goldWrap);

    list.appendChild(lockedCard('바주카'));
    box.appendChild(list);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 2: `settingsPanel.js` 전체 교체**

```js
import { scrim, panel, button, iconButton, title, num } from './kit.js';

export function createSettingsPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(sensitivity, onChange, onClose) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center; min-width: 300px;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('설정'));

    const label = document.createElement('div');
    label.style.cssText = 'color: #4a4a5e; font-size: 15px; margin: 10px 0 6px;';
    label.appendChild(document.createTextNode('마우스 민감도 '));
    const value = num(`${sensitivity.toFixed(1)}x`);
    label.appendChild(value);
    box.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'k-slider';
    slider.min = '0.5';
    slider.max = '2.0';
    slider.step = '0.1';
    slider.value = String(sensitivity);
    slider.addEventListener('input', () => {
      const next = parseFloat(slider.value);
      value.textContent = `${next.toFixed(1)}x`;
      onChange(next);
    });
    box.appendChild(slider);

    const doneBtn = button('닫기', onClose, 'ghost');
    doneBtn.style.cssText += 'display: block; margin: 16px auto 0;';
    box.appendChild(doneBtn);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 3: `offlineRewardPopup.js` 전체 교체**

```js
import { scrim, panel, button, title, num } from './kit.js';

export function createOfflineRewardPopup(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(goldAmount, onClaim) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'text-align: center; min-width: 280px;';
    box.appendChild(title('오프라인 보상'));

    const amount = document.createElement('div');
    amount.style.cssText = 'font-size: 40px; color: #1a1a2e; margin: 8px 0 4px;';
    amount.appendChild(document.createTextNode('🪙 '));
    amount.appendChild(num(goldAmount.toLocaleString()));
    box.appendChild(amount);

    const message = document.createElement('div');
    message.textContent = '자리를 비운 사이 모은 골드입니다!';
    message.style.cssText = 'color: #4a4a5e; font-size: 14px;';
    box.appendChild(message);

    const claimBtn = button('받기', () => {
      overlay.style.display = 'none';
      onClaim();
    }, 'primary');
    claimBtn.style.cssText += 'width: 100%; margin-top: 16px;';
    box.appendChild(claimBtn);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  return { show };
}
```

`createOfflineRewardPopup`은 `hide`를 노출하지 않는다 (기존과 동일). `game.js`가
부르지 않기 때문이다. `받기` 콜백 안에서 직접 숨긴다.

- [ ] **Step 4: 테스트와 빌드**

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add game/src/ui/adRewardPanel.js game/src/ui/settingsPanel.js game/src/ui/offlineRewardPopup.js
git commit -m "feat: reskin the ad reward, settings and offline reward modals

All three share the panel plus corner close button shape now, and the
sensitivity slider is drawn from the Kenney track and handle sprites."
```

---

### Task 9: `scopeOverlay` 토큰 정렬과 마무리 확인

레티클 형태는 건드리지 않는다. UI 크롬이 아니라 게임플레이 오버레이고, 바주카 레티클은
판정 박스(`computeBlastRadiusPx`)와 값이 묶여 있다.

**Files:**
- Modify: `game/src/ui/scopeOverlay.js:36-37` (색 상수 2줄)

**Interfaces:**
- Consumes: Task 2의 `TOKENS`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 바주카 색을 토큰에서 가져오도록 변경**

`game/src/ui/scopeOverlay.js` 위쪽에 import를 추가하고, 색 상수 2줄을 바꾼다.
나머지 파일 내용은 전부 그대로 둔다.

기존 (line 36-37):
```js
const BAZOOKA_COLOR = '#e4503a';
const BAZOOKA_CORE_COLOR = '#c43a28';
```

변경 후:
```js
const BAZOOKA_COLOR = TOKENS.danger;
const BAZOOKA_CORE_COLOR = '#c43a28';
```

파일 첫 줄에 추가:
```js
import { TOKENS } from './kit.js';
```

`TOKENS.danger`가 `'#e4503a'`이므로 렌더 결과는 동일하다. 색이 한 곳에서만 정의되게
하는 게 목적이다. `BAZOOKA_CORE_COLOR`는 레티클 중앙 점 전용이라 토큰으로 올리지 않는다.

- [ ] **Step 2: 인라인 `cssText`가 남지 않았는지 훑기**

레이아웃 배치용 `cssText`(`position`, `display`, `gap` 등)는 남아 있어도 된다.
없어야 하는 건 **색·테두리·둥글기** 하드코딩이다.

Run: `grep -rn "#f0a500\|#7ec8e3\|#14141f\|#3a3a45\|border-radius: 6px\|border-radius: 50%" game/src/ui`
Expected: 출력 없음 (exit 1). `scopeOverlay.js`의 `border-radius:50%`는 레티클 중앙 원과
표준 조준선용이므로 예외다 — 이 파일에서 나온 결과만 무시한다.

- [ ] **Step 3: 옛 색이 다른 곳에 남았는지 확인**

Run: `grep -rn "f0a500\|7ec8e3" game/src`
Expected: 출력 없음 (exit 1)

- [ ] **Step 4: 전체 테스트와 빌드**

Run: `npm test`
Expected: 123 tests passed (기존 114 + kit 5 + 상점 상태 4)

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: `dist` 크기 확인**

Run: `du -sh dist`
Expected: 원본 팩 10.6MB가 빠졌으므로 이전보다 확연히 작아야 한다.

- [ ] **Step 6: 커밋**

```bash
git add game/src/ui/scopeOverlay.js
git commit -m "refactor: source the bazooka reticle colour from the shared tokens

The reticle shape stays as it is: it is a gameplay overlay tied to
computeBlastRadiusPx, not chrome the Kenney frames can wrap."
```

- [ ] **Step 7: 사용자 육안 확인 요청**

이 세션 환경에서는 브라우저 스크린샷이 실패한다 (`document.hidden: true`, rAF 미동작).
배치 결과는 사용자만 판단할 수 있다. `npm run dev` 후 LAN 링크
`http://192.168.1.103:5173/`로 접속해 다음을 확인해 달라고 요청한다:

1. 메인 메뉴 상단 바 / 중앙 시작 버튼 / 하단 카드 3장이 겹치지 않고 보이는가
2. 버튼을 누를 때 눌리는 연출이 나오는가 (스프라이트가 flat으로 바뀌며 3px 내려감)
3. 패널 모서리가 뭉개지지 않았는가 (9-slice 슬라이스 값 확인)
4. 숫자가 Kenney 폰트로, 한글이 시스템 폰트로 나오는가
5. 상점 화살표·별 핍·무기 이미지 프레임이 정상인가
6. 설정 슬라이더 트랙과 손잡이가 보이는가
7. 아이콘이 배경에 묻히지 않는가 (밝은 패널 위 검정 아이콘)
8. **모든 버튼이 실제로 동작하는가** — 시작, 상점, 설정, 광고, 강화, 구매, 장착, 닫기.
   기존 테스트가 배선 파손을 잡지 못한다.

바주카포 탄약 주입이 필요하면 콘솔에서:
```js
localStorage.setItem('shootshoot.bazooka','5'); location.reload()
```
