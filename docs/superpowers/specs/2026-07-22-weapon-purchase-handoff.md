# 무기 상점 실제 구매 기능 — 새 세션 인계 노트

- **날짜**: 2026-07-22
- **상태**: 브레인스토밍 진행 중, 사용자가 다른 세션에서 이어가길 원해서 중단됨. **아직 설계 문서(spec)도, 계획(plan)도 작성되지 않았음** — 이 파일은 그 전 단계 컨텍스트 인계용.
- **선행 작업**: [2026-07-21-weapon-shop-design.md](2026-07-21-weapon-shop-design.md)(상점 틀 — 이미 구현/병합됨), [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md)(골드 시스템)

## 지금까지 있었던 일

1. 기존 "무기 상점" 기능(`game/src/ui/shopPanel.js`)은 이미 구현되어 있음 — "장착 중: 저격총" 카드 1개 + "준비 중" 잠긴 카드 2개만 보여주는 틀뿐이고, 실제 구매/장착 로직은 없음. 원래 설계 문서(`2026-07-21-weapon-shop-design.md`)의 비목표에 "실제 구매 가능한 무기는 새 에셋이 생기면 나중에"라고 명시적으로 미뤄뒀었음.
2. 사용자가 새 무기 3D 모델 7종(FBX)과 CC0 아이콘 팩 2개를 받아서 프로젝트에 넣음(아래 "새로 추가된 에셋" 참고) — 이제 그 "나중"이 된 상황.
3. 브레인스토밍을 시작해서 딱 하나 질문/답변만 진행된 상태에서 사용자가 세션을 새로 옮기고 싶다고 함:
   - **질문**: "새 총을 구매/장착하면 실제로 1인칭 화면의 총 모양이 바뀌어야 할까요?"
   - **답변**: **네, 장착한 총 모델로 교체** — `rifleViewmodel.js`가 동적으로 다른 총 모델로 교체하는 걸 지원하도록 확장해야 함. (이 답변 하나만 확정됐고, 다른 건 전혀 정해지지 않음 — 구매 가능한 총 몇 종/가격/데미지 스탯/UI 레이아웃 전부 미정.)
4. 사용자가 참고 이미지 한 장을 공유하며 "이 화면 구성대로 UI배치해줘"라고 요청함 — 모바일 슈팅 게임(스나이퍼 계열)의 메인 화면 레퍼런스로, 다음 요소들이 보임:
   - 상단: 총알 수 게이지(예: 3/4, 노란 칸으로 채워짐) + 골드 카운터
   - 중앙: "TAP TO PLAY" 텍스트
   - 우상단: 무기 쇼케이스 카드(비디오 아이콘 포함, "광고 보고 무기 획득" 느낌)
   - 좌하단: "STORE" 버튼(장바구니 아이콘)
   - 좌하단/우하단: "DAMAGE"/"OFFLINE" 업그레이드 카드, 각각 레벨 표시 + "FREE"(비디오 아이콘) 버튼
   - **이 요청은 아직 구체화 안 됨** — 어느 요소를 실제로 반영할지(전부? 일부?), 특히 상단 "총알 수 게이지"는 아래 항목 때문에 **그대로 따라가면 안 됨**.
5. 사용자가 명시적으로: **"총알수 기획은 없앨거야 따라서 ui로도 총알수표시안하고 총알수는 무제한이야"** — 이미 이 세션(인계 전)에서 처리 완료됨(아래 참고). **새 세션에서 위 참고 이미지의 UI를 반영할 때, 상단 총알 게이지 부분은 빼거나 다른 용도로 대체해야 한다** — 실수로 총알 수 표시를 되살리지 않도록 주의.

## 이미 완료되고 커밋된 것 (인계 시점 기준)

- **총알 수(ammo) 기능 전체 제거**: `CONFIG.round.ammoMultiplier`/`minAmmo`, `difficulty.js`의 `ammo` 계산, `game.js`의 `ammoRemaining`/`ammoMax` 상태·소모·소진 게임오버 분기, `hud.js`의 "총알: N/M" 표시줄, 관련 테스트 전부 제거. 커밋: `feat: remove ammo count feature, restore unlimited ammo`.
  - **주의**: `targetManager.js`의 `hasDyingMonkeys()`/`hasAliveMonkeys()`와 `monkey.js`의 `isDying()`은 원래 총알 소진 판정을 위해 만들어졌지만, 지금은 **마지막 원숭이 처치 연출**(`lastKillEffect`)과 **구조물 추락사**(타워 붕괴 시 중복 킬 방지)가 이 함수들에 의존하고 있어서 **그대로 남겨둠** — 지우면 안 됨.
  - 빌드/테스트(43/43) 통과, 브라우저에서 HUD에 총알 표시줄이 사라진 것 직접 확인함.

## 새로 추가된 에셋 (이번 기능에 쓸 것)

**3D 무기 모델 (FBX, `game/public/models/`)** — 아직 인스펙션(메쉬/스케일/원점 등 실측)은 안 했음, 다음 세션에서 `rifleViewmodel.js` 패턴처럼 로딩 코드 짜기 전에 먼저 실측 필요(이 세션에서 자주 쓴 방식: Node 스크립트로 GLTFLoader/FBXLoader 직접 돌려서 바운딩박스/스케일 확인):
- `Lightning Gun.fbx`
- `LongPistol.fbx`
- `LongPistol_small.fbx`
- `Pistol.fbx`
- `Ray Gun.fbx`
- `Rifle.fbx`
- `Sniper rifle.fbx`
- (기존에 이미 장착 중인 무기는 이 목록과 별개인 `game/public/models/rifle.glb` — GLB 포맷, `rifleViewmodel.js`가 이미 로딩 중)

**CC0 아이콘 팩 (통째로 들어와 있음, 필요한 것만 골라 쓰면 됨)**
- `game/public/kenney_game-icons/` — `PNG/Black/1x/`, `PNG/White/1x/` 등에 `cart.png`(상점), `gear.png`(설정), `locked.png`/`unlocked.png`(잠금 상태), `video.png`(광고), `star.png`, `trophy.png`, `target.png` 등. 골드/코인 아이콘은 이 팩엔 없음.
- `game/public/kenney_ui-pack/` — `Blue`/`Green`/`Grey`/`Red`/`Yellow` 색상별 `PNG`/`Vector`/`Font`/`Sounds` 서브폴더. 아직 내부 상세 구조는 안 열어봄 — 버튼/패널 이미지, 어쩌면 코인 아이콘이 여기 있을 수도 있음.

## 다음 세션에서 할 일 (제안 순서)

1. `superpowers:brainstorming` 스킬로 이어서 시작 — 이미 확정된 답변(장착 시 1인칭 모델 교체)부터 이어받고, 최소 다음 항목들을 질문해서 확정해야 함:
   - 상점에 몇 종을 팔 것인지(7종 다? 일부만?), 가격, "데미지" 스탯이 실제로 뭘 바꾸는지(원래 상점 설계 문서엔 "점수 배율만, 게임플레이엔 영향 없음"으로 방향 잡혀 있었음 — 이 전제를 유지할지 재확인)
   - 여러 총을 "보유"할 수 있고 그중 하나를 "장착"하는 구조인지, 아니면 사면 바로 장착되는 구조인지
   - 공유된 참고 이미지의 UI 레이아웃을 얼마나 반영할지(전체 재배치 vs 일부 요소만 차용) — 총알 게이지는 빼야 함(위 참고)
   - 아이콘 적용 범위(상점 카드, 메뉴 버튼, 광고 버튼 등 어디까지)
2. 새 총 FBX 7종 실측(Node 스크립트로 바운딩박스/원점/애니메이션 유무 확인) — `rifleViewmodel.js`의 `SCALE`/`BASE_POSITION` 튜닝에 필요.
3. 설계 문서 작성 → `docs/superpowers/specs/`에 저장 → 사용자 검토 → `writing-plans` 스킬로 구현 계획 작성 → `subagent-driven-development`로 실행(이 세션 내내 써온 파이프라인 그대로).

## 참고 — 관련 기존 코드 인터페이스 (설계 시 바로 쓸 수 있게 정리)

- `game/src/gameplay/rifleViewmodel.js`: `loadRifleViewmodel(camera) -> Promise<{ setVisible(visible), triggerRecoil(), update(dt) }>`. 지금은 부팅 시 한 번만 `rifle.glb`를 로드해서 `camera.add(group)`으로 붙임 — 무기 교체를 지원하려면 이 모듈이 "다른 모델로 바꿔 끼우기"를 지원하도록 확장하거나, `game.js`가 새 뷰모델 인스턴스를 다시 만들어 기존 것과 교체하는 방식이 필요함.
- `game/src/ui/shopPanel.js`: `createShopPanel(container) -> { show(onClose), hide() }` — `settingsPanel.js`/`adRewardPanel.js`와 같은 오버레이 패턴. 지금은 하드코딩된 카드 3개만 렌더링.
- `game/src/gameplay/currencyStore.js`: `createCurrencyStore(storage, key) -> { get(), earn(amount) }` — 골드 차감(구매) 기능은 아직 없음, `earn`만 있음. 구매 기능을 만들려면 `spend(amount)` 같은 새 메서드가 필요할 수 있음.
- `game/src/config.js`: 무기 관련 설정(가격, 데미지 배율 등)은 아직 없음 — `CONFIG.weapons` 같은 새 섹션이 필요할 것.
- `game/src/gameplay/game.js`의 `openShopFromMenu`/`closeShop` 패턴이 이미 있으니, 구매/장착 핸들러도 같은 자리에 비슷한 패턴으로 추가하면 됨.

## 세션 전반의 표준 워크플로 (계속 유지)

브레인스토밍(설계) → spec 문서 → writing-plans → 구현 계획 문서 → subagent-driven-development(implementer + reviewer 서브에이전트 페어) 실행. 사용자의 고정 지침: **"애매하거나 질문있으면 혼자 판단하지말고 나한테 물어보고 진행해줘"** — 새 세션에서도 이 원칙 유지.
