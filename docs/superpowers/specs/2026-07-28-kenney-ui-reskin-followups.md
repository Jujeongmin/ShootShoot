# Kenney UI 리스킨 — 후속 항목 (2026-07-28)

리스킨은 `cf35b60..8b25950` 11커밋으로 master에 들어갔다. 테스트 125개 통과,
전체 브랜치 리뷰 통과. 이 문서는 리뷰에서 나왔지만 **머지를 막지 않아 미룬 것들**이다.

관련 문서: [설계](2026-07-28-kenney-ui-reskin-design.md),
[구현 계획](../plans/2026-07-28-kenney-ui-reskin.md)

## 사용자 육안 확인 필요 (아직 안 받음)

이 세션 환경에서 브라우저 스크린샷이 실패한다 (`document.hidden: true`, rAF 미동작).
배치 결과는 사용자만 판단할 수 있다. `npm run dev` 후 확인할 것:

1. 메인 메뉴 상단 바 / 중앙 시작 버튼 / 하단 카드 3장이 겹치지 않는가
2. 버튼 누를 때 눌림 연출이 나오는가 (스프라이트가 flat으로 바뀌며 3px 내려감)
3. 패널 모서리가 뭉개지지 않았는가 (9-slice 슬라이스 값)
4. 숫자가 Kenney 폰트, 한글이 시스템 폰트로 나오는가
5. 상점 화살표·별 핍·무기 이미지 프레임이 정상인가
6. 설정 슬라이더 트랙과 손잡이가 보이는가
7. 아이콘이 배경에 묻히지 않는가 (밝은 패널 위 검정 아이콘)
8. **모든 버튼이 실제로 동작하는가** — 시작, 상점, 설정, 광고, 강화, 구매, 장착, 닫기.
   리뷰에서 배선을 전수 추적했지만 테스트가 잡지 못하는 영역이다.
9. HUD 배지가 **게임 시작 전에는 안 보이다가** 플레이 시작하면 나타나는가
   (`8b25950`에서 고친 부분)

## 미룬 항목

### Important — 토큰 드리프트

`screens.js`, `shopPanel.js`, `settingsPanel.js`, `offlineRewardPopup.js` 네 모듈이
`kit.js`의 `TOKENS`를 import하지 않고 hex를 손으로 박았다. `hud.js`, `stageBanner.js`,
`scopeOverlay.js` 세 개만 `TOKENS`를 쓴다.

지금 값은 전부 맞아서 화면은 정상이다. 문제는 팔레트를 바꿀 때 세 파일만 따라오고
네 파일이 조용히 낡는다는 것. 공유 토큰 구조를 만든 이유가 바로 이건데 절반만 지켜졌다.

같이 처리할 것: `hud.js:17`의 라벨 색 `#4a4a5e`가 `TOKENS.inkSoft`와 같은 값인데
하드코딩돼 있다.

### Minor

- **닫기 버튼이 모달마다 다르다.** `adRewardPanel`과 `settingsPanel`은 우상단 모서리
  ✕ 아이콘 버튼(`top:-14px; right:-14px`), `shopPanel`은 하단 중앙 "닫기" 텍스트 버튼.
  설계상 구분한 게 아니라 그냥 갈렸다. `kit.closeButton()`으로 묶을 것.
- **`'off'` variant에 쓰이지 않는 핸들러를 넘긴다.** `kit.js`의 `button()`은
  `variant === 'off'`면 `onClick`을 아예 붙이지 않는데, 호출부 4곳
  (`screens.js`, `shopPanel.js` 2곳, `adRewardPanel.js`)이 `() => {}`를 넘긴다.
  무해하지만 팩토리 계약이 호출부에서 안 보인다는 신호다.
- **`game/public/icons/white/` 6개가 아무 데서도 안 쓰인다.** 모든 호출부가 톤 기본값
  `'black'`을 쓴다. 흰 아이콘은 어두운 스크림 위에 얹을 때 쓰려던 건데, 실제로는 모든
  아이콘이 노랑/회색 버튼 스프라이트 위에 올라간다. Task 1의 "쓰는 것만 벤더링" 목표와
  어긋나므로 지우거나 실제로 쓸 것.
- **`TOKENS` 테스트가 10개 중 3개만 값을 대조한다.** 나머지는 hex 형태만 본다
  (`test/uiKit.test.js`). 손으로 고칠 때 오타가 통과한다.
- **`badge()`가 `num()` 팩토리를 부르지 않고 `.k-num` span을 직접 만든다** (`kit.js`).
  둘이 따로 놀 수 있다.

## 기각된 리뷰 지적

- **`offlineRewardPopup`의 z-index 누락** — 리뷰어 오독. `offlineRewardPopup.js:5`에
  `overlay.style.zIndex = '25'`가 실제로 있고 형제 모듈과 같다. 회귀 아니다.
- **`monkey.js:41`의 `#f0a500`** — 원숭이 체력바를 `CanvasTexture`에 그리는 색이다
  (비율 50% 초과 초록, 25~50% 주황, 이하 빨강). UI 크롬이 아니라 게임플레이 렌더링이고
  설계 문서가 "범위 밖"으로 명시한 영역. 그대로 둔다.

## 계획서에서 실제로 틀렸던 것

`.gitignore`는 git 추적만 끊는다. Vite는 `game/public/`에 물리적으로 있는 걸 복사하므로,
원본 Kenney 팩 9.7MB가 계속 `dist`에 실렸다. 계획서 Task 1의 근거 자체가 틀렸다.
`f023c30`에서 두 팩을 저장소 루트 `vendor/`로 옮겨 해결했고 `dist`가 23M에서 13M이 됐다.
`vendor/`는 `.gitignore`에 있다.

## 여전히 미결인 이전 작업 항목

[2026-07-28 세션 인수인계](2026-07-28-session-handoff.md)의 바주카포 관련 육안 확인
7건은 아직 답을 못 받았다. 게임오버 시 `projectiles.clear()`가 비행 중인 포탄을
`onImpact` 없이 버리는 건도 사용자 결정 대기 중이다.
