# 세션 인수인계 (2026-07-31 작업분)

이 문서만 읽으면 다음 세션에서 작업을 이어갈 수 있다.
직전 문서는 [2026-07-31-session-handoff.md](2026-07-31-session-handoff.md) 이고,
**아래에서 뒤집은 것 말고는 여전히 유효하다.**

## 이번에 바뀐 전제 — 앞 문서를 덮어쓴다

| 앞 문서 | 지금 |
|---|---|
| "원격 저장소가 없다. 전부 로컬 master 에만 있다" | **공개 저장소가 있다.** github.com/Jujeongmin/ShootShoot |
| "작업 브랜치는 master 직접 커밋" | **작업 브랜치는 `dev`.** 기본 브랜치는 `main` |
| (없음) | **작업 하나 끝날 때마다 커밋하고 `git push` 까지 한다.** 사용자 명시 요구 |

`main` 은 `cbfb063` 에서 멈춰 있다. 합칠지는 사용자가 정한다.

## 사용자 상시 지시사항 (계속 유효)

- **애매하면 혼자 판단하지 말고 물어볼 것.**
- **토큰을 아낄 것.** 불필요한 재확인·장황한 요약 금지.
- 게임 육안/청각 확인은 **사용자가 직접 한다.** 확인해 달라고 요청만 하면 된다.
- 기능 작업은 브레인스토밍 → 스펙 → 계획서 → 서브에이전트 실행(SDD) 순서를 좋아한다.
  실행 방식을 물으면 대체로 "1번"(서브에이전트)을 고른다.
- SDD 원장은 **육안 확인이 끝난 뒤에** 지운다.
- worktree 쓰지 말 것.

## 환경 제약

- **브라우저 창이 이 환경에서 안 열린다.** 레이아웃·애니메이션·연출은 전부 사용자 육안 확인이다.
- 검증 가능한 것: `npm test`, `npm run build`, `node -e`, 파일 직접 읽기.
- **`python` 이 없다.** 파일 수정은 Edit 툴이나 `node -e` 를 쓸 것.
- **Node는 v24.18.0이고 `.ts` 파일을 직접 실행한다** (타입 제거 내장). 확인해 뒀다.
- 개발 서버: 이 PC에서는 5173을 TowerWar가 잡고 있어 **5174**. 다른 기기에선 5173으로 뜬다.
  `preview_start` 가 돌려주는 5~6만번대 포트는 브라우저 패널 내부 프록시 포트다 —
  사용자에게는 반드시 실제 포트를 알려줄 것.

## 다른 기기에서 이어받기

**OneDrive 바깥에 클론해야 한다.** 이 폴더가 `C:\Users\anjsh\OneDrive\Desktop\ShootShoot`
라서, 같은 OneDrive를 쓰는 기기에서 또 클론하면 사본 둘이 엉킨다.

```
mkdir C:\dev -Force
cd C:\dev
git clone https://github.com/Jujeongmin/ShootShoot.git
cd C:\dev\ShootShoot
git checkout dev
npm install
```

**클론이 안 주는 것:** `node_modules`(설치하면 됨), `.superpowers/`(SDD 스크래치, gitignore
대상 — 설계·계획 문서는 `docs/superpowers/` 에 커밋돼 있다), 그리고 **게임 진행도**.
진행도는 브라우저 `localStorage` 라 기기마다 따로다. 테스트용으로 채우려면 F12 콘솔에서:

```
localStorage.setItem('shootshoot.gold','99999'); localStorage.setItem('shootshoot.progress','20'); location.reload()
```

## 이번 세션에 끝낸 것 — 테스트 203 → 219개 통과

### 1. 원숭이 좌우 순찰

[설계](2026-07-31-monkey-patrol-design.md) · [계획](../plans/2026-07-31-monkey-patrol.md)

원숭이가 과녁처럼 보이던 것을 고쳤다. 좌우 이동은 원래 있었고(`laneLayout` 의 sway),
**빠진 건 몸의 방향뿐이었다.**

- `patrolMotion.js` — 순찰 곡선만 아는 순수 모듈. `sample(elapsed, dt)` 가
  `{ offsetX, facing, gaitDelta, stride, taunt }` 를 낸다. 궤적 공식은 예전 `updateIdle`
  인라인과 **수치까지 동일**하다 (난이도 불변)
- 순찰 끝(속도 0)에서 정면으로 돌아 플레이어를 본다. **도발은 그 순간에만** 나온다 —
  랜덤 타이머(`isTaunting`/`nextTauntAt`/`tauntElapsed`)는 통째로 사라졌다
- FBX에 **애니메이션 클립이 idle 하나뿐**이라 걸음은 절차적이다. `b_Left_Leg01` /
  `b_Right_Leg01` 본을 `mixer.update(dt)` **뒤에** `+=` 로 흔든다. 앞에서 하면 클립이 지운다
- 걸음 위상은 **시간이 아니라 나아간 거리**로 돈다. 그래야 발이 안 미끄러진다

**리뷰가 잡은 실제 버그 셋 (전부 고침):** 타워 원숭이가 랜덤한 다리 벌린 자세로 얼어붙어
있던 것, `startDeath` 가 `rotation.y` 를 안 지워 옆을 보고 죽으면 공중제비 대신 옆으로
팽이처럼 돌던 것, 도발이 전부 같은 순간에 나오던 것.

**그 뒤 사용자 신고로 한 번 더 고쳤다 (`dc3219e`).** 다리 스윙에 생속도(`|cos|`)를 곱했는데
`gaitDelta` 도 같은 값에 비례해서, 순찰 끝마다 **폭과 속도가 동시에** 죽었다. 매 주기의
3분의 1 동안 걷기 동작이 사라져 보였다. 지금은 몸 회전이 쓰던 것과 **같은 곡선(`stride`)**
을 다리에도 쓴다 — 곡선이 하나다. `|cos| = 0.5` 에서 보폭이 온전해야 한다는 회귀 방어를
테스트에 박아 뒀다.

### 2. 원숭이 이동 속도 완화 (두 번)

`baseMonkeySpeed` 0.5 → 0.35 → **0.25**, `monkeySpeedIncreasePerRound` 0.08 → 0.05 → **0.035**.
**진폭(오가는 폭)은 안 건드렸다.** 같은 폭을 더 천천히 오간다.

**이 값이 도발 빈도까지 정한다.** 도발은 순찰 끝에서만 나오고 주기가 `2π/(1.8 × 속도)` 라,
0.25면 약 14초 주기에 끝이 7초마다다. 원래 랜덤 도발이 2~4.5초였으니 꽤 드물어졌다.
더 내리면 눈에 띄게 드물어진다 — `config.js` 주석에 적어 뒀다.

### 3. 자루 포대 통로

[설계](2026-07-31-walkway-design.md) · [계획](../plans/2026-07-31-walkway.md)

포대 3장(각 3.16유닛)을 상자 기둥 3개 위에 이어 깐 9.5유닛짜리 통로. 원숭이 둘이
그 위를 순찰하고, **기둥 아무거나 하나 맞으면 통째로 무너지며 둘 다 죽는다.**

**핵심 판단: 새 종류를 만들지 않고 `obstacles.js` 의 `towers` 배열에 세 번째 항목으로
넣었다.** 그래서 `userData.towerIndex` → `getPillarMeshes()` → `collapseStructure()` 경로가
공짜로 붙는다. 통로는 "조각이 더 많고 원숭이 슬롯이 둘인 타워"일 뿐이다.

- 슬롯 모양이 `{ x, y, z, towerIndex, sway: { amplitude, frequencyPerSpeed, phase } }` 가
  됐다. 타워는 `amplitude: 0, frequencyPerSpeed: 1` 이라 예전과 **수치까지 동일**하다
- `towerMonkeyIds` 가 `Map<towerIndex, id[]>` 로 바뀌고 `findMonkeysAtTower` 가 배열을 낸다
- `monkeyAllocation.js` — `allocateMonkeys(monkeyCount, slots)` 가 **레인에 최소 한 마리를
  남긴다.** 슬롯이 넷인데 1라운드 원숭이는 셋이라 필요했다. 2라운드부터 통로가 차기 시작한다
- **포대 원점이 x 한가운데가 아니다** (로컬 x -1.5247 ~ +1.6372, 중심 +0.0562). 간격을
  폭으로 주면 이어 붙는 건 그대로고 통로가 0.056 오른쪽으로 쏠릴 뿐이다. **버그로 보고
  고치려 하지 말 것**

**최종 리뷰가 잡은 것 (고침, `54fa697`):** 통로를 무너뜨려 둘을 죽여도 콤보 효과음이
아니라 단발 효과음이 났다. `finishShot` 이 `isPureTowerHit` 를 `penetrationCount > 1` 보다
먼저 검사했는데, 예전엔 기둥 사격이 둘을 죽일 수 없어 항상 맞던 분기다. 순서를 바꿨다.

### 4. 중화기 상점 그림 — 브라우저 없이 굽는 도구

`tools/bake-weapon-art.mjs` (신규). 모델 삼각형을 **CPU로 래스터라이즈**한다.
`thumb.html` 과 같은 카메라(FOV 35, 회전 Y 35°/X 15°)와 조명을 쓴다. 이 환경에 헤드리스
WebGL(`gl`/`canvas` 패키지)이 없어서 만들었다.

```
node tools/bake-weapon-art.mjs heavy     # 특정 무기
node tools/bake-weapon-art.mjs --all     # 전부 다시
node tools/crop-weapon-art.mjs           # 반드시 그 다음에
```

**두 번 헛디뎠고 그 값이 코드에 상수로 박혀 있다:**
- 무기 FBX 머티리얼이 선형 공간에서 거의 검정(0.002)이다 → `DIFFUSE_EXPOSURE = 1.5`
- 스펙큘러가 **흰색(1,1,1)에 shininess 9.6** 이라 하이라이트가 아주 넓다. three의
  `BRDF_BlinnPhong` 정규화(`0.25/π × (s/2+1)`)와 `N·L` 을 빼먹으면 총이 하얗게 뜬다

기존 그림들의 평균 밝기가 0.196~0.450이고 `heavy.png` 는 0.263으로 맞췄다.

### 5. 깃허브 공개 저장소

`main`(기본) + `dev`(작업). `.gitignore` 가 `node_modules`/`dist`/`.superpowers`/`vendor` 를 뺀다.
`.claude/launch.json` 은 커밋돼 있어서 dev 서버 설정이 따라간다.

**외부 3D 에셋(FBX/GLB)이 공개 저장소에 같이 올라가 있다.** 라이선스 확인은 사용자 몫이라고
알렸다.

## 확정된 설계 결정 (고치지 말 것)

- **초반 라운드 반복 골드 파밍은 열어둔다.** 라운드 선택으로 낮은 라운드를 반복하는 것도 포함.
- **`처음부터`는 최고점수와 마우스 민감도를 남긴다.**
- 장전 슬로모 desync — 그대로 둔다.
- `resetStructure` 가 아직 `group.visible` / `group.rotation.z` 를 만진다. 무해한 잔재.
- **통로는 `towers` 배열에 들어간다.** 별도 `kind` 로 분리하지 말 것.
- **포대 원점의 x 쏠림(+0.0562)은 보정하지 않는다.**
- **순찰 궤적(진폭·주기 공식)은 안 바꾼다.** 난이도 균형이 거기 맞춰져 있다.
  - **2026-08-02 정정: 폐기됨.** 라운드가 올라가도 판이 똑같다는 지적에서 사용자가
    난이도를 다채로움으로 올리기로 정했다. `patrolMotion` 이 곡선 넷을 갖고,
    `steady` 만 이 문장이 지키던 예전 곡선이다(수치까지 동일).
    [설계](2026-08-02-round-progression-design.md) 참고.

## 남은 것

### 사용자 육안 확인 대기 — **이게 지금 가장 먼저다**

이번 세션 작업물이 화면에서 어떤지 **아직 아무것도 확인 못 받았다.** 브라우저가 안 열리는
환경이라 이것만은 사용자가 해야 한다.

- 원숭이가 **가는 방향으로** 도나 (뒤로 걸으면 `patrolMotion.js` 의 `RIGHT_FACING` 부호
  한 줄), 조준(우클릭)했을 때 다리 스윙 폭(`LEG_SWING = 0.35`), 발 미끄러짐
  (`STRIDE_PER_UNIT = 2.4`)
- 속도 0.25가 맞나. 도발이 7초마다인 게 너무 뜸하지 않나
- 통로 위치 `(0, -67)` — 다른 구조물과 겹치거나 시야를 너무 막지 않나
  (`WALKWAY_PLACEMENTS` 한 줄)
- 통로 위 원숭이 둘이 안 떨어지고 자기 반쪽만 걷나 (`WALKWAY_SLOT_OFFSET_X = 2.37`,
  `WALKWAY_SWAY_AMPLITUDE = 1.8`)
- 기둥 쏘면 통로 통째로 무너지고 둘 다 죽나. 조각 9개가 한꺼번에 무너질 때 안 끊기나
- 상점 중화기 그림

확인이 끝나면 `.superpowers/sdd/2026-07-31-monkey-patrol/` 과
`.superpowers/sdd/2026-07-31-walkway/` 를 지운다. (다른 기기에는 애초에 없다.)

### TypeScript 전환 — 스펙·계획서 준비 완료, 실행 전

[설계](2026-07-31-typescript-migration-design.md) · [계획](../plans/2026-07-31-typescript-migration.md)

Verse8 출시에 필요하다. 사용자 확정 사항: **테스트도 TS로, 한 번에 전부,
[TowerWar](https://github.com/Jujeongmin/TowerWar)와 같은 strict.**

**배치는 이미 맞다** — `root: 'game'`, `outDir: '../dist'` 가 Verse8 업로드 규약과 같다.
바꿀 건 언어 하나다.

8개 태스크. 서브에이전트(SDD)로 돌리기로 했다. 계획서에 각 태스크의 파일 목록과 예상되는
타입 오류가 적혀 있다.

**계획서에서 놓치면 안 되는 것 둘:**
1. **Task 1에서 import 확장자를 먼저 다 뗀다.** Vite는 `./foo.js` 를 `foo.ts` 로 다시
   찾아 주는 일을 **importer가 TS일 때만** 한다. 안 그러면 중간 상태마다 dev 서버가 깨진다
2. **`config.ts` 는 지울 수 있는 문법만.** `enum`·`namespace` 금지 —
   `tools/bake-weapon-art.mjs` 가 Node로 직접 import한다

### 알려진 문제 (그대로 남아 있음)

- **속도와 체력에 상한이 없다.** `difficulty.js` 에서 체력이 `1 + floor(n/2)` 로 무한히
  오른다. 원숭이 수만 10에서 멈춘다. 장전 0.8초 때문에 초당 1.25발이 상한이라 어느
  시점에 진행이 막힌다. **사용자가 아직 결정 안 함.**
- **지는 조건이 아예 없다.** 원숭이가 도망가지 않고 플레이어가 죽지 않는다. 판이 끝나는
  유일한 길은 `메뉴로` 다. 스테이지 게임을 더 밀려면 여기가 다음 축이다.
- 타워 발판이 레이캐스트 대상이 아니다. 발판 밴드를 쏘면 `sfx.miss()` 가 난다.
- **바주카의 `findStructuresInBox` 가 구조물 중심점 하나로 판정한다.** 폭 9.5인 통로는
  끝(`|x| > 3.64`)을 조준하면 안 잡힌다. 판정점을 셋으로 늘리면 되지만 미뤘다.
- 기둥을 얇게 해서 발판이 앞뒤로 0.49씩 튀어나온다. 사용자가 "문제없다"고 했다.

### 이연된 마이너

- `progressStore` 의 `Number.parseInt` 가 소수 문자열(`'3.7'`)을 조용히 자른다.
- `test/weapons.test.js` 의 `toHaveProperty` 는 값이 `undefined` 인 키도 통과시킨다.
- `roundSelect` 는 도달 라운드가 500이면 버튼 500개를 그린다. 가상화 없음.
- `game.js` 의 `startGame(round)` 인자가 모듈 변수 `round` 를 가린다.
- `test/monkeyAllocation.test.js` 가 슬롯 **순서** 계약(타워가 먼저)을 검증하지 못한다.
  `obstacles.js` 에 GLTF 하네스가 없어서다.
- `addCratePillar` 의 레벨 수는 `PILLAR_LEVELS` 로 묶였지만, `obstacles.js` 는 여전히
  단위 테스트가 없다.

## 워크플로 메모

- 압축(compaction) 후에는 내 기억보다 `.superpowers/sdd/<plan>/progress.md` 와 `git log` 를
  믿을 것. `complete` 로 적힌 태스크는 절대 재실행하지 말 것.
- **SDD 워크스페이스는 `.superpowers/` 아래이고 gitignore 대상이다.** 다른 기기에는 없다.
- 서브에이전트에 **셸 문법 섞지 말라고 명시할 것.** `git commit -m "제목" -m "본문"` 으로.
- 서브에이전트에 **브라우저를 쓰지 말라고 명시할 것.**
- 큰 리뷰는 sonnet, 최종 whole-branch 리뷰는 opus. 읽을 파일을 명시하고 "git 명령으로
  diff 재유도 금지"를 못박을 것.
- **리뷰어가 좋은 걸 잡아낸다.** 이번 세션 실제 버그: 타워 원숭이 다리 굳음, 죽는 연출의
  회전 상속, 도발 동기화, 통로 붕괴 효과음. 형식적 절차로 취급하지 말 것.
- **계획서가 틀릴 수 있다.** 이번엔 통로 Task 2가 `obstacles.js` 를 건드려야 하는데
  계획서의 `git add` 목록엔 없었다. 서브에이전트가 알아채고 보고했다.
