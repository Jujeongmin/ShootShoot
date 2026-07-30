# 라운드 진행도와 이어하기 설계 (2026-07-30)

## 문제

판을 나가면 무조건 라운드 1부터 다시 시작한다. `startGame()` 이 `beginRound(1)` 로
고정돼 있고, 도달한 라운드를 어디에도 남기지 않기 때문이다. 판을 넘어 남는 것은
최고점수·골드·무기·업그레이드뿐이다.

사용자는 스테이지 게임을 원한다. 깬 만큼 남고, 이어서 하고, 지난 라운드를 골라
다시 들어갈 수 있어야 한다.

## 현재 구조에서 확인한 사실

- 지는 조건이 없다. 원숭이는 도망가지 않고 플레이어는 죽지 않는다. 판이 끝나는
  유일한 길은 `메뉴로` 를 눌러 `exitRun()` 을 부르는 것이다.
- 라운드는 상한이 없다. `difficulty.js` 가 속도와 체력을 무한히 올리고 원숭이 수만
  10에서 멈춘다.
- 라운드 클리어 분기(`targetManager.allCleared() && !projectiles.hasPending()`)가
  골드를 정산하고 `beginRound(round + 1)` 로 다음 라운드를 연다.
- 스토어는 전부 `createXStore(storage, key)` 패턴이고, **메모리에 상태를 들고 있지
  않다.** 호출할 때마다 `localStorage` 를 다시 읽는다.
- 스토리지 키 여덟 개가 `config.js` 아래쪽에 모여 있다.
- `screens.js` 의 `showMenu` 가 중앙에 `탭하여 시작` 버튼 하나와 힌트 한 줄을 그린다.

## 설계

### 1. 진행도 스토어 (`game/src/gameplay/progressStore.js`)

기존 스토어 패턴을 따르는 새 파일. 순수하게 `storage` 와 `key` 만 안다.

```
createProgressStore(storage, key) -> {
  getReachedRound(),      // 기록 없거나 손상됐으면 1
  submitCleared(round),   // max(현재, round + 1) 을 저장하고 그 값을 돌려준다
  clear(),                // removeItem
}
```

`submitCleared` 의 max 규칙이 핵심이다. 최고점수 스토어의 `submit` 과 같은 규칙이라,
라운드 선택으로 낮은 라운드를 골라 깨도 도달 라운드가 깎이지 않는다.

`config.js` 에 `progressStorageKey: 'shootshoot.progress'` 를 추가한다.

### 2. 저장 지점

`game.js` 의 라운드 클리어 분기, `currencyStore.earn(...)` 바로 옆에서
`progressStore.submitCleared(round)` 를 부른다. 골드 정산과 같은 순간이라 규칙이
하나다 — 브라우저를 그냥 닫아도 깬 라운드는 남는다.

### 3. 시작 라운드

`startGame()` 이 라운드 번호를 인자로 받게 바꾸고 `beginRound(round)` 를 부른다.
호출부는 셋이다.

| 진입 | 인자 |
|---|---|
| 이어하기 | `progressStore.getReachedRound()` |
| 라운드 선택 | 고른 라운드 |
| 처음부터(새 게임) | `1` |

### 4. 메뉴

도달 라운드가 1이면 지금과 똑같이 `탭하여 시작` 하나만 그린다. 신규 플레이어에게
"이어하기"는 뜻이 없다.

2 이상이면 중앙에 세 버튼을 세로로 쌓는다.

| 버튼 | 동작 |
|---|---|
| `이어하기 (라운드 N)` | `startGame(N)` |
| `라운드 선택` | 선택 화면을 연다 |
| `처음부터` | 확인 팝업을 띄운다 |

### 5. 라운드 선택 화면 (`game/src/ui/roundSelect.js`)

`shopPanel.js` · `settingsPanel.js` 와 같은 모달 패널 패턴의 새 파일. 숫자 버튼을
격자로 깔고 세로로 스크롤한다.

**도달 라운드까지만 그린다.** 잠긴 칸은 아예 그리지 않는다 — 라운드에 상한이 없어서
잠긴 칸을 몇 개 보여줄지 정할 기준이 없다. 도달 라운드 칸은 색으로 구분한다.

### 6. 처음부터 = 전체 새 게임

파괴적 동작이라 확인 팝업으로 한 번 막는다. 팝업은 `roundSelect.js` 와 같은 모달
패널 패턴으로 만들되, 선택 화면과 책임이 다르므로 별도 모듈(`confirmPopup.js`)로
둔다 — 문구와 두 버튼(`지우고 새로 시작` / `취소`)만 받는 얇은 모듈이다.

초기화 대상은 `config.js` 의 스토리지 키 전부에서 `highScoreStorageKey` 만 뺀 것이다:
골드, 무기, 업그레이드, 바주카, 진행도, 튜토리얼, 마지막 접속. 튜토리얼 기록도
지우므로 새 게임을 시작하면 튜토리얼을 다시 본다 — 의도한 동작이다.

지운 뒤에는 `window.location.reload()` 로 페이지를 새로고침한다. 스토어들은 상태를
안 들고 있지만 **장착 무기 모델은 `game.js` 가 이미 로드해 들고 있다.** 새로고침이
한 줄이고 확실하다. 무기 재장착과 HUD 갱신을 손으로 배선하는 대안은 새 게임 한 번
하자고 늘릴 값어치가 없다.

### 7. 골드 파밍에 대해

[2026-07-30-session-handoff.md](2026-07-30-session-handoff.md) 에 "초반 라운드 반복
골드 파밍은 열어둔다"고 적혀 있다. 이 설계는 그 결정을 **바꾸지 않는다.** 라운드
선택이 생기므로 낮은 라운드를 골라 반복하는 것은 여전히 가능하고, 사용자가 그렇게
되기를 택했다. 리뷰어가 지적하면 의도된 것이라고 답한다.

## 테스트

`test/progressStore.test.js`:

- 기록이 없으면 `getReachedRound()` 가 1
- `submitCleared(3)` 뒤에 4
- 낮은 라운드를 다시 깨도 도달 라운드가 안 깎인다 (`submitCleared(1)` 뒤에도 4)
- `clear()` 뒤에 1
- 손상된 값(`'abc'`)이면 1

가짜 storage 에 **`removeItem` 을 넣어야 한다.** `test/currencyStore.test.js` 의
`createMemoryStorage()` 에는 `getItem`/`setItem` 만 있다.

초기화 키 목록은 순수 함수로 빼서 테스트한다 — 최고점수 키가 목록에 없는지 확인한다.

메뉴 버튼 배치와 라운드 선택 격자 레이아웃은 기존 UI 모듈과 같이 **사용자 육안
확인 항목**이다. 이 환경에서는 브라우저 창이 안 열린다.

## 건드리지 않는 것

`difficulty.js` (라운드 상한 없음은 별개 문제), `targetManager.js`, `scoring.js`,
`shooting.js`, 지는 조건의 부재.
