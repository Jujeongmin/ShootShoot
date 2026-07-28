# Kenney UI 팩 리스킨 설계 (2026-07-28)

## 목표

`game/src/ui/`의 8개 모듈을 Kenney UI 팩 스프라이트로 전면 교체한다. 스킨만 바꾸는 게
아니라 **화면 배치까지 다시 짠다.** 색 테마는 Kenney Yellow.

## 사용자가 확정한 결정

| 항목 | 결정 |
|---|---|
| 리스킨 범위 | 배치까지 다시 짜기 |
| 색 테마 | Yellow |
| 적용 범위 | 8개 모듈 한 번에 전부 |
| 구조 | 하이브리드 (`theme.css` + `kit.js`) |
| 한글 폰트 | 숫자/영문만 Kenney, 한글은 시스템 폰트 |
| 에셋 정리 | 쓰는 것만 복사해 커밋, 원본 팩은 gitignore |

## 현재 상태

- `game/src/ui/` 8개 모듈, 총 731줄. **전부 `el.style.cssText = ...` 인라인 스타일.**
  공유 CSS도, 디자인 토큰도 없다.
- `game/index.html`은 17줄, 스타일은 `html/body/#app/canvas` 4줄이 전부.
- 주황 `#f0a500`과 하늘색 `#7ec8e3`(광고 버튼)이 여러 파일에 하드코딩돼 흩어져 있다.
- 아이콘은 이미 `/icons/{cart,gear,video}.png`를 쓴다 (`screens.js`의 `iconButton`).

## 에셋 실측

`game/public/kenney_ui-pack/`, `game/public/kenney_game-icons/` (둘 다 untracked).

**전용 panel 스프라이트가 없다.** Kenney 신형 팩은 `button_rectangle_*`(192x64)를
9-slice로 늘려 패널로도 쓰도록 만들어졌다.

측정한 색 (팔레트 PNG 디코드):

| 스프라이트 | 구조 |
|---|---|
| `Yellow/Default/button_rectangle_flat` | 외곽 `#dea312` 2px, 하이라이트 `#ffea9c` 2px, 면 `#ffcc00` |
| `Yellow/Default/button_rectangle_depth_flat` | 위와 같고 밑단에 `#b48000` 4px 립 추가 |
| `Yellow/Default/button_rectangle_border` | 노란 테두리(0~8px) + **회색 `#dadce7` 내부** |
| `Grey/Default/button_rectangle_flat` | 면 `#dadce7`, 립 `#989aaf` |
| `Extra/Default/input_rectangle` | 흰 면 + `#989aaf` 인셋 — 움푹한 입력칸 |
| `Extra/Default/divider` | 64x4 |

`button_rectangle_border`가 노란 테두리 + 중립 회색 내부라서, 화면이 온통 노랑이 되는
문제 없이 Yellow 테마를 쓸 수 있다. 이게 패널의 기본 스프라이트다.

**폰트:** `Kenney Future.ttf` / `Kenney Future Narrow.ttf` 동봉. cmap 확인 결과 글리프
214자, 범위는 U+20-7E, U+A1-FF 등 **라틴 계열뿐. 한글 글리프가 0개다.** 그래서 한글은
시스템 폰트로 두고 숫자·영문에만 Kenney를 지정한다 (브라우저가 글자별로 폴백).

**아이콘:** 105종, White/Black x 1x(50x50)/2x. 두 벌인 이유가 있다 — 회색 `#dadce7`
패널 위에 흰 아이콘은 안 보인다. 밝은 면엔 Black, 어두운 스크림 위엔 White.

## 아키텍처

새 파일 2개. 기존 8개 모듈에서 `cssText`를 전부 제거한다.

### `game/src/ui/theme.css`

`main.js`에서 `import './ui/theme.css'` (Vite가 번들).

`@font-face` 2개(Kenney Future, Kenney Future Narrow) + CSS 변수 토큰 + 컴포넌트 클래스.

```
--k-face #ffcc00   --k-hi #ffea9c        --k-shadow #dea312   --k-deep #b48000
--k-grey #dadce7   --k-grey-shadow #989aaf                    --k-white #ffffff
--k-ink #1a1a2e    --k-ink-soft #4a4a5e  --k-danger #e4503a
--k-scrim rgba(12,12,20,0.62)
--k-font-num 'Kenney Future Narrow'      --k-font-display 'Kenney Future'
```

| 클래스 | 스프라이트 | 비고 |
|---|---|---|
| `.k-scrim` | — | 전체 화면 스크림, flex 중앙 정렬 |
| `.k-panel` | `Yellow/button_rectangle_border` | 노란 테두리 + 회색 내부 |
| `.k-btn` | `Yellow/button_rectangle_depth_flat` | `:active`에 `..._flat` + `translateY(3px)` |
| `.k-btn--ghost` | `Grey/button_rectangle_depth_flat` | 닫기·보조 |
| `.k-btn--off` | `Grey/button_rectangle_flat` | 비활성, `#989aaf` 글자, 눌림 없음 |
| `.k-icon-btn` | `Yellow/button_square_depth_flat` | 안에 `<img>` |
| `.k-badge` | `Extra/input_rectangle` | 움푹한 흰 칸 — 골드·점수 |
| `.k-divider` | `Extra/divider` | `repeat-x` |
| `.k-num` | — | Kenney Narrow, 숫자 전용 |

9-slice 값은 전부 `8`. depth 버튼만 밑단 립 때문에 `8 8 12 8`.
(외곽 2px + 하이라이트 2px + 코너 반경 약 4px = 8)

`:active` 눌림 연출이 CSS여야 하는 이유: 인라인 스타일로는 의사 클래스를 못 쓴다.
Kenney의 `_depth_` 유무가 곧 눌림 상태라, 이걸 JS 이벤트로 배선하면 8개 모듈에
같은 코드가 반복된다.

### `game/src/ui/kit.js`

엘리먼트 팩토리 + 순수 함수. 8개 모듈은 여기만 부른다.

**엘리먼트 팩토리:** `panel()`, `button(label, onClick, variant)`,
`iconButton(icon, alt, onClick, size)`, `badge(icon, text)`, `divider()`, `title(text)`

**순수 함수 (테스트 대상):**
- `iconUrl(name, tone)` -> `/icons/{tone}/{name}.png`
- `sliceCss(sprite, slice)` -> `border-image` 축약 문자열
- `TOKENS` -> CSS 변수를 그대로 반영한 객체

`button()`은 `onClick`을 반드시 붙인다. 핸들러 배선이 끊기면 조용히 죽기 때문에
팩토리가 강제하는 편이 안전하다.

### 에셋 폴더 정리

두 팩이 10.6MB로 `game/public/` 전체의 88%다. Vite는 `public/`을 통째로 `dist`에
복사한다. 실제로 쓰는 건 스프라이트 약 12개 + 아이콘 약 10개.

- 쓰는 스프라이트를 `game/public/ui/`로 복사해 커밋
- 쓰는 아이콘을 `game/public/icons/{white,black}/`로 복사해 커밋
  (기존 `game/public/icons/{cart,gear,video}.png`는 Kenney 것으로 대체 후 삭제)
- 원본 팩 폴더 `kenney_ui-pack/`, `kenney_game-icons/`는 `.gitignore`에 추가.
  원본은 사용자 디스크에 남는다.

## 화면별 재배치

### 1. 메인 메뉴 (`screens.showMenu`)

현재는 좌중앙 상점 아이콘, 우중앙 바주카 카드, 우상단 골드+아이콘 2개, 중앙 타이틀,
좌하단·우하단 강화 카드로 흩어져 있다. 3단으로 정리한다.

- **상단 바:** 좌측 로고 `SHOOTSHOOT`, 우측 골드 배지(`.k-badge` + 코인 아이콘) +
  아이콘 버튼 3개 (상점 `cart`, 광고 `video`, 설정 `gear`)
- **중앙:** 큰 시작 버튼 하나 (`.k-btn`, 폭 320px) + 안내문 `클릭하여 조준, 놓아서 발사!`
- **하단 독:** 공격력 / 오프라인 / 바주카포 카드 3장을 한 줄로. 각 카드는 `.k-panel`에
  제목 + Lv 배지 + 액션 버튼.

카드 액션 버튼 규칙은 현재 로직 그대로 유지한다 — 골드가 충분하면 `강화`(`.k-btn`),
부족하면 `무료강화`(`.k-btn--ghost` + `video` 아이콘). 바주카는 탄약이 있으면 `n/5`
표시, 없으면 `획득` 버튼.

### 2. 게임오버 (`screens.showGameOver`)

`.k-panel` 카드 1장: 제목 `게임 종료`, 큰 점수(`.k-num`), `.k-divider`, 최고점수 행,
신기록이면 `star.png` 배지, `메인 메뉴로` 버튼.

### 3. HUD (`hud.js`)

좌상단 텍스트 3줄 -> `.k-badge` 3개 세로 스택 (점수/연속/라운드). 숫자는 `.k-num`.
`pointer-events: none` 유지. 점수 팝업은 색 토큰만 교체하고 애니메이션은 그대로.

### 4. 상점 (`shopPanel.js`)

좌우 화살표 캐러셀 구조는 유지한다 (잘 동작한다). 스킨만 교체:

- 패널 `.k-panel`
- 화살표: `Yellow/button_round_depth_flat` + `arrow_basic_w` / `arrow_basic_e`
- 무기 이미지는 `Extra/input_rectangle` 프레임 안에
- 데미지 핍 `●` -> `star.png` / `star_outline.png` 5개
- 도트 인디케이터는 구조 유지, 색만 토큰으로
- 버튼 4상태 -> `.k-btn`(구매) / `.k-btn--ghost`(장착하기) / `.k-btn--off`(장착 중, 골드 부족)

`shopPanel.js`의 if/else 사슬에 묻혀 있는 상태 판정을
`weaponButtonState(weapon, gold) -> 'equipped'|'equip'|'buy'|'insufficient'`로 추출한다.
DOM 없이 테스트할 수 있는 유일한 부분이다.

### 5. 광고 보상 (`adRewardPanel.js`)

`.k-panel` + 보상 2칸 (골드 / 바주카). 잠긴 칸은 `locked.png` + `.k-btn--off`.
우상단 `cross.png` 아이콘 버튼으로 닫기.

### 6. 설정 (`settingsPanel.js`)

`.k-panel` + Kenney 슬라이더. `input[type=range]`를 `::-webkit-slider-runnable-track`
(`slide_horizontal_color`) / `::-webkit-slider-thumb`(`slide_hangle`)로 스킨.
민감도 라벨은 `.k-num`으로 숫자만 Kenney.

### 7. 오프라인 보상 (`offlineRewardPopup.js`)

`.k-panel` + 큰 코인 아이콘 + 금액(`.k-num`) + `받기` 버튼.

### 8. 스테이지 배너 (`stageBanner.js`)

`STAGE 3`은 라틴+숫자라 Kenney Future가 그대로 적용된다. 노랑 `--k-face` +
어두운 외곽선. 기존 페이드 인/아웃 타이밍 유지.

### 9. scopeOverlay (`scopeOverlay.js`)

**형태는 그대로 둔다.** 조준경 레티클은 UI 크롬이 아니라 게임플레이 오버레이고,
바주카 레티클은 판정 박스(`computeBlastRadiusPx`)와 값이 묶여 있어 Kenney 프레임을
씌울 자리가 없다. `BAZOOKA_COLOR = '#e4503a'`를 `--k-danger`와 같은 값으로 맞추는
것 외에는 변경하지 않는다.

## 테스트

`vitest.config.js`가 `environment: 'node'`라 **DOM이 없다.** UI 모듈은 유닛 테스트가
불가능하다. 순수 함수만 테스트한다:

- `iconUrl(name, tone)` 경로 생성
- `sliceCss(sprite, slice)` border-image 문자열
- `TOKENS` 값이 전부 유효한 색 문자열인지
- `weaponButtonState(weapon, gold)` 4가지 분기

기존 114개 테스트는 전부 통과 상태를 유지해야 한다.

## 위험 요소

1. **회귀를 자동으로 못 잡는다.** UI만 바뀌므로 기존 114개 테스트가 배선 파손을
   감지하지 못한다. `onStart` / `onBuy` / `onEquip` 같은 핸들러가 끊기면 조용히 죽는다.
   완화책: 핸들러 이름과 호출 시그니처를 바꾸지 않는다. `kit.button()`이 `onClick`을
   반드시 붙이도록 한다.
2. **육안 검증을 사용자만 할 수 있다.** 이 세션 환경에서 브라우저 스크린샷이 실패한다
   (`document.hidden: true`, rAF 미동작). 배치 결과 판단은 전적으로 사용자 몫이다.
3. **`border-image`가 그려지면 `border-radius`는 아무 효과가 없다.** 모서리 둥글기는
   스프라이트가 가진 모양이 전부다. 9-slice를 쓰는 요소에서 기존 `border-radius`와
   `background`는 제거한다. 남겨두면 스프라이트 뒤로 색이 비쳐 나온다.
4. **9-slice 슬라이스 값이 틀리면 모서리가 뭉개진다.** 실측값 8 (depth는 `8 8 12 8`)을
   그대로 쓴다.

## 범위 밖

- Kenney 사운드(`click-a.ogg` 등) UI 효과음 — 이번 작업 아님
- 한글 웹폰트 도입 — 사용자가 시스템 폰트 유지를 선택
- `scopeOverlay`의 레티클 형태 변경
- 게임 로직, 점수 계산, 바주카 판정 등 UI 외 코드
