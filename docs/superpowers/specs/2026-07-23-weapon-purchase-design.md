# 무기 실제 구매 + 원숭이 HP (설계 문서)

- **날짜**: 2026-07-23
- **선행 작업**: [2026-07-21-weapon-shop-design.md](2026-07-21-weapon-shop-design.md)(상점 틀), [2026-07-21-gold-currency-design.md](2026-07-21-gold-currency-design.md)(골드), [2026-07-20-rifle-viewmodel-design.md](2026-07-20-rifle-viewmodel-design.md)(1인칭 뷰모델), [2026-07-22-weapon-purchase-handoff.md](2026-07-22-weapon-purchase-handoff.md)(인계 노트)
- **후속 작업(이번 범위 밖)**: 참고 이미지 기반 메인 메뉴 전면 재배치 — 별도 스펙으로 분리.

## 1. 목표

무기 상점에서 골드로 총을 실제로 구매하고 장착할 수 있게 만든다. 장착한 총은 1인칭 화면에 실제로 반영되고, 총마다 데미지가 다르다.

데미지가 의미를 가지려면 맞는 쪽에 체력이 있어야 하므로, **원숭이에게 HP를 도입한다**. 지금은 머리든 몸통이든 한 발이면 즉사해서 무기 성능을 표현할 방법이 없다. HP는 라운드마다 오르고 상한이 없어, 무기 티어가 "어느 라운드까지 쾌적하게 갈 수 있나"를 결정하는 사다리가 된다.

## 2. 게임플레이 변경

### 2.1 원숭이 HP

`difficulty.js`의 `getRoundParams`가 `monkeyHp`를 함께 반환한다:

```
monkeyHp = 1 + floor((roundNumber - 1) / 2)     // 상한 없음
```

| 라운드 | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 | 11–12 | … |
|---|---|---|---|---|---|---|---|
| 원숭이 HP | 1 | 2 | 3 | 4 | 5 | 6 | … |

상한이 없으므로 HP는 무한히 오르고, 시간 제한(최소 12초)과 원숭이 수(최대 10마리)와 맞물려 런이 자연스럽게 끝난다. 관련 설정은 `CONFIG.round`에 `baseMonkeyHp: 1`, `monkeyHpIncreasePerRounds: 2`로 둔다.

### 2.2 무기 데미지

헤드샷은 데미지 2배(`CONFIG.weaponDamage.headshotMultiplier: 2`), 점수 보너스 +150은 현행 유지.

| 무기 | 데미지 | 가격(골드) | 몸통 원샷킬 유지 | 헤드샷 원샷킬 유지 |
|---|---|---|---|---|
| 기본 소총 | 1 | — (기본 보유) | ~R2 | ~R4 |
| 돌격소총 | 2 | 500 | ~R4 | ~R8 |
| 저격소총 | 3 | 2,000 | ~R6 | ~R12 |
| 레이건 | 5 | 6,000 | ~R10 | ~R20 |

관통은 지금처럼 **무제한이고 감쇠가 없다** — 한 발이 레이 선상 원숭이 전부에게 같은 데미지를 넣는다. 기존 플레이 감각을 유지하기 위해서다.

### 2.3 점수·미스 판정

- 점수는 **처치했을 때만** 지급한다. 공식은 현행 유지(기본 100 + 헤드샷 150 + 관통 콤보 배율 + 스트릭 배율).
- 관통 콤보 배율의 기준이 "한 발이 관통한 마릿수"에서 **"한 발로 죽인 마릿수"**로 바뀐다. 맞았지만 죽지 않은 원숭이는 콤보에 세지 않는다.
- 헤드샷 보너스는 **치명타를 낸 마지막 일격이 헤드샷일 때** 적용한다(그 원숭이를 죽인 탄착 부위 기준).
- 명중했지만 못 죽인 경우 연속 명중(스트릭)은 유지되고 미스로 치지 않는다. 미스 한도 5는 그대로.

### 2.4 피격 연출

- `monkey.js`의 `hit(part)`를 **`damage(amount, part)`**로 바꾼다. HP를 깎고, 0 이하가 됐을 때만 기존 사망 연출(`phase = 'hit'`)로 넘어간다. 반환값으로 처치 여부를 알려준다.
- 죽지 않은 피격: 붉은 플래시(머티리얼 emissive/색 일시 변경) + 짧은 플린치. 지속 시간 0.15초 수준.
- **첫 피격 이후부터** 머리 위에 작은 HP바를 띄운다(`THREE.Sprite` 또는 빌보드 처리한 평면). 라운드마다 HP가 오르므로 "몇 대 더 필요한가"를 보여주는 것이 중요하다.
- `isDying()` / `targetManager.hasDyingMonkeys()` / `hasAliveMonkeys()`의 의미는 바뀌지 않는다(여전히 "사망 연출 중"). 마지막 킬 연출(`lastKillEffect`)과 타워 붕괴 추락사 중복 방지가 이들에 의존하므로 그대로 둔다.

## 3. 무기 데이터

`CONFIG.weapons`를 신설해 4종을 한 곳에서 정의한다:

```js
weapons: [
  { id: 'basic',   name: '기본 소총', model: '/models/rifle.glb',        format: 'glb',
    damage: 1, price: 0,    image: '/images/weapons/basic.png',
    scale: 0.08, position: { x: 0.4, y: -0.3, z: -0.7 } },
  { id: 'assault', name: '돌격소총',   model: '/models/Rifle.fbx',        format: 'fbx',
    damage: 2, price: 500,  image: '/images/weapons/assault.png',
    scale: /* 실측 */, position: /* 실측 */ },
  { id: 'sniper',  name: '저격소총',   model: '/models/Sniper rifle.fbx', format: 'fbx',
    damage: 3, price: 2000, image: '/images/weapons/sniper.png',
    scale: /* 실측 */, position: /* 실측 */ },
  { id: 'raygun',  name: '레이건',     model: '/models/Ray Gun.fbx',      format: 'fbx',
    damage: 5, price: 6000, image: '/images/weapons/raygun.png',
    scale: /* 실측 */, position: /* 실측 */ },
]
```

`scale`/`position`의 구체값은 구현 단계에서 FBX 3종을 실측(바운딩박스·원점·축 방향)한 뒤 채운다 — 현재 `rifleViewmodel.js`에 하드코딩된 `SCALE`/`BASE_POSITION`이 이 자리로 옮겨오는 것이다. 기본 소총 값은 지금 쓰이는 값을 그대로 옮긴다.

## 4. 보유·장착 상태 저장

새 모듈 `game/src/gameplay/weaponStore.js`:

```
createWeaponStore(storage, key) -> {
  getEquipped(),        // 저장값이 없으면 'basic'
  getOwned(),           // 항상 'basic'을 포함
  isOwned(id),
  markOwned(id),
  equip(id),            // 보유하지 않은 무기면 아무것도 하지 않음
}
```

저장 형식은 `CONFIG.weaponStorageKey = 'shootshoot.weapons'` 키에 `{ "owned": ["basic","assault"], "equipped": "assault" }` JSON. 값이 없거나 깨졌으면 기본값(`basic`만 보유·장착)으로 복구한다 — `currencyStore`/`settingsStore`가 이미 쓰는 방어 패턴과 같다.

`currencyStore.js`에 **`spend(amount)`**를 추가한다. 잔액이 부족하면 아무것도 하지 않고 `false`를, 성공하면 `true`를 반환한다. 구매는 `spend()`가 성공했을 때만 `markOwned()`를 부른다.

## 5. 1인칭 모델 교체

`rifleViewmodel.js`를 **`weaponViewmodel.js`**로 일반화한다:

```
loadWeaponViewmodel(camera, weaponConfig) -> Promise<{ setVisible, triggerRecoil, update, dispose }>
```

- `format`에 따라 `GLTFLoader` / `FBXLoader`를 선택하고, `scale`·`position`을 `weaponConfig`에서 받는다. 반동·아이들 스웨이 로직은 현행 그대로.
- **`dispose()`**를 새로 추가한다: `camera.remove(group)` 후 지오메트리·머티리얼 해제. 교체 시 이전 모델이 씬에 남지 않게 한다.
- `game.js`는 장착이 바뀌면 **새 뷰모델을 먼저 로드하고, 성공한 뒤에 기존 것을 `dispose()`** 한다. 로드에 실패하면 기존 무기를 그대로 유지하고 상점 카드에 오류 문구를 띄운다 — 모델 파일 문제로 게임이 죽지 않게 하기 위해서다.
- 부팅 시에는 `weaponStore.getEquipped()`로 얻은 무기를 로드한다.

## 6. 상점 UI (캐러셀)

`shopPanel.js`를 캐러셀 방식으로 재작성한다:

```
createShopPanel(container) -> { show(state, handlers), hide() }
  state    = { gold, weapons: [{ id, name, image, damage, price, owned, equipped }] }
  handlers = { onBuy(id), onEquip(id), onClose() }
```

- 한 번에 카드 한 장을 크게 보여준다: 무기 PNG + 이름 + 데미지 표시(●●●○○) + 액션 버튼.
- ◀ ▶ 버튼으로 무기 사이를 이동하고, 하단에 위치를 점으로 표시한다. 목록 양 끝에서는 해당 화살표를 비활성화한다.
- 카드 상태 4가지:
  - **장착 중** — 버튼 비활성("장착 중")
  - **보유 중** — "장착하기" 버튼
  - **구매 가능** — "🪙 {가격}" 버튼, 한 번 누르면 **확인 단계 없이 즉시 구매**
  - **골드 부족** — 회색 처리, 클릭 불가
- 상단에 골드 잔액을 상시 표시한다.
- 구매·장착 후에는 `game.js`가 상태를 다시 만들어 `show()`를 재호출한다 — 현재 `screens.showMenu(...)`를 매번 다시 부르는 패턴과 같다.
- 무기 PNG는 구현 중에 각 모델을 임시 페이지에서 렌더·캡처해 `game/public/images/weapons/`에 저장한다.

## 7. `game.js` 연결

- `weaponStore` 인스턴스를 만들고, 부팅 시 장착 무기로 뷰모델을 로드한다.
- 사격 처리에서 현재 장착 무기의 `damage`를 읽어 각 피격 원숭이에게 `damage(amount, part)`를 적용하고, 처치된 원숭이 목록으로 점수를 계산한다.
- 라운드 시작 시 `getRoundParams(...).monkeyHp`를 원숭이 생성 인자로 넘긴다.
- `openShopFromMenu`가 `shopPanel.show(state, handlers)`를 부르도록 바꾼다. `onBuy`/`onEquip` 핸들러는 기존 `closeShop` 옆에 같은 패턴으로 추가한다.

## 8. 인터페이스 변경 요약

| 파일 | 변경 |
|---|---|
| `game/src/config.js` | `CONFIG.weapons` 신설, `CONFIG.weaponStorageKey`, `CONFIG.round.baseMonkeyHp`/`monkeyHpIncreasePerRounds`, `CONFIG.weaponDamage.headshotMultiplier` 추가 |
| `game/src/gameplay/weaponStore.js` | **신규** — 보유·장착 상태 저장 |
| `game/src/gameplay/currencyStore.js` | `spend(amount) -> boolean` 추가 |
| `game/src/gameplay/difficulty.js` | `getRoundParams`가 `monkeyHp` 반환 |
| `game/src/gameplay/monkey.js` | `hit(part)` → `damage(amount, part) -> boolean`, HP 상태·플래시·플린치·HP바 추가 |
| `game/src/gameplay/shooting.js` | 부위별 데미지 계산 순수 함수 추가 |
| `game/src/gameplay/scoring.js` | 점수 계산 기준을 "관통 마릿수" → "처치 마릿수"로 변경 |
| `game/src/gameplay/rifleViewmodel.js` | → `weaponViewmodel.js`로 이름·시그니처 변경, `dispose()` 추가, FBX 지원 |
| `game/src/ui/shopPanel.js` | 캐러셀로 재작성, `show(state, handlers)`로 시그니처 변경 |
| `game/src/gameplay/game.js` | `weaponStore` 연결, 데미지 적용, 무기 교체, 상점 핸들러 |
| `game/public/images/weapons/*.png` | **신규 에셋** — 모델 렌더 캡처 4장 |

## 9. 테스트

기존 방식(vitest, 순수 로직 모듈 단위 테스트)을 그대로 따른다:

- `weaponStore.test.js` (신규): 기본값 복구, 보유 누적, 미보유 무기 장착 거부, 깨진 JSON 복구.
- `currencyStore.test.js`: `spend` 성공/실패, 잔액 부족 시 값이 변하지 않음.
- `difficulty.test.js`: 라운드별 `monkeyHp`, 상한이 없음을 높은 라운드에서 확인.
- `shooting.test.js`: 헤드샷 2배 데미지, 몸통 1배.
- `scoring.test.js`: 처치 없는 명중은 0점·스트릭 유지, 한 발 다중 처치의 콤보 배율.

`monkey.js`·`weaponViewmodel.js`·`shopPanel.js`는 THREE/DOM 의존이 커서 기존 관행대로 단위 테스트 대신 브라우저에서 직접 확인한다: 무기 구매 → 장착 → 1인칭 모델이 바뀌는지, 라운드가 올라가며 HP바가 보이는지, 골드 부족 카드가 눌리지 않는지.

## 10. 비목표 (YAGNI)

- 참고 이미지 기반 메인 메뉴 전면 재배치 — 별도 스펙.
- 나머지 FBX 3종(Pistol, LongPistol, Lightning Gun) 판매 — 이번엔 3종만.
- 무기별 재장전 속도·반동 차이·연사 등 데미지 외 스탯.
- 원숭이 종류별 HP 차등(같은 라운드 안에서는 모두 같은 HP).
- 무기 판매·환불, 무기 레벨 업그레이드.
- 플레이 중 무기 교체(메인 메뉴 상점에서만).
- 개발용 골드 치트 — 수동 확인이 필요하면 localStorage 값을 직접 수정한다.

## 11. 열린 위험

- **에셋이 아직 git에 없다.** 새 FBX 7종과 Kenney 아이콘 팩 2개는 메인 작업 디렉터리에만 있고 커밋되지 않아 워크트리에 존재하지 않는다. 구현 계획의 첫 단계에서 필요한 파일(FBX 3종)을 git에 추가해야 한다.
- **FBX 스케일·원점이 미지수다.** 총마다 축 방향과 원점이 달라 1인칭 배치가 어긋날 수 있다. 실측 후 `CONFIG.weapons`에 값을 채우는 단계를 계획에 명시적으로 넣는다.
- **6,000골드는 수동 검증이 오래 걸린다.** 구매·장착 흐름 확인은 localStorage의 골드 값을 직접 올려서 진행한다.
- **HP바가 화면을 어지럽힐 수 있다.** 원숭이가 최대 10마리까지 나오므로, 첫 피격 이후에만 표시하는 규칙으로 개수를 억제한다. 그래도 시끄러우면 크기·투명도를 조정한다.
