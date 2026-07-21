# 무기 상점 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 메뉴에서 진입하는 "무기 상점" 화면을 만든다. 현재 보유한 저격총을 "장착 중"으로 보여주고, 향후 확장을 위한 잠긴 "준비 중" 자리 2개를 함께 보여준다. 이번 범위에는 실제 구매/장착 로직이 없다.

**Architecture:** 새 UI 모듈 `shopPanel.js`가 `settingsPanel.js`와 동일한 패턴(전체 화면 오버레이, `show(onClose)`/`hide()`)으로 상점 화면을 렌더링한다. `screens.js`의 `showMenu`가 "상점" 버튼을 위한 콜백 인자를 하나 더 받도록 확장된다. `game.js`는 `settingsPanel`과 완전히 독립적인 `shopPanel` 인스턴스와 `openShopFromMenu`/`closeShop` 핸들러 쌍을 추가한다 — 메뉴에서만 진입 가능하고, 플레이 중 접근(단축키 등)은 만들지 않는다.

**Tech Stack:** Vanilla JS ES 모듈, DOM 렌더링(기존 `settingsPanel.js`/`screens.js`와 동일한 패턴, 신규 의존성 없음).

## Global Constraints

- TypeScript 사용 안 함 — 순수 JS ES 모듈만 사용.
- 실제 구매 가능한 무기/업그레이드는 만들지 않음 — 잠긴 "준비 중" 카드 2개만 표시.
- 무기 데미지가 점수 배율에 반영되는 로직은 만들지 않음.
- 무기 전환/장착 로직은 만들지 않음 — 총이 하나뿐이라 전환 개념 자체가 없음, "장착 중" 카드는 항상 저격총 고정 표시.
- 플레이 중 상점 접근(단축키 등)은 만들지 않음 — 메인 메뉴에서만 진입.
- 새 3D 총 모델 에셋은 확보하지 않음.

---

### Task 1: `shopPanel.js` 모듈 생성

**Files:**
- Create: `game/src/ui/shopPanel.js`

**Interfaces:**
- Produces: `createShopPanel(container: HTMLElement) -> { show(onClose: () => void): void, hide(): void }` — Task 3이 이 시그니처로 소비한다.

- [ ] **Step 1: `game/src/ui/shopPanel.js` 작성**

```js
export function createShopPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function card(label, locked) {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
      margin: 8px; padding: 16px 24px; border-radius: 6px; min-width: 160px;
      text-align: center;
      background: ${locked ? 'rgba(255,255,255,0.1)' : 'rgba(240,165,0,0.2)'};
      color: ${locked ? '#888' : '#fff'};
      border: 1px solid ${locked ? '#555' : '#f0a500'};
    `;
    return el;
  }

  function show(onClose) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '무기 상점';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: row;';
    list.appendChild(card('장착 중: 저격총', false));
    list.appendChild(card('준비 중', true));
    list.appendChild(card('준비 중', true));
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    closeBtn.addEventListener('click', onClose);
    overlay.appendChild(closeBtn);

    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. 이 모듈은 순수 DOM 렌더링이라 Vitest 유닛 테스트 대상이 아니다(`settingsPanel.js`, `screens.js`와 동일한 검증 방식).

- [ ] **Step 3: Commit**

```bash
git add game/src/ui/shopPanel.js
git commit -m "feat: add shopPanel.js UI module for weapon shop shell"
```

---

### Task 2: `screens.js` — 메인 메뉴에 "상점" 버튼 추가

**Files:**
- Modify: `game/src/ui/screens.js`

**Interfaces:**
- Consumes: `showMenu(onStart, onSettings, onShop, gold)` — Task 3이 네 개 인자 모두 채워서 호출한다.

- [ ] **Step 1: `showMenu` 함수 수정**

`game/src/ui/screens.js`의 `showMenu` 함수를 다음과 같이 수정한다.

변경 전:
```js
  function showMenu(onStart, onSettings, gold) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    const goldEl = document.createElement('p');
    goldEl.textContent = `보유 골드: ${gold}`;
    overlay.appendChild(goldEl);
    overlay.appendChild(button('시작하기', onStart));
    overlay.appendChild(button('설정', onSettings));
    show();
  }
```

변경 후:
```js
  function showMenu(onStart, onSettings, onShop, gold) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    const goldEl = document.createElement('p');
    goldEl.textContent = `보유 골드: ${gold}`;
    overlay.appendChild(goldEl);
    overlay.appendChild(button('시작하기', onStart));
    overlay.appendChild(button('설정', onSettings));
    overlay.appendChild(button('상점', onShop));
    show();
  }
```

(`showGameOver`, `showLoading`, `clear`, `show`, `hide`, `button`, `return` 문은 전혀 건드리지 않는다 — `showMenu` 함수 하나만 수정한다.)

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음. (`game.js`가 아직 옛 시그니처로 `showMenu`를 호출하고 있어서 `onShop`이 `undefined`로 전달되지만, "상점" 버튼 클릭 시 에러가 나는 것은 Task 3에서 해결되는 일시적인 상태다 — 빌드 자체는 정상 통과한다.)

- [ ] **Step 3: Commit**

```bash
git add game/src/ui/screens.js
git commit -m "feat: add shop button to main menu"
```

---

### Task 3: `game.js` — 상점 진입/복귀 흐름 연결

**Files:**
- Modify: `game/src/gameplay/game.js`

**Interfaces:**
- Consumes: `createShopPanel(container) -> { show(onClose), hide() }`(Task 1), `screens.showMenu(onStart, onSettings, onShop, gold)`(Task 2).

- [ ] **Step 1: import 추가**

`game/src/gameplay/game.js` 최상단 import 목록에 추가 (기존 `import { createSettingsPanel } from '../ui/settingsPanel.js';` 다음 줄):

```js
import { createShopPanel } from '../ui/shopPanel.js';
```

- [ ] **Step 2: 인스턴스 생성**

`createGame` 함수 내부, 기존 `const settingsPanel = createSettingsPanel(container);` 다음 줄에 추가:

```js
  const shopPanel = createShopPanel(container);
```

- [ ] **Step 3: `openShopFromMenu`/`closeShop` 핸들러 추가**

`closeSettings` 함수 정의 바로 다음(그리고 `window.addEventListener('keydown', ...)` 블록 이전)에 추가:

```js
  function openShopFromMenu() {
    screens.hide();
    shopPanel.show(closeShop);
  }

  function closeShop() {
    shopPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
  }
```

- [ ] **Step 4: 기존 `screens.showMenu(...)` 호출부 3곳에 `openShopFromMenu` 인자 추가**

파일 안에 `screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get())`라는 동일한 호출이 정확히 3곳에 있다 — `returnToMenu()` 안, `closeSettings()`의 `if (settingsOrigin === 'menu')` 분기 안, 그리고 `start()` 함수 맨 끝 `Promise.all(...).then(...)` 콜백 안. **이 3곳 전부**를 다음과 같이 바꾼다.

변경 전(3곳 전부 동일):
```js
screens.showMenu(startGame, openSettingsFromMenu, currencyStore.get());
```

변경 후(3곳 전부 동일):
```js
screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
```

(각 줄의 들여쓰기는 원래 위치 그대로 유지한다 — `returnToMenu()`와 `closeSettings()` 안은 4칸 들여쓰기, `Promise.all(...).then(...)` 콜백 안은 6칸 들여쓰기.)

- [ ] **Step 5: 빌드로 검증**

Run: `npm run build`
Expected: 성공, 에러 없음.

- [ ] **Step 6: 테스트 스위트 전체 재실행**

Run: `npm test` (저장소 루트에서)
Expected: PASS — 25개 테스트 전부 통과(이 작업은 `game.js`만 수정하므로 순수 함수 테스트에는 영향이 없어야 한다).

- [ ] **Step 7: 브라우저에서 수동 확인**

Run: `npm run dev`, 메인 메뉴에 "상점" 버튼이 보이는지 확인 → 클릭하면 상점 화면으로 전환되어 "장착 중: 저격총" 카드와 "준비 중" 잠긴 카드 2개가 보이는지 확인 → "닫기"를 누르면 골드 표시가 정상인 메인 메뉴로 돌아오는지 확인 → "설정" 버튼도 여전히 정상 동작하는지(상점과 서로 간섭 없는지) 확인.

- [ ] **Step 8: Commit**

```bash
git add game/src/gameplay/game.js
git commit -m "feat: wire weapon shop entry/exit flow into game.js"
```

---

## Self-Review Notes

- **스펙 커버리지**: 상점 UI 구조(2.2) → Task 1. 메인 메뉴 버튼 + 진입/복귀 흐름(2.3) → Task 2 + Task 3. 인터페이스 변경 요약 → 세 Task가 각각 대응. 비목표(실제 구매 없음, 데미지 로직 없음, 전환 로직 없음, 플레이 중 접근 없음, 새 에셋 없음) → 계획에 해당 기능이 아예 등장하지 않으므로 자동 충족.
- **플레이스홀더 스캔**: 없음 — 모든 스텝에 완전한 코드 포함.
- **타입/시그니처 일관성**: `createShopPanel(container) -> { show(onClose), hide() }`(Task 1) → `game.js`가 `shopPanel.show(closeShop)`/`shopPanel.hide()`로 소비(Task 3). `showMenu(onStart, onSettings, onShop, gold)`(Task 2) → `game.js`의 4곳 호출부(초기 진입 3곳 + `closeShop` 1곳) 전부 동일한 인자 순서로 호출(Task 3) — 일치.
- **기존 로직 보존 확인**: `handleShot`, 틱 루프의 라운드 클리어/총알 소진 분기, `endGame()`의 두 불변 조건(하이스코어 읽기 순서, 라운드 클리어가 `else` 분기 안에 있는 것)은 이번 계획에서 전혀 건드리지 않는다 — Task 3의 변경은 새 핸들러 2개 추가와 기존 `showMenu` 호출부의 인자 목록 수정뿐이다.
