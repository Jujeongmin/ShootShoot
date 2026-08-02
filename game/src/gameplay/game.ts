import * as THREE from 'three';
import { createEngine } from '../core/engine';
import { createInputController } from '../core/input';
import { createWorld } from './world';
import { createTargetManager } from './targetManager';
import { resolveShot, computeHitDamage, resolveKillOutcome, partitionShotPath } from './shooting';
import { createScoreState, applyShot, calculateShotScore, roundSettlementGold, createHighScoreStore } from './scoring';
import { createReloadState } from './reloadState';
import { createScenery } from './scenery';
import { createSkyDecor } from './skyDecor';
import { createTutorialState } from './tutorialState';
import { createTutorialStore } from './tutorialStore';
import { createProgressStore } from './progressStore';
import { dataKeysToClear, clearGameData } from './gameReset';
import { createSettingsStore } from './settingsStore';
import { calculateOfflineGold, createLastSeenStore } from './offlineReward';
import { showRewardedAd } from './adSdk';
import { createCurrencyStore } from './currencyStore';
import { createUpgradeStore, computeUpgradeCost } from './upgradeStore';
import { createBazookaStore } from './bazookaStore';
import { createEffects } from './effects';
import { loadMonkeyModel } from './monkeyModel';
import { loadWeaponViewmodel } from './weaponViewmodel';
import { loadObstacles } from './obstacles';
import { sfx, resumeAudio } from '../audio/sfx';
import { createHud } from '../ui/hud';
import { scorePopupTone } from '../ui/scorePopupTone';
import { createTutorialPrompt } from '../ui/tutorialPrompt';
import { createScreens } from '../ui/screens';
import { createScopeOverlay } from '../ui/scopeOverlay';
import { createStageBanner } from '../ui/stageBanner';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createConfirmPopup } from '../ui/confirmPopup';
import { createRoundSelect } from '../ui/roundSelect';
import { createShopPanel } from '../ui/shopPanel';
import { createOfflineRewardPopup } from '../ui/offlineRewardPopup';
import { createLastKillEffect } from './lastKillEffect';
import { createWeaponStore } from './weaponStore';
import { computeBlastRadiusPx, findMonkeysInScreenBox, isPointInScreenBox } from './screenTargeting';
import { createBazookaProjectiles } from './bazookaProjectile';
import { CONFIG, type WeaponModel } from '../config';
import type { HitUserData } from './hitUserData';
import type { Monkey } from './monkey';

// 로딩이 끝나야 생기는 세 모듈의 타입. 각 모듈이 실제로 반환하는 모양을 그대로
// 가져다 쓴다 — 손으로 옮겨 적으면 같은 목록이 두 벌이 된다.
type TargetManager = ReturnType<typeof createTargetManager>;
type WeaponViewmodel = Awaited<ReturnType<typeof loadWeaponViewmodel>>;
type Obstacles = Awaited<ReturnType<typeof loadObstacles>>;
type CapturedStructure = ReturnType<Obstacles['findStructuresInBox']>[number];

// finishShot 은 일반 사격과 바주카 두 경로에서 불린다. 두 경로가 만드는 결과의
// 공통분모만 적는다. isNeutral 은 구조물만 부순 발사에서만 붙으므로 선택 필드다.
interface ShotSummary {
  isMiss: boolean;
  isNeutral?: boolean;
  penetrationCount: number;
  hits: { part: string }[];
}

function worldToScreen(position: THREE.Vector3, camera: THREE.Camera, container: HTMLElement) {
  const vector = position.clone().project(camera);
  const rect = container.getBoundingClientRect();
  return {
    x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
  };
}

function clampToUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function createGame(container: HTMLElement) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const skyDecor = createSkyDecor(engine.scene);
  const scenery = createScenery(engine.scene);
  const effects = createEffects(engine.scene);
  const hud = createHud(container);
  const tutorialPrompt = createTutorialPrompt(container);
  const screens = createScreens(container);
  const scopeOverlay = createScopeOverlay(container);
  const stageBanner = createStageBanner(container);
  const settingsPanel = createSettingsPanel(container);
  const confirmPopup = createConfirmPopup(container);
  const roundSelect = createRoundSelect(container);
  const shopPanel = createShopPanel(container);
  const offlineRewardPopup = createOfflineRewardPopup(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const settingsStore = createSettingsStore(window.localStorage, CONFIG.settingsStorageKey);
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const upgradeStore = createUpgradeStore(window.localStorage, CONFIG.upgradeStorageKey);
  const bazookaStore = createBazookaStore(window.localStorage, CONFIG.bazookaStorageKey);
  const tutorialStore = createTutorialStore(window.localStorage, CONFIG.tutorialStorageKey);
  const progressStore = createProgressStore(window.localStorage, CONFIG.progressStorageKey);
  const tutorial = createTutorialState();
  // tutorial 은 페이지 로드마다 한 번 생성되고 항상 'aim' 에서 시작한다.
  // 저장소가 이미 봤다고 기록해뒀다면, 여기서 바로 끝내두지 않으면 이전
  // 세션에서 튜토리얼을 마친 플레이어가 재접속했을 때 처음부터 다시 보게 된다.
  if (tutorialStore.isDone()) tutorial.finish();
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
  const raycaster = new THREE.Raycaster();
  const lastKillEffect = createLastKillEffect();
  const projectiles = createBazookaProjectiles(engine.scene);

  // 이 셋은 아래 start() 의 Promise.all 이 끝나야 채워진다. 그 전에 실행될 수 있는
  // 진입점은 네 개뿐이다 — tick 루프, 조준 down/up, 'p' 키다(모두 start() 호출 전에
  // 등록된다). tick 루프는 이 값들을 쓰는 자리마다 if 로 막고(예: 778행은 그 자체로
  // if 가 없지만 phase === 'playing' 블록 안이라 안전하다), 나머지 셋은
  // handleShot/openSettingsFromPlay 맨 앞의 `if (phase !== 'playing') return`으로
  // 막힌다. phase 는 startGame 에서만 'playing' 이 되고, startGame 은 메뉴·라운드
  // 선택 화면의 버튼에서만 불리는데 그 화면들은 Promise.all 이 끝난 뒤
  // refreshMenu()/openRoundSelect() 로만 뜬다. 그래서 로딩이 끝나기 전에는 어떤
  // 경로로도 여기 non-null 단언이 null 을 만나지 않는다.
  let targetManager: TargetManager | null = null;
  let weaponViewmodel: WeaponViewmodel | null = null;
  let obstacles: Obstacles | null = null;
  let phase: 'menu' | 'playing' | 'gameover' = 'menu';
  let scoreState = createScoreState();
  // 이미 골드로 바꾼 점수. 라운드 정산은 score 와 이 값의 차이만 지급한다.
  let settledScore = 0;
  const reload = createReloadState(CONFIG.reload.seconds);
  // 장전이 끝나는 프레임을 잡으려면 지난 프레임 값이 필요하다. 튜토리얼의
  // reloadFinished 가 이 내림 엣지에서 한 번만 나가야 한다.
  let wasReloading = false;
  let round = 1;
  let sensitivity = settingsStore.get().sensitivity;
  let settingsOpen = false;
  let settingsOrigin: 'menu' | 'playing' | null = null;
  let aimApplied = false;

  const weaponStore = createWeaponStore(window.localStorage, CONFIG.weaponStorageKey);
  let shopError: string | null = null;
  let shopOpen = false;

  function getEquippedWeapon() {
    const id = weaponStore.getEquipped();
    return CONFIG.weapons.find((weapon) => weapon.id === id) ?? CONFIG.weapons[0];
  }

  function getActiveWeaponId() {
    return bazookaStore.getRounds() > 0 ? CONFIG.bazooka.weapon.id : getEquippedWeapon().id;
  }

  function getBlastRadiusPx(rect: DOMRect) {
    return computeBlastRadiusPx(rect.height, CONFIG.bazooka.blastScreenRatio);
  }

  function beginRound(roundNumber: number) {
    round = roundNumber;
    obstacles!.reset();
    targetManager!.spawnRound(roundNumber);
  }

  // 시작 라운드는 부르는 쪽이 정한다 — 이어하기는 도달 라운드를, 라운드 선택은
  // 고른 라운드를, 새 게임은 1을 넘긴다.
  function startGame(round: number) {
    projectiles.clear();
    scoreState = createScoreState();
    settledScore = 0;
    reload.reset();
    if (!tutorialStore.isDone()) tutorial.reset();
    phase = 'playing';
    beginRound(round);
    screens.hide();
    updateHud();
  }

  function returnToMenu() {
    phase = 'menu';
    refreshMenu();
  }

  // 최고점수만 남기고 전부 지운다. 스토어들은 호출할 때마다 localStorage 를 다시
  // 읽지만 장착 무기 모델은 game.ts 가 이미 로드해 들고 있다. 새로고침 한 줄이
  // 무기 재장착·HUD 갱신을 손으로 배선하는 것보다 확실하다.
  function wipeAndRestart() {
    clearGameData(window.localStorage, dataKeysToClear(CONFIG));
    window.location.reload();
  }

  function cancelNewGame() {
    confirmPopup.hide();
    refreshMenu();
  }

  // 되돌릴 수 없으므로 한 번 막는다.
  function askNewGame() {
    screens.hide();
    confirmPopup.show(
      {
        heading: 'Start over',
        message: 'Gold, weapons, upgrades and round progress will all be erased. Your best score and settings stay.',
        confirmLabel: 'Erase and restart',
      },
      wipeAndRestart,
      cancelNewGame
    );
  }

  function openRoundSelect() {
    screens.hide();
    roundSelect.show(progressStore.getReachedRound(), pickRound, closeRoundSelect);
  }

  function pickRound(round: number) {
    roundSelect.hide();
    startGame(round);
  }

  function closeRoundSelect() {
    roundSelect.hide();
    refreshMenu();
  }

  // 판이 끝나는 유일한 길이다. 골드는 라운드 정산에서 이미 줬으므로 여기서는
  // 주지 않는다. 미정산 점수는 그대로 버려진다.
  function exitRun() {
    settingsPanel.hide();
    settingsOpen = false;
    settingsOrigin = null;
    phase = 'gameover';
    targetManager!.clear();
    projectiles.clear();
    const previousHighScore = highScoreStore.get();
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = scoreState.score > previousHighScore && scoreState.score > 0;
    screens.showGameOver({ score: scoreState.score, highScore, isNewHighScore }, returnToMenu);
  }

  // HUD 개편 이후 화면에 남는 건 라운드뿐이다. score·streak 은 여기서 보내도
  // 버려지므로 보내지 않는다 — 정산과 게임오버 화면이 scoreState 를 직접 읽는다.
  function updateHud() {
    hud.render({ round });
  }

  function handleSensitivityChange(value: number) {
    sensitivity = value;
    settingsStore.set({ sensitivity });
  }

  function openSettingsFromMenu() {
    settingsOrigin = 'menu';
    screens.hide();
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings, undefined, replayTutorial);
  }

  function openSettingsFromPlay() {
    if (phase !== 'playing' || settingsOpen) return;
    settingsOrigin = 'playing';
    settingsOpen = true;
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings, exitRun, replayTutorial);
  }

  // 기록을 지우고 단계를 처음으로 돌린다. 플레이 중에 눌렀으면 이 판에서 바로
  // 1단계가 보이고, 메뉴에서 눌렀으면 startGame 이 isDone()을 다시 보므로
  // 다음 판 시작 때 보인다.
  function replayTutorial() {
    tutorialStore.clear();
    tutorial.reset();
    closeSettings();
  }

  function closeSettings() {
    settingsPanel.hide();
    if (settingsOrigin === 'menu') {
      refreshMenu();
    } else {
      settingsOpen = false;
    }
    settingsOrigin = null;
  }

  function buildShopState() {
    const equippedId = weaponStore.getEquipped();
    const owned = weaponStore.getOwned();
    return {
      gold: currencyStore.get(),
      adGoldAmount: CONFIG.adReward.goldAmount,
      error: shopError,
      weapons: CONFIG.weapons.map((weapon) => ({
        id: weapon.id,
        name: weapon.name,
        image: weapon.image,
        damage: weapon.damage,
        price: weapon.price,
        owned: owned.includes(weapon.id),
        equipped: weapon.id === equippedId,
      })),
    };
  }

  function refreshShop() {
    shopPanel.show(buildShopState(), shopHandlers);
  }

  function buyWeapon(id: string) {
    shopError = null;
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    if (!weapon || weaponStore.isOwned(id)) return;
    if (!currencyStore.spend(weapon.price)) return;
    weaponStore.markOwned(id);
    refreshShop();
  }

  function equipWeapon(id: string) {
    shopError = null;
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    const previousId = weaponStore.getEquipped();
    if (!weapon || !weaponStore.equip(id)) return;
    refreshShop();
    swapWeaponViewmodel(weapon).catch(() => {
      // 모델 로드가 실패하면 들고 있던 무기를 그대로 유지한다. swapWeaponViewmodel은
      // 성공했을 때만 기존 뷰모델을 교체하므로, 저장값만 되돌리면 화면과 다시 맞는다.
      weaponStore.equip(previousId);
      shopError = 'Could not load that weapon';
      // 로드가 늦게 실패하면 이미 상점을 닫고 플레이 중일 수 있다. 그때 상점을
      // 다시 띄우면 화면을 덮어써서 조작을 막는다.
      if (shopOpen) refreshShop();
    });
  }

  const shopHandlers = {
    onBuy: buyWeapon,
    onEquip: equipWeapon,
    onWatchAdGold: watchAdForShopGold,
    onClose: () => closeShop(),
  };

  function openShopFromMenu() {
    shopError = null;
    shopOpen = true;
    screens.hide();
    refreshShop();
  }

  function swapWeaponViewmodel(weapon: WeaponModel) {
    return loadWeaponViewmodel(engine.camera, weapon).then((next) => {
      if (weaponViewmodel) weaponViewmodel.dispose();
      weaponViewmodel = next;
      // 바주카 마지막 발을 쏘면 여기가 장전 도중에 불린다. 남은 시간으로 다시
      // 걸지 않으면 새 총이 혼자 멀쩡히 서 있는다.
      if (reload.isReloading()) {
        weaponViewmodel.triggerReload(reload.remaining());
      }
    });
  }

  function closeShop() {
    shopOpen = false;
    shopPanel.hide();
    refreshMenu();
  }

  // 상점에서 골드가 모자랄 때 부르는 유일한 골드 광고다. 성공하든 실패하든
  // 상점을 다시 그려 잔액과 버튼 상태를 맞춘다.
  function watchAdForShopGold() {
    showRewardedAd().then((success) => {
      if (success) {
        currencyStore.earn(CONFIG.adReward.goldAmount);
      }
      refreshShop();
    });
  }

  function buildMenuState() {
    const gold = currencyStore.get();
    const damageLevel = upgradeStore.getDamageLevel();
    const damageCost = computeUpgradeCost(damageLevel, CONFIG.damageUpgrade);
    const offlineLevel = upgradeStore.getOfflineLevel();
    const offlineCost = computeUpgradeCost(offlineLevel, CONFIG.offlineUpgrade);
    return {
      gold,
      damageLevel,
      damageCost,
      canAffordDamage: gold >= damageCost,
      offlineLevel,
      offlineCost,
      canAffordOffline: gold >= offlineCost,
      bazookaRounds: bazookaStore.getRounds(),
      reachedRound: progressStore.getReachedRound(),
    };
  }

  const menuHandlers = {
    // button() 이 핸들러에 MouseEvent 를 넘긴다. 감싸지 않으면 그게 라운드 번호
    // 자리로 들어간다.
    onStart: () => startGame(progressStore.getReachedRound()),
    onContinue: () => startGame(progressStore.getReachedRound()),
    onNewGame: askNewGame,
    onRoundSelect: openRoundSelect,
    onSettings: openSettingsFromMenu,
    onShop: openShopFromMenu,
    onLevelUpDamage: levelUpDamage,
    onWatchAdDamage: watchAdForDamageUpgrade,
    onLevelUpOffline: levelUpOffline,
    onWatchAdOffline: watchAdForOfflineUpgrade,
    onWatchAdBazooka: watchAdForBazooka,
  };

  function refreshMenu() {
    screens.showMenu(buildMenuState(), menuHandlers);
  }

  function levelUpDamage() {
    const cost = computeUpgradeCost(upgradeStore.getDamageLevel(), CONFIG.damageUpgrade);
    if (!currencyStore.spend(cost)) return;
    upgradeStore.levelUpDamage();
    refreshMenu();
  }

  function watchAdForDamageUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpDamage();
      refreshMenu();
    });
  }

  function levelUpOffline() {
    const cost = computeUpgradeCost(upgradeStore.getOfflineLevel(), CONFIG.offlineUpgrade);
    if (!currencyStore.spend(cost)) return;
    upgradeStore.levelUpOffline();
    refreshMenu();
  }

  function watchAdForOfflineUpgrade() {
    showRewardedAd().then((success) => {
      if (success) upgradeStore.levelUpOffline();
      refreshMenu();
    });
  }

  function watchAdForBazooka() {
    showRewardedAd().then((success) => {
      if (!success) {
        refreshMenu();
        return;
      }
      bazookaStore.refill(CONFIG.bazooka.maxRounds);
      swapWeaponViewmodel(CONFIG.bazooka.weapon)
        .catch(() => {
          // 모델 로드 실패 시 탄약을 롤백해서 "장착은 안 됐는데 폭발 로직만 활성"인
          // 불일치 상태를 막는다.
          bazookaStore.reset();
        })
        .finally(() => refreshMenu());
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p') return;
    openSettingsFromPlay();
  });

  // 붕괴로 죽은 원숭이들을 반환한다. 통로처럼 한 구조물에 여럿이 서 있으면 전부 죽는다.
  // 점수는 여기서 더하지 않고 호출부가 일반 사격과 같은 경로(killedHits)로 계산한다 —
  // 구조물 자체는 점수를 주지 않는다.
  function applyTowerCollapse(hitTowerIndex: number, impactPoint?: THREE.Vector3, burstColor?: number) {
    obstacles!.collapseStructure({ kind: 'tower', index: hitTowerIndex, impactPoint });
    const kills = [];
    for (const monkey of targetManager!.findMonkeysAtTower(hitTowerIndex)) {
      if (monkey.isDying()) continue;
      const worldPos = monkey.getWorldPosition();
      if (!monkey.kill()) continue;
      effects.spawnHitBurst(worldPos, burstColor);
      kills.push({ monkeyId: monkey.id, worldPos: worldPos.clone() });
    }
    return kills;
  }

  function finishShot({
    effectiveOutcome,
    gained,
    popupWorldPosition,
    isPureTowerHit,
  }: {
    effectiveOutcome: ShotSummary;
    gained: number;
    popupWorldPosition: THREE.Vector3 | null;
    isPureTowerHit: boolean;
  }) {
    if (!effectiveOutcome.isMiss && !effectiveOutcome.isNeutral && !targetManager!.hasAliveMonkeys()) {
      lastKillEffect.trigger();
    }

    // 통로 기둥 하나가 원숭이 둘을 같이 죽이면 isPureTowerHit이면서 penetrationCount도
    // 2다. 콤보 판정을 기둥 판정보다 먼저 물어야 점수는 더블킬로 매기고 소리는
    // 히트음만 내는 불일치가 안 생긴다.
    if (effectiveOutcome.penetrationCount > 1) {
      sfx.combo();
    } else if (isPureTowerHit) {
      sfx.hit();
    } else if (effectiveOutcome.isMiss) {
      sfx.miss();
    } else if (effectiveOutcome.hits[0]?.part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }

    if (!effectiveOutcome.isMiss && popupWorldPosition && gained > 0) {
      const screenPos = worldToScreen(popupWorldPosition, engine.camera, container);
      hud.showScorePopup(`+${gained}`, screenPos.x, screenPos.y, scorePopupTone(effectiveOutcome));
    }

    updateHud();
  }

  function handleWeaponShot(intersections: THREE.Intersection[]) {
    // 부위 판정에는 교차점이 필요한데 멈춤 규칙은 그걸 안 본다. 규칙은 순수 함수에
    // 맡기고, 여기서는 원숭이마다 가장 가까운 교차점만 따로 챙겨 둔다. 멈추는 지점을
    // 아직 모르니 교차 전체를 훑지만, 아래에서는 partitionShotPath가 돌려준 monkeyIds로만
    // 조회하므로 참호가 멈춘 지점 너머에 담긴 항목은 절대 읽히지 않는다.
    const firstPointByMonkey = new Map<string, THREE.Vector3>();
    const firstPointByTower = new Map<number, THREE.Vector3>();
    const entries = intersections.map((intersection) => {
      // three 의 userData 는 any 라 심는 쪽과 읽는 쪽이 문자열 키로만 통한다.
      // 선언해 둔 모양을 씌워 읽는다.
      const { monkeyId, towerIndex }: HitUserData = intersection.object.userData;
      if (monkeyId && !firstPointByMonkey.has(monkeyId)) {
        firstPointByMonkey.set(monkeyId, intersection.point);
      }
      // towerIndex 는 0 일 수 있으므로 참/거짓으로 보면 첫 타워가 빠진다.
      if (towerIndex !== undefined && !firstPointByTower.has(towerIndex)) {
        firstPointByTower.set(towerIndex, intersection.point);
      }
      return { monkeyId, towerIndex };
    });
    const { monkeyIds, towerIndices } = partitionShotPath(entries);

    const hits = [];
    for (const monkeyId of monkeyIds) {
      const monkey = targetManager!.findMonkey(monkeyId);
      if (!monkey) continue;
      // monkeyIds 는 바로 위 entries 에서 나오고, 그 루프가 monkeyId 가 있는
      // 항목마다 firstPointByMonkey 를 함께 채웠다. 그래서 여기서 비어 있을 수 없다.
      hits.push({ monkeyId, part: monkey.classifyHit(firstPointByMonkey.get(monkeyId)!) });
    }

    const outcome = resolveShot(hits);
    const weaponDamage = getEquippedWeapon().damage + upgradeStore.getDamageLevel() * CONFIG.damageUpgrade.bonusPerLevel;

    // 팝업은 실제로 죽은 원숭이에 붙어야 한다. 직격이 급소를 스치기만 하고 죽이지
    // 못했는데 그 자리를 먼저 차지해버리면, 점수는 타워 붕괴로 죽은 원숭이한테서
    // 나왔으면서 +점수는 살아있는 원숭이 위에 뜬다. 그래서 직격은 실제로 죽였을 때만
    // popupWorldPosition을 차지하고, 죽은 원숭이가 하나도 없을 때만 첫 피격 지점으로
    // 되돌아간다(이 경우는 어차피 점수가 0이라 팝업 자체가 안 뜬다).
    let popupWorldPosition: THREE.Vector3 | null = null;
    let firstDamagedWorldPosition: THREE.Vector3 | null = null;
    const killedHits = [];
    for (const hit of outcome.hits) {
      const monkey = targetManager!.findMonkey(hit.monkeyId);
      if (!monkey) continue;
      const worldPos = monkey.getWorldPosition();
      if (!firstDamagedWorldPosition) firstDamagedWorldPosition = worldPos.clone();
      effects.spawnHitBurst(worldPos);
      const killed = monkey.damage(computeHitDamage(hit.part, weaponDamage, CONFIG), hit.part);
      if (killed) {
        killedHits.push(hit);
        if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
      }
    }

    // 한 발이 앞 타워를 뚫고 뒤 타워까지 닿을 수 있다. 지나간 타워는 전부 무너진다.
    for (const towerIndex of towerIndices) {
      for (const towerKill of applyTowerCollapse(towerIndex, firstPointByTower.get(towerIndex))) {
        killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
        if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
      }
    }

    if (!popupWorldPosition) popupWorldPosition = firstDamagedWorldPosition;

    // 기둥만 맞힌 경우 resolveShot이 isMiss를 주지만 미스가 아니다. 붕괴로 죽은
    // 원숭이가 있으면 그것도 점수에 포함되어야 하므로 결과를 직접 만든다.
    const isPureTowerHit = hits.length === 0 && towerIndices.length > 0;
    const effectiveOutcome = isPureTowerHit
      ? {
          isMiss: false,
          isNeutral: killedHits.length === 0,
          penetrationCount: killedHits.length,
          hits: killedHits,
        }
      : resolveKillOutcome(outcome, killedHits);
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    finishShot({
      effectiveOutcome,
      gained,
      popupWorldPosition,
      isPureTowerHit,
    });
  }

  function resolveBazookaImpact({
    impactPoint,
    captured,
    capturedStructures,
    hitTowerIndex,
  }: {
    impactPoint: THREE.Vector3;
    captured: Monkey[];
    capturedStructures: CapturedStructure[];
    hitTowerIndex: number | null;
  }) {
    effects.spawnExplosion(impactPoint);
    sfx.explosion();

    // 포탄이 날아가는 동안 라운드가 끝났거나 게임오버가 됐으면 연출만 남긴다.
    if (phase !== 'playing') return;

    const killedHits = [];
    let popupWorldPosition: THREE.Vector3 | null = null;

    // 직접 맞힌 타워와 상자 안에 들어온 구조물을 합쳐서 중복 없이 무너뜨린다.
    const structures = [...capturedStructures];
    if (hitTowerIndex !== null && !structures.some((s) => s.kind === 'tower' && s.index === hitTowerIndex)) {
      structures.push({ kind: 'tower', index: hitTowerIndex });
    }

    for (const structure of structures) {
      if (structure.kind === 'tower') {
        for (const towerKill of applyTowerCollapse(structure.index, impactPoint, 0xff6600)) {
          killedHits.push({ monkeyId: towerKill.monkeyId, part: 'body' });
          if (!popupWorldPosition) popupWorldPosition = towerKill.worldPos;
        }
        continue;
      }
      // 폭심에서 밀려나야 한다. structure 는 { kind, index } 뿐이라 명중점을 얹어 넘긴다.
      obstacles!.collapseStructure({ ...structure, impactPoint });
    }

    for (const monkey of captured) {
      if (!monkey.kill()) continue;
      const worldPos = monkey.getWorldPosition();
      if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
      effects.spawnHitBurst(worldPos, 0xff6600);
      killedHits.push({ monkeyId: monkey.id, part: 'body' });
    }

    const killedNothing = killedHits.length === 0;
    const effectiveOutcome = {
      isMiss: killedNothing && structures.length === 0,
      isNeutral: killedNothing && structures.length > 0,
      penetrationCount: killedHits.length,
      hits: killedHits,
    };
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    finishShot({
      effectiveOutcome,
      gained,
      popupWorldPosition,
      isPureTowerHit: killedHits.length === 0 && structures.length > 0,
    });
  }

  function handleBazookaShot(intersections: THREE.Intersection[]) {
    const first: THREE.Intersection | undefined = intersections[0];
    const firstUserData: HitUserData | undefined = first?.object.userData;
    // towerIndex 는 0 일 수 있어서 참/거짓으로 보면 첫 타워가 빠진다.
    const hitTowerIndex = firstUserData?.towerIndex !== undefined ? firstUserData.towerIndex : null;

    // 아무것도 안 맞아도 포탄은 날아간다. 원숭이 대열 부근(maxRange)에서 터진다.
    const impactPoint = first
      ? first.point.clone()
      : raycaster.ray.at(CONFIG.bazooka.maxRange, new THREE.Vector3());

    // 대상은 쏜 순간에 확정한다. 비행 중 조준을 움직여도 결과가 바뀌지 않는다.
    const rect = container.getBoundingClientRect();
    const blastRadiusPx = getBlastRadiusPx(rect);
    const captured = findMonkeysInScreenBox(
      targetManager!.getMonkeys(),
      engine.camera,
      rect,
      blastRadiusPx
    );
    const capturedStructures = obstacles!.findStructuresInBox((point) =>
      isPointInScreenBox(point, engine.camera, rect, blastRadiusPx)
    );

    if (bazookaStore.consumeRound() === 0) {
      swapWeaponViewmodel(getEquippedWeapon()).catch(() => {});
    }

    const muzzle = raycaster.ray.origin
      .clone()
      .addScaledVector(raycaster.ray.direction, 2)
      .add(new THREE.Vector3(0.5, -0.4, 0).applyQuaternion(engine.camera.quaternion));

    projectiles.spawn(muzzle, impactPoint, CONFIG.bazooka.flightSeconds, () => {
      resolveBazookaImpact({ impactPoint, captured, capturedStructures, hitTowerIndex });
    });
  }

  function handleShot() {
    if (phase !== 'playing') return;
    // 누르고 떼는 게 한 프레임 안에 들어가면 조준이 한 번도 적용되지 않는다.
    // 그 상태로 쏘면 카메라가 확대 전 FOV라 판정 범위가 훨씬 넓어지므로 무시한다.
    if (!aimApplied) return;
    sfx.shoot();
    weaponViewmodel!.triggerRecoil();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), engine.camera);
    const raycastTargets = [
      ...targetManager!.getRaycastMeshes(),
      ...obstacles!.getBlockingMeshes(),
      ...obstacles!.getPillarMeshes(),
    ];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

    if (bazookaStore.getRounds() > 0) {
      handleBazookaShot(intersections);
    } else {
      handleWeaponShot(intersections);
    }

    reload.start();
    weaponViewmodel!.triggerReload(CONFIG.reload.seconds);
    tutorial.handle('shotFired');
  }

  input.onAimDown(() => {
    aimApplied = false;
    resumeAudio();
    tutorial.handle('aimStarted');
  });
  input.onAimUp(handleShot);

  function start() {
    screens.showLoading('Loading...');

    engine.start((dt) => {
      lastKillEffect.update(dt);
      reload.tick(dt);
      const reloading = reload.isReloading();
      input.setEnabled(phase === 'playing' && !settingsOpen && !reloading);
      // 안내는 플레이 중에만 띄운다. 설정이 열려 있으면 패널 위로 삐져나오므로 숨긴다.
      hud.setHintVisible(phase === 'playing' && !settingsOpen);
      if (wasReloading && !reloading) {
        tutorial.handle('reloadFinished');
      }
      wasReloading = reloading;
      tutorialPrompt.show(phase === 'playing' && !settingsOpen ? tutorial.current() : 'done');
      const scaledDt = dt * lastKillEffect.getTimeScale();

      // 슬로모가 걸리면 하늘도 같이 느려져야 한다. 배경만 제 속도로 흐르면
      // 마지막 처치 연출이 깨져 보인다.
      skyDecor.update(scaledDt);
      scenery.update(scaledDt);

      if (targetManager) {
        targetManager.update(scaledDt);
      }
      if (weaponViewmodel) {
        weaponViewmodel.update(scaledDt);
        weaponViewmodel.setVisible(!input.isAiming());
      }
      effects.update(scaledDt);
      projectiles.update(scaledDt);

      if (obstacles) {
        obstacles.update(scaledDt);
      }

      if (input.isAiming()) {
        aimApplied = true;
        const ndc = input.getNdc();
        const effectiveX = clampToUnit(ndc.x * sensitivity);
        const effectiveY = clampToUnit(ndc.y * sensitivity);
        engine.camera.rotation.y = -effectiveX * CONFIG.aim.lookLimitX;
        engine.camera.rotation.x = effectiveY * CONFIG.aim.lookLimitY;
        scopeOverlay.show(
          getActiveWeaponId(),
          getBlastRadiusPx(container.getBoundingClientRect())
        );
      } else {
        engine.camera.rotation.set(0, 0, 0);
        scopeOverlay.hide();
      }

      if (phase === 'playing' && !settingsOpen) {
        updateHud();
        if (targetManager!.allCleared() && !projectiles.hasPending()) {
          tutorial.handle('roundCleared');
          if (tutorial.isDone()) tutorialStore.markDone();
          // 골드 정산과 같은 순간에 진행도를 남긴다. 브라우저를 그냥 닫아도
          // 깬 라운드는 남는다.
          progressStore.submitCleared(round);
          // 이 라운드에서 번 만큼만 지급한다. 도중에 나가면 정산을 안 하므로
          // 그 라운드 점수는 그대로 버려진다.
          currencyStore.earn(roundSettlementGold(scoreState.score - settledScore, round, CONFIG));
          settledScore = scoreState.score;
          sfx.roundClear();
          stageBanner.show(round + 1);
          beginRound(round + 1);
          updateHud();
        }
      }

      const baseFov = input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov;
      engine.setFov(baseFov * (1 - lastKillEffect.getZoomRatio()));
    });

    Promise.all([
      loadMonkeyModel(),
      loadWeaponViewmodel(engine.camera, getEquippedWeapon()).catch(() => {
        // 저장된 무기를 못 불러오면 기본 무기로 되돌린다. 여기서 실패를 삼키지
        // 않으면 로딩 화면에서 영영 못 빠져나온다.
        weaponStore.equip(CONFIG.weapons[0].id);
        return loadWeaponViewmodel(engine.camera, CONFIG.weapons[0]);
      }),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedWeaponViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, resolvedObstacles.getTowerSlots());
      weaponViewmodel = resolvedWeaponViewmodel;
      obstacles = resolvedObstacles;

      if (bazookaStore.getRounds() > 0) {
        swapWeaponViewmodel(CONFIG.bazooka.weapon).catch(() => {});
      }

      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGoldConfig = {
        goldPerHour: CONFIG.offlineReward.goldPerHour + upgradeStore.getOfflineLevel() * CONFIG.offlineUpgrade.bonusPerLevel,
        maxHours: CONFIG.offlineReward.maxHours,
      };
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, offlineGoldConfig);

      if (offlineGold > 0) {
        screens.hide();
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          refreshMenu();
        });
      } else {
        refreshMenu();
      }
    });
  }

  return { start };
}
