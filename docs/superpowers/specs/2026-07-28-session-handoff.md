# 세션 인수인계 (2026-07-28)

이 문서만 읽으면 다음 세션에서 작업을 이어갈 수 있다.

## 사용자 상시 지시사항

- **애매하거나 질문 있으면 혼자 판단하지 말고 물어보고 진행할 것.**
- **토큰을 아낄 것.** 사용자가 명시적으로 요청했다. 불필요한 재확인·장황한 요약 금지.
- **작업 브랜치는 `master` 직접 커밋.** worktree 쓰지 말 것 (사용자가 두 세션 연속 명시적으로 선택).
- 게임 육안/청각 확인은 **사용자가 직접 한다.** 확인해 달라고 요청만 하면 된다.

## 환경 제약 (중요)

이 프로젝트 세션에서 **브라우저 프리뷰의 rAF 루프가 돌지 않는다.** `document.hidden: true`,
프레임 0. `computer{action:"screenshot"}`은 "the Browser pane is not displayed"로 실패한다.

- DOM 이벤트로 굴러가는 로직은 검증 가능.
- 렌더 루프에 의존하는 로직(레티클 표시, 폭발 연출, 붕괴 모션, 사운드)은 **검증 불가.**
  이런 항목은 사용자에게 넘기고, "검증 못 했다"고 명확히 말할 것.

LAN 접속 링크: `http://192.168.1.103:5173/` (`.claude/launch.json`에 `--host` 설정돼 있음).
바주카포 탄약 주입: 콘솔에서
```js
localStorage.setItem('shootshoot.bazooka','5'); location.reload()
```

## 완료된 작업 (master, 전부 커밋됨)

테스트 **114/114 통과**, 15개 파일.

### 바주카포 투사체 + 화면 기준 폭발 (Plan A)
`docs/superpowers/plans/2026-07-27-bazooka-projectile.md`, 커밋 `6516dde..61abc9f`

- 아무 곳이나 조준해도 투사체가 날아가 착탄 지점에서 폭발한다.
- 판정은 **화면 기준 정사각형**. 레티클에 그려지는 박스와 죽는 영역이 동일한 값
  (`computeBlastRadiusPx`) 하나에서 나온다. 깊이 무관이라 레인 한 줄이 통째로 죽는다.
- 레티클: 코너 브래킷 + 눈금 + 중앙 원 (사용자 첨부 이미지 기준).
- 핵심 파일: `game/src/gameplay/screenTargeting.js`, `bazookaProjectile.js`,
  `game/src/ui/scopeOverlay.js`, `game/src/config.js`의 `CONFIG.bazooka`.

### 폭발 범위 안 구조물 파괴 (Plan B)
`docs/superpowers/plans/2026-07-27-bazooka-structures.md`, 커밋 `f2f9e10..41b8ede`

- 상자 안의 **타워와 모래주머니 참호가 전부** 무너진다. 직접 맞히지 않아도 된다.
- 참호는 원래 파괴 개념이 없었는데 타워와 같은 붕괴 연출(기울기+낙하+페이드)이 생겼고,
  부서지면 총알을 막지 않는다 (`getBlockingMeshes()`가 붕괴 중인 참호를 제외).
- 판정 기준점은 **실측한 시각적 중심**(참호 `TRENCH_CENTER_LOCAL_Y = 0.586`,
  타워 `TOWER_CENTER_LOCAL_Y = 0.11`, 원숭이 `CENTER_LOCAL_Y = 1.05`). 그룹 원점을 쓰면
  발밑이 투영돼 화면에 보이는 것과 판정이 어긋난다 (Plan A 최종 리뷰에서 잡힌 버그).
- 점수는 **원숭이만**. 구조물은 0점, `towerCollapseBonus`(고정 200점) 제거.
  타워 붕괴로 죽는 원숭이는 일반 사격과 같은 콤보/연속 배율을 받는다.
- 구조물만 부순 발사는 **중립**: 미스도 아니고 배율도 안 오른다
  (`scoring.js`의 `shotOutcome.isNeutral`).

리뷰 상태: Plan A/B 모두 최종 whole-branch 리뷰 통과, Critical/Important 없음.

## 사용자가 확인해줘야 할 것 (아직 안 받았음)

1. 상자 안 타워·참호가 조준해 맞히지 않아도 무너지는가
2. **부서진 참호 자리로 총알이 통과하는가** (계속 막히면 버그)
3. **참호가 순간이동하지 않고 제자리에서 기울며 떨어지는가** — 타워와 참호의 기준 높이가
   달라 여기가 틀리기 쉬웠다
4. 라운드가 넘어가면 구조물이 전부 복구되는가
5. 타워 위 원숭이를 일반 총기로 떨어뜨렸을 때 점수가 붙는가 (200점 고정이 아니라 배율 적용값)
6. **사격이 아예 되는가** — `61abc9f`의 `aimApplied` 가드는 렌더 루프에 의존해서 검증 불가.
   사격이 안 되면 바로 되돌릴 것.
7. 폭발 연출·사운드·레티클 모양 (전부 검증 불가 항목)

알려진 어색함: 참호는 폭 3.16 / 높이 1.19인 납작한 물체를 z축으로 90° 눕히는 거라,
타워처럼 쓰러지기보다 **한쪽 끝이 들리는** 모양이 된다. 사용자가 어색하다고 하면
회전축이나 각도를 조정할 것.

## 미결 항목

**사용자 결정 대기:**
- 게임오버 시 `projectiles.clear()`가 비행 중인 포탄을 `onImpact` 없이 버려서 폭발이
  안 나온다. 게임 종료 0.3초 안에 2발 이상 쏜 좁은 경우. 계획서가 지시한 동작이라
  사용자가 정해야 한다.

**보고됨, 블로킹 아님:**
- `game.js:445`가 `hitTowerIndex !== null`을 그대로 `isPureTowerHit`으로 넘겨서,
  원숭이를 관통한 뒤 기둥까지 맞힌 샷이 콤보/헤드샷 대신 일반 히트음을 낸다. 기존 버그.
- `effects.js`가 버스트 geometry/material을 절대 dispose 하지 않는다. 발사마다,
  라운드마다 누적. 배경 작업 칩으로 등록해뒀다.
- 설정 패널이 투사체/타겟/이펙트를 멈추지 않는다 (원래부터 아무것도 안 멈췄음).
- 레티클 안쪽 눈금이 변 중점에 붙지 않고 0.45R~0.67R에 떠 있다. 참조 이미지와 비교 필요.

## 진행 중이던 작업 — Kenney UI 팩으로 UI 교체

사용자가 "다음 구현 뭐야" 질문에 **"Kenney UI 팩으로 UI 교체"**를 선택했다.
`superpowers:brainstorming` 스킬을 호출해 1단계(프로젝트 컨텍스트 파악)까지 마쳤고,
첫 질문을 하려던 시점에 세션이 끊겼다.

### 파악해둔 현황

커밋 안 된 새 에셋 (전부 미사용, `git status`에 untracked):
```
game/public/kenney_ui-pack/     PNG/{Blue,Green,Grey,Red,Yellow,Extra}/{Default,Double}/ 각 82종
game/public/kenney_game-icons/  PNG/{White,Black}/{1x,2x}/ 105종
game/public/models/Pistol.fbx, LongPistol.fbx, LongPistol_small.fbx
```

현재 UI 코드:
- `game/src/ui/` 8개 모듈, 총 731줄 —
  `hud.js`(40) `screens.js`(192) `shopPanel.js`(146) `scopeOverlay.js`(158)
  `adRewardPanel.js`(63) `settingsPanel.js`(51) `offlineRewardPopup.js`(37) `stageBanner.js`(27)
- **전부 JS 안에서 `el.style.cssText = ...` 인라인 스타일.** 공유 CSS도, 디자인 토큰도 없다.
  `game/index.html`은 17줄이고 스타일은 `html/body/#app/canvas` 4줄이 전부.
- 주황색 `#f0a500`이 여러 파일에 하드코딩돼 흩어져 있다. 하늘색 `#7ec8e3`(광고 버튼)도 마찬가지.
- 버튼은 전부 `border-radius` + 단색 배경. 이모지(🪙 📺 🐒 🎉)를 텍스트로 쓴다.
- 아이콘은 이미 `/icons/cart.png`, `/icons/gear.png`, `/icons/video.png`를 쓰고 있다
  (`screens.js`의 `iconButton`). Kenney 아이콘으로 갈아끼울 대상.
- Kenney 패널/버튼 스프라이트는 **9-slice(`border-image`)로 늘려 쓰도록 만들어진 에셋**이다.
  그냥 `background-image`로 깔면 모서리가 뭉개진다.

### 다음 세션에서 물어봐야 할 것

brainstorming 스킬 규칙대로 **한 번에 하나씩** 물을 것:

1. **재스킨 범위** — 레이아웃은 그대로 두고 프레임/버튼/아이콘만 Kenney로 바꿀지,
   배치까지 다시 짤지.
2. **색 테마** — Kenney 팩의 Blue/Green/Grey/Red/Yellow 중 무엇을 기본으로 할지.
   현재 게임 색은 주황 `#f0a500`이라 Yellow가 가장 가깝다.
3. **적용 화면 범위** — 8개 모듈 전부인지, 메인 메뉴·게임오버 같은 눈에 띄는 것부터인지.

내 판단으로 미리 정해도 되는 것(사용자에게 물을 필요 없음):
- 공유 UI 키트 모듈(`game/src/ui/kit.js` 같은 것)을 하나 만들어 9-slice 패널/버튼/아이콘
  헬퍼와 색 토큰을 모으고, 8개 모듈이 그걸 쓰게 하는 구조. 지금처럼 파일마다 인라인
  스타일을 복붙하면 재스킨이 8번 반복된다.
- 테스트 환경이 `environment: 'node'`라 **DOM이 없다.** UI 모듈은 유닛 테스트가 안 된다.
  순수 함수(색 토큰 조회, 9-slice CSS 문자열 생성 등)만 테스트 가능하도록 분리할 것.

## 워크플로 메모

- 진행 상황 원장: `.superpowers/sdd/progress.md`. 압축(compaction) 후에는 내 기억보다
  이 파일과 `git log`를 믿을 것. 여기서 complete로 적힌 태스크는 절대 재실행하지 말 것.
- 서브에이전트 디스패치 시 **셸 문법 섞지 말라고 명시할 것.** PowerShell here-string을
  Bash 툴에 넣어서 커밋 메시지에 리터럴 `@`가 박힌 사고가 있었다.
- 서브에이전트에 값을 넘길 때 일부러 틀린 값을 심어 "베껴 쓰지 말고 직접 유도했는지"
  확인하는 게 실제로 통했다 (`TOWER_CENTER_LOCAL_Y` 사례).
