# 스테이지 전환 배너 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라운드 클리어로 다음 스테이지로 넘어갈 때 화면 중앙에 "STAGE N" 텍스트가 페이드인/페이드아웃되며 잠깐 나타나는 연출을 추가한다.

**Architecture:** 새 UI 모듈 `stageBanner.js`가 `hud.js`의 `showScorePopup`과 동일한 패턴(엘리먼트 생성 → `requestAnimationFrame`으로 트랜지션 트리거 → `setTimeout`으로 제거)을 사용해 배너를 렌더링한다. `game.js`의 틱 루프 라운드 클리어 분기에서 `stageBanner.show(round + 1)`을 호출한다. 배너는 `pointer-events: none`이라 게임 플레이를 막지 않고, 별도의 일시정지 상태도 만들지 않는다.

**Tech Stack:** Vanilla JS ES modules, DOM/CSS transitions (기존 프로젝트 패턴과 동일, 신규 의존성 없음).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 신규 에셋 없음 — 텍스트/CSS로만 구현.
- 배너가 떠 있는 동안 게임을 일시정지하지 않음 — 조준/발사는 그대로 계속된다.
- 라운드 1 시작 시(최초 진입)에는 배너를 띄우지 않음 — 라운드 클리어로 다음 스테이지로 "넘어갈 때"만 해당.
- 페이드인 0.3초 → 유지 → 페이드아웃 0.3초, 총 약 1초 후 DOM에서 제거.

---

### Task 1: `stageBanner.js` 모듈 생성

**Files:**
- Create: `game/src/ui/stageBanner.js`

**Interfaces:**
- Produces: `createStageBanner(container: HTMLElement) -> { show(stageNumber: number): void }` — Task 2가 이 시그니처로 소비한다.

- [ ] **Step 1: `game/src/ui/stageBanner.js` 작성**

```js
export function createStageBanner(container) {
  function show(stageNumber) {
    const el = document.createElement('div');
    el.textContent = `STAGE ${stageNumber}`;
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #fff; font-family: sans-serif; font-size: 56px; font-weight: bold;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8); letter-spacing: 4px;
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

- [ ] **Step 2: 빌드로 문법 검증**

Run: `npm run build`
Expected: 성공, 에러 없음, 신규 파일이 번들에 포함됨 (기존 UI 모듈들과 동일하게 이 모듈은 순수 DOM 조작이라 Vitest 유닛 테스트 대상이 아님 — `hud.js`, `scopeOverlay.js`, `settingsPanel.js`와 동일한 검증 방식).

- [ ] **Step 3: Commit**

```bash
git add game/src/ui/stageBanner.js
git commit -m "feat: add stage transition banner UI module"
```

---

### Task 2: `game.js`에 배너 연결

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `createStageBanner(container) -> { show(stageNumber) }` (Task 1에서 생성)

- [ ] **Step 1: import 추가**

`game/src/gameplay/game.js` 최상단 import 목록에 추가 (기존 `import { createScopeOverlay } from '../ui/scopeOverlay.js';` 다음 줄):

```js
import { createStageBanner } from '../ui/stageBanner.js';
```

- [ ] **Step 2: 인스턴스 생성**

`createGame` 함수 내부, 기존 `const scopeOverlay = createScopeOverlay(container);` 다음 줄에 추가:

```js
const stageBanner = createStageBanner(container);
```

- [ ] **Step 3: 라운드 클리어 분기에서 배너 호출**

`start()` 함수 내부 틱 콜백의 라운드 클리어 분기를 다음과 같이 수정한다.

변경 전:
```js
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            beginRound(round + 1);
            updateHud();
          }
```

변경 후:
```js
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          }
```

(`beginRound(round + 1)`가 내부적으로 `round` 변수를 갱신하므로, `stageBanner.show(round + 1)`는 반드시 `beginRound` 호출 **이전**에 현재 `round` 값을 기준으로 계산해야 한다 — 순서를 바꾸지 않는다.)

- [ ] **Step 4: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 5: 브라우저에서 수동 확인**

Run: `npm run dev` (또는 기존 dev 서버 사용), 게임 시작 → 한 라운드를 클리어 → 화면 중앙에 "STAGE 2" 텍스트가 페이드인/아웃되며 잠깐 나타나는지 확인. 배너가 떠 있는 동안에도 조준/발사가 정상 동작하는지 확인 (플레이가 멈추지 않아야 함).

- [ ] **Step 6: Commit**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: show stage transition banner on round clear"
```

---

## Self-Review Notes

- **스펙 커버리지**: `stageBanner.js` 신규 모듈(2.1) → Task 1. `game.js` 트리거 연결(2.2, 인터페이스 요약) → Task 2. 비목표(일시정지 없음, 라운드 1 미표시, 에셋 없음) → Task 2 Step 3의 배치(라운드 클리어 시에만 호출, 최초 `beginRound(1)` 호출부에는 배너 호출 없음)로 충족.
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `createStageBanner(container) -> { show(stageNumber) }` — Task 1의 정의와 Task 2의 사용처가 동일.
- **z-index 확인**: 기존 UI 레이어 중 `hud.js`의 점수 팝업이 15, `scopeOverlay`가 12/13, `screens.js` 메뉴 오버레이가 20, `settingsPanel`이 25. 배너는 플레이 중에만 뜨고 메뉴/설정 오버레이와 동시에 뜨지 않으므로 16으로 설정해 점수 팝업보다 위, 메뉴/설정보다 아래에 둔다 — 실질적 충돌 없음.
