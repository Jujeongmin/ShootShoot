# 첫 플레이 튜토리얼 설계 (2026-07-30)

## 문제

조작을 배울 곳이 없다. 메뉴에 `클릭하여 조준, 놓아서 발사!` 한 줄이 있을 뿐이고,
그 줄은 게임이 시작되면 사라진다. **누르고 떼야 발사되는 방식은 관습과 반대**라
처음 하는 사람은 클릭했는데 아무 일도 안 일어난다고 느낀다. 장전 0.8초 동안 조준이
막히는 것도 설명이 없어서 게임이 멈춘 것처럼 보인다.

## 목표

첫 판에서 기본 사격을 단계별로 가르친다. 네 단계다 — 조준, 발사, 장전, 라운드 클리어.

## 하지 않는 것

- 헤드샷·연속 배율·엄폐물 관통·상점·업그레이드·바주카 설명. 사용자가 **기본 사격만**
  선택했다. 나머지는 따로 다룬다.
- **진행 강제.** 단계를 통과할 때까지 다른 조작을 막지 않는다.
- 별도 튜토리얼 스테이지. 평범한 라운드 1 위에 안내만 얹는다.
- 화살표·하이라이트로 화면 요소를 가리키는 것. 문구 한 줄이다.
- 음성·애니메이션 연출.

## 현재 구조 (확인함)

- `localStorage` 스토어가 이미 7개다 (`shootshoot.highscore`, `.settings`, `.gold`,
  `.lastseen`, `.weapons`, `.upgrades`, `.bazooka`). 키는 `config.js` 에 모여 있다.
- `input.onAimDown(cb)` 이 조준 시작 시점이다. `game.js` 가 이미 하나 붙여 두었다.
- `handleShot` 은 끝에서 `reload.start()` 와 `weaponViewmodel.triggerReload(...)` 를 부른다.
  여기까지 왔으면 실제로 발사된 것이다 (`phase`·`aimApplied` 가드를 이미 통과했다).
- 프레임 루프가 이미 `reload.tick(dt)` → `input.setEnabled(...)` → `hud.setHintVisible(...)` 를
  차례로 부른다. 멱등 호출을 얹기 좋은 자리다.
- 라운드 클리어는 프레임 루프의 `targetManager.allCleared() && !projectiles.hasPending()` 분기다.
- `settingsPanel.show(sensitivity, onChange, onClose, onExit)` 이고, `onExit` 이 함수일
  때만 `메뉴로` 버튼이 붙는다. 같은 방식으로 인자를 하나 더 받으면 된다.
- UI 모듈은 `theme.css` 클래스와 `kit.js` 팩토리를 쓴다. **hex 를 손으로 박지 않는다** —
  이번 세션에 그걸 전부 걷어냈다.

## 설계

### 파일 셋

| 파일 | 책임 |
|---|---|
| `game/src/gameplay/tutorialState.js` | 단계와 전이만 아는 순수 상태 기계 |
| `game/src/gameplay/tutorialStore.js` | "봤음"을 `localStorage` 에 남긴다 |
| `game/src/ui/tutorialPrompt.js` | 문구 한 줄을 화면에 띄운다 |

상태 기계와 저장소를 나누는 이유: **저장소는 판을 넘어 남고 상태는 판 안에서만
산다.** 한 모듈에 넣으면 "다시 보기"를 누를 때 무엇을 지워야 하는지가 흐려진다.

### 단계

| 단계 | 문구 | 넘어가는 이벤트 |
|---|---|---|
| `aim` | `마우스를 누른 채로 조준하세요` | `aimStarted` |
| `fire` | `손을 떼면 발사됩니다` | `shotFired` |
| `reload` | `장전 중에는 조준할 수 없습니다` | `reloadFinished` |
| `clear` | `원숭이를 모두 잡으면 다음 라운드로` | `roundCleared` |
| `done` | (문구 없음) | — |

### `tutorialState.js`

```js
createTutorialState() -> {
  current(),      // 'aim' | 'fire' | 'reload' | 'clear' | 'done'
  handle(event),  // 'aimStarted' | 'shotFired' | 'reloadFinished' | 'roundCleared'
  isDone(),
  reset(),
}
```

**현재 단계가 기다리는 이벤트만 받는다.** 그 밖의 이벤트는 무시한다 — 조준을 여러 번
누르거나 장전이 여러 번 끝나도 단계가 건너뛰어지지 않는다. `done` 에서는 어떤
이벤트도 아무 일을 하지 않는다. `reset()` 은 `aim` 으로 되돌린다.

문구는 이 모듈에 없다. 단계 이름만 내보내고 문구는 UI가 갖는다 — 그래야 문구를
고칠 때 상태 기계 테스트가 깨지지 않는다.

### `tutorialStore.js`

```js
createTutorialStore(storage, key) -> { isDone(), markDone(), clear() }
```

기존 스토어들과 같은 모양이다. 값은 `'1'` 한 글자만 쓴다. 키는 `config.js` 에
`tutorialStorageKey: 'shootshoot.tutorial'` 로 넣는다.

`storage` 를 인자로 받으므로 가짜 storage 로 테스트된다.

### `tutorialPrompt.js`

```js
createTutorialPrompt(container) -> { show(step), dispose() }
```

`show(step)` 은 매 프레임 불린다. 단계가 지난 프레임과 같으면 아무것도 하지 않고,
바뀌면 문구를 갈아 끼운다. `'done'` 이면 숨긴다.

**위치는 화면 하단 중앙.** 우측 상단은 `P` 힌트가 쓰고 있고 화면 중앙은 조준선이라
비워야 한다. `theme.css` 에 `.k-tutorial` 클래스를 더하고 색은 CSS 변수를 쓴다.

### 배선 (`game.js`)

이벤트를 보내는 곳 넷:

1. `input.onAimDown` 콜백 안 — `aimStarted`
2. `handleShot` 끝, `reload.start()` 옆 — `shotFired`
3. 프레임 루프 — `reload.isReloading()` 이 지난 프레임 `true` 에서 이번 프레임 `false` 로
   떨어지는 순간 `reloadFinished`. 루프에서 이미 `isReloading()` 을 부르므로 지난 값을
   담을 변수 하나만 더 둔다
4. 라운드 클리어 분기 — `roundCleared`

프레임 루프에 `tutorialPrompt.show(tutorialState.current())` 를 더한다.
`hud.setHintVisible(...)` 바로 옆이다.

`startGame()` 에서 `tutorialStore.isDone()` 이 거짓이면 `tutorialState.reset()`,
참이면 아무것도 안 한다 (상태는 `done` 으로 남는다). `roundCleared` 로 `done` 에
도달하면 `tutorialStore.markDone()`.

### 다시 보기

`settingsPanel.show(sensitivity, onChange, onClose, onExit, onReplayTutorial)`.
`onReplayTutorial` 이 함수일 때만 `튜토리얼 다시 보기` 버튼이 붙는다 — `onExit` 과 같은
규칙이다. 플레이 중과 메뉴 **양쪽에서** 넘긴다. 튜토리얼은 조작 설명이라 어디서든
다시 볼 수 있어야 한다.

핸들러는 `tutorialStore.clear()` 와 `tutorialState.reset()` 을 부르고 설정을 닫는다.
플레이 중에 눌렀으면 그 판에서 바로 1단계부터 보인다. 메뉴에서 눌렀으면 다음 판
시작 때 보인다 (`startGame` 이 `isDone()` 을 다시 보므로 저절로 그렇게 된다).

## 테스트

`test/tutorialState.test.js`:

- 처음은 `aim` 이다
- `aimStarted` 로 `fire` 로 간다
- `fire` 에서 `aimStarted` 를 또 받아도 그대로 `fire` 다
- 네 이벤트를 순서대로 받으면 `done` 이 되고 `isDone()` 이 참이다
- `done` 에서 어떤 이벤트를 받아도 `done` 이다
- `reset()` 이 `aim` 으로 되돌리고 `isDone()` 이 거짓이 된다
- 순서를 건너뛰는 이벤트는 무시된다 (`aim` 에서 `roundCleared` 를 받아도 `aim`)

`test/tutorialStore.test.js` (가짜 storage):

- 아무것도 저장돼 있지 않으면 `isDone()` 이 거짓이다
- `markDone()` 뒤에는 참이다
- `clear()` 뒤에는 다시 거짓이다
- 다른 값이 들어 있어도 `'1'` 이 아니면 거짓이다

기존 164개는 그대로 통과해야 한다.

## 육안 확인 항목 (사용자)

1. `localStorage` 를 비우고 새로 시작하면 하단에 `마우스를 누른 채로 조준하세요` 가 뜨는가
2. 누르면 `손을 떼면 발사됩니다` 로 바뀌는가
3. 쏘면 `장전 중에는 조준할 수 없습니다` 로 바뀌고, 장전이 끝나면 다음 문구로 가는가
4. 라운드를 깨면 문구가 사라지고 다시 안 나오는가
5. 두 번째 판에서는 처음부터 안 뜨는가
6. 설정에 `튜토리얼 다시 보기` 가 있고, 플레이 중에 누르면 그 판에서 바로 1단계가 뜨는가
7. 메뉴에서 눌렀을 때는 다음 판 시작 때 뜨는가
8. 문구가 조준선이나 우측 상단 `P` 힌트와 겹치지 않는가
