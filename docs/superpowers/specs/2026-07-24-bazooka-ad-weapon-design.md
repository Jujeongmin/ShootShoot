# 광고로 얻는 바주카포 (설계 문서)

- **날짜**: 2026-07-24
- **선행 작업**: [2026-07-23-weapon-purchase-design.md](2026-07-23-weapon-purchase-design.md)(원숭이 HP + 무기 상점), [2026-07-24-damage-offline-upgrades-design.md](2026-07-24-damage-offline-upgrades-design.md)(강화 카드), [2026-07-22-weapon-purchase-handoff.md](2026-07-22-weapon-purchase-handoff.md)(참고 이미지 — 우상단 "무기 쇼케이스 카드" 최초 언급)
- **후속 작업(이번 범위 밖)**: 참고 이미지 기반 메인 메뉴 전면 재배치는 여전히 범위 밖.

## 1. 목표

메인 메뉴 우측 중앙(좌측 상점 아이콘과 대칭)에 카드를 하나 추가한다. 광고를 보면 **바주카포 5발**을 얻고, 즉시 자동 장착된다. 바주카포는 쏘면 명중 지점에서 폭발이 일어나 **반경 안의 원숭이를 HP와 무관하게 전부 즉사**시킨다. 5발을 다 쓰면(명중/빗나감 무관하게 소모) 자동으로 원래 장착하고 있던 무기로 돌아가고, 카드는 다시 "광고 보기" 상태로 바뀐다.

바주카포는 기존 "구매→보유→장착"(`weaponStore`) 구조에 넣지 않는다 — 소모성(탄약 기반)이라 상점의 영구 소유 개념과 맞지 않는다. 완전히 별도의 작은 저장소로 둔다.

## 2. 데이터 모델

### 2.1 저장

새 모듈 `game/src/gameplay/bazookaStore.js` (`currencyStore.js`와 같은 단순한 정수 저장 패턴):

```
createBazookaStore(storage, key) -> {
  getRounds() -> number,       // 저장값 없거나 깨졌으면 0
  refill() -> number,          // rounds = CONFIG.bazooka.maxRounds로 설정, 새 값 반환
  consumeRound() -> number,    // rounds = max(rounds - 1, 0), 새 값 반환
  reset() -> number,           // rounds = 0으로 강제 설정, 새 값(0) 반환 — 모델 로드 실패 롤백 전용
}
```

저장 형식: `CONFIG.bazookaStorageKey = 'shootshoot.bazooka'` 키에 정수 문자열(`currencyStore`와 동일 패턴).

### 2.2 설정

`CONFIG`에 추가:

```js
bazooka: {
  maxRounds: 5,
  blastRadius: 6,
  weapon: {
    id: 'bazooka', name: '바주카포', model: '/models/bazooka.fbx', format: 'fbx',
    scale: 0.001, position: { x: 0.4, y: -0.3, z: -0.7 }, rotation: { x: 0, y: 0, z: 0 },
  },
},
```

`weapon` 서브객체는 `weaponViewmodel.js`의 `loadWeaponViewmodel(camera, weapon)`이 그대로 받을 수 있는 모양(다른 `CONFIG.weapons[]` 항목과 동일 shape)이다. **`model`/`scale`/`position`은 자리표시자다** — 실제 3D 모델 파일은 아직 없고, 사용자가 나중에 `game/public/models/`에 넣어줄 예정이다. 구현 계획의 마지막 태스크에서 실측 후 채운다(기존 무기들과 같은 방식, `tools/measure-weapons.mjs` 재사용 가능).

## 3. 폭발 타격 판정

### 3.1 반경 내 원숭이 조회

`targetManager.js`에 새 함수 추가:

```
findMonkeysWithinRadius(worldPoint, radius) -> Monkey[]
```

살아있는(사망 애니메이션 중이 아닌) 원숭이 중 `getWorldPosition()`이 `worldPoint`로부터 `radius` 이내인 것만 반환한다. 죽어가는 중인(`isDying()`) 원숭이는 제외한다(이미 처치된 원숭이를 중복 처치 처리하지 않기 위해 — 기존 타워 로직과 같은 이유).

### 3.2 즉사 처리

각 대상 원숭이에게 `monkey.kill()`을 호출한다(HP 무시, 이미 `monkey.js`에 존재 — 타워 붕괴가 쓰는 것과 같은 메서드). 헤드샷 판정은 하지 않는다 — 폭발 킬은 전부 `part: 'body'`로 점수 계산에 넘긴다(폭발에 "헤드샷" 개념이 없음).

### 3.3 발사 흐름

1. 기존과 동일하게 크로스헤어에서 레이캐스트(원숭이+장애물+기둥 메시 대상).
2. **가장 먼저 맞은 지점 하나만** 폭발 중심으로 쓴다(기존 무기처럼 여러 마리를 관통하는 개념이 아니다).
3. 아무것도 안 맞았으면(허공/빈 하늘) 미스 처리, 폭발 없음, 탄약은 그래도 1발 소모한다(방아쇠는 당겼으므로).
4. 맞았으면: 그 지점이 **기둥(pillar)** 이면 기존 타워 붕괴 로직을 그대로 재사용(`obstacles.collapseTower`, 타워 원숭이 처치 + 보너스 점수) — 폭발이 구조물을 추가로 부수지는 않는다.
5. 맞은 지점(원숭이든 장애물이든 기둥이든) 을 중심으로 `findMonkeysWithinRadius`를 호출해 반경 안의 살아있는 원숭이를 전부 `kill()` — **타워 위 원숭이도 반경 안에 있으면 폭발로 죽을 수 있다**(구조물은 안 무너지지만 원숭이는 근접 폭발로 죽는 것은 자연스럽다). 4번에서 이미 처치된 타워 원숭이는 3.1의 "죽어가는 중 제외" 규칙으로 중복 처치되지 않는다.
6. 명중/빗나감과 무관하게 `bazookaStore.consumeRound()` 호출. 결과가 0이면 원래 장착 무기로 뷰모델 복귀.
7. 점수 계산은 기존 파이프라인(`calculateShotScore`/`applyShot`)을 그대로 쓴다 — 죽은 원숭이 수가 `penetrationCount`가 되어 기존 다중처치 콤보 배율이 자연스럽게 적용된다(여러 마리를 한 방에 날리면 콤보 보너스가 붙는 게 폭발 무기 컨셉과도 잘 맞는다).

## 4. `game.js` 연결

### 4.1 상태 및 스토어

`bazookaStore` 인스턴스를 만든다. `handleShot()`을 사격 순간 바주카포가 활성 상태인지(`bazookaStore.getRounds() > 0`)로 분기한다.

### 4.2 코드 중복을 피하기 위한 리팩터링

기존 `handleShot()`의 꼬리 부분(점수 반영 이후: 마지막 킬 연출 트리거, 효과음 선택, 점수 팝업 표시, HUD 갱신, 미스 한도 체크)은 두 경로(기존 무기/바주카포)가 동일하게 필요하다. 이 부분을 공용 헬퍼로 뽑는다:

```js
function finishShot({ effectiveOutcome, gained, popupWorldPosition, isPureTowerHit }) {
  if (!effectiveOutcome.isMiss && !targetManager.hasAliveMonkeys()) {
    lastKillEffect.trigger();
  }
  if (isPureTowerHit) {
    sfx.hit();
  } else if (effectiveOutcome.isMiss) {
    sfx.miss();
  } else if (effectiveOutcome.penetrationCount > 1) {
    sfx.combo();
  } else if (effectiveOutcome.hits[0]?.part === 'head') {
    sfx.headshot();
  } else {
    sfx.hit();
  }
  if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
    const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
    hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y);
  }
  updateHud();
  if (scoreState.misses >= CONFIG.missLimit) {
    endGame();
    return;
  }
}
```

기존 `handleShot()`은 `handleWeaponShot()`으로 이름을 바꾸고, 레이캐스트 이후 로직(관통 히트 목록, 데미지 적용, 타워 붕괴, `effectiveOutcome`/`gained`/`scoreState` 계산)은 그대로 유지한 채 마지막에 `finishShot({...})`을 호출하도록 바꾼다. 타워 붕괴로 인한 점수 보너스·팝업(§ 기존 `hitTowerIndex` 블록)은 각 경로가 각자 처리한 뒤(스코어에 이미 반영된 뒤) `finishShot`을 부른다 — 타워 보너스는 무기별 로직이라 공용 헬퍼로 옮기지 않는다.

현재 `handleShot()`의 타워 붕괴 블록(`hitTowerIndex !== null`일 때 `obstacles.collapseTower` + 타워 원숭이 처치 + 보너스 점수 + 팝업)을 그대로 떼어내 양쪽 경로가 공유하는 헬퍼로 만든다:

```js
function applyTowerCollapse(hitTowerIndex) {
  obstacles.collapseTower(hitTowerIndex);
  const towerMonkey = targetManager.findMonkeyAtTower(hitTowerIndex);
  if (towerMonkey && !towerMonkey.isDying()) {
    const worldPos = towerMonkey.getWorldPosition();
    effects.spawnHitBurst(worldPos);
    towerMonkey.kill();
    scoreState = { ...scoreState, score: scoreState.score + CONFIG.score.towerCollapseBonus };
    const screenPos = worldToScreen(worldPos, engine.camera, container);
    hud.showScorePopup(`+${CONFIG.score.towerCollapseBonus}`, screenPos.x, screenPos.y);
  }
}
```

인자 없이 `scoreState`(클로저 변수)를 직접 읽고 쓴다 — 기존 코드가 이미 그렇게 하던 것을 그대로 함수로 뽑은 것뿐이라 동작은 바뀌지 않는다. `handleWeaponShot`은 기존 `if (hitTowerIndex !== null) { ... }` 블록 본문을 이 호출 하나로 교체한다.

새 `handleBazookaShot(intersections)`는:
1. 첫 교차점 판정(§3.3 2~5단계). 맞은 지점이 기둥이면 `applyTowerCollapse(hitTowerIndex)`를 호출한다(§3.3 4단계).
2. `bazookaStore.consumeRound()` 호출, 0이 되면 뷰모델 복귀.
3. `outcome`을 죽인 원숭이 목록으로 구성해 `calculateShotScore`/`applyShot` 호출.
4. `finishShot({...})` 호출.

`handleShot()`은 이제 다음과 같이 얇아진다:

```js
function handleShot() {
  if (phase !== 'playing') return;
  sfx.shoot();
  weaponViewmodel.triggerRecoil();
  raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
  const raycastTargets = [
    ...targetManager.getRaycastMeshes(),
    ...obstacles.getBlockingMeshes(),
    ...obstacles.getPillarMeshes(),
  ];
  const intersections = raycaster.intersectObjects(raycastTargets, false);

  if (bazookaStore.getRounds() > 0) {
    handleBazookaShot(intersections);
  } else {
    handleWeaponShot(intersections);
  }
}
```

### 4.3 획득/자동 장착

```js
function watchAdForBazooka() {
  showRewardedAd().then((success) => {
    if (!success) {
      refreshMenu();
      return;
    }
    bazookaStore.refill();
    swapWeaponViewmodel(CONFIG.bazooka.weapon)
      .catch(() => {
        // 모델 로드 실패 시 탄약을 롤백해서 "장착은 안 됐는데 폭발 로직만 활성"인
        // 불일치 상태를 막는다. 별도 에러 UI는 만들지 않는다(§6 비목표).
        bazookaStore.reset();
      })
      .finally(() => refreshMenu());
  });
}
```

### 4.4 소모 시 자동 복귀

`handleBazookaShot` 안에서 `consumeRound()` 결과가 0이면:

```js
if (bazookaStore.consumeRound() === 0) {
  swapWeaponViewmodel(getEquippedWeapon()).catch(() => {});
}
```

### 4.5 부팅 시 상태 복원

`start()`의 초기 로딩 `.then(...)` 안, 기존 장착 무기 뷰모델을 로드한 **직후**에 추가:

```js
if (bazookaStore.getRounds() > 0) {
  swapWeaponViewmodel(CONFIG.bazooka.weapon).catch(() => {});
}
```

새로고침해도 남은 탄약만큼 바주카포를 계속 들고 있게 된다(다른 저장소들과 동일한 영속성 원칙).

### 4.6 메뉴 상태/핸들러

`buildMenuState()`에 추가:

```js
bazookaRounds: bazookaStore.getRounds(),
```

`menuHandlers`에 추가:

```js
onWatchAdBazooka: watchAdForBazooka,
```

## 5. UI

`screens.js`의 `showMenu`에 우측 중앙 카드를 추가한다 — 좌측 상점 아이콘과 대칭 위치(`position: absolute; right: 20px; top: 50%; transform: translateY(-50%);`).

- **탄약 0일 때**: "📺 바주카포 획득" 버튼(광고 아이콘, `onWatchAdBazooka` 호출). 다른 강화 카드의 "무료강화" 버튼과 같은 스타일(하늘색 outline).
- **탄약 1발 이상일 때**: 클릭 불가, "바주카포 N/5" 텍스트만 표시.

## 6. 비목표 (YAGNI)

- 바주카포를 골드로 직접 구매하는 경로 — 광고로만 얻는다.
- 탄약이 남아있을 때 "미리 더 보기"로 채우는 기능 — 0발일 때만 획득 가능.
- 폭발 전용 파티클/사운드 신규 제작 — 기존 `effects.createEffects().spawnHitBurst(point, color)`를 다른 색(예: 주황 `0xff6600`)으로 재사용한다. 새 SFX 트랙도 만들지 않고 기존 `sfx.hit()`/`sfx.combo()`를 그대로 쓴다.
- 바주카포 모델 로드 실패 시 전용 에러 메시지 UI 카드 — 롤백만 하고 콘솔 로그로 충분(발생 빈도가 낮고, 무기 상점처럼 사용자가 반복 조작할 대상도 아니다).
- 반경 밖 원숭이에게 스플래시 데미지(부분 데미지) 주는 것 — 반경 안은 즉사, 밖은 무영향(이분법).
- 기둥/장애물이 폭발로 부서지는 것 — 기둥은 직접 맞혀야 붕괴(기존과 동일).

## 7. 열린 위험

- **3D 모델이 아직 없다.** `CONFIG.bazooka.weapon.model`은 자리표시자 경로다. 계획의 마지막 태스크는 사용자가 파일을 넣어준 뒤 실측(`tools/measure-weapons.mjs` 패턴)해서 `scale`/`position`을 채우는 단계로 설계한다 — 그 전까지는 모델 로드가 실패하고 뷰모델 교체가 안 될 수 있다(스토어/타겟팅 로직 자체는 모델과 무관하게 테스트 가능).
- **`handleShot()` 리팩터링 범위.** `finishShot`/`applyTowerCollapse` 공용 헬퍼로 뽑는 작업이 기존 동작을 바꾸지 않는지(특히 타워 히트 판정의 `isPureTowerHit` 케이스) 리팩터링 태스크에서 기존 `shooting.test.js`/`scoring.test.js`가 계속 통과하는지로 검증한다.
- **폭발 반경(6)은 추정치.** 원숭이 레인 간격(`laneLayout.js`)과 비교해 튜닝이 필요할 수 있다 — 브라우저에서 실제로 확인해야 하는 값이다.
