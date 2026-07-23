import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot, computeHitDamage, resolveKillOutcome } from './shooting.js';
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
import { createSettingsStore } from './settingsStore.js';
import { calculateOfflineGold, createLastSeenStore } from './offlineReward.js';
import { showRewardedAd } from './adSdk.js';
import { createCurrencyStore } from './currencyStore.js';
import { createEffects } from './effects.js';
import { loadMonkeyModel } from './monkeyModel.js';
import { loadWeaponViewmodel } from './weaponViewmodel.js';
import { loadObstacles } from './obstacles.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { createScreens } from '../ui/screens.js';
import { createScopeOverlay } from '../ui/scopeOverlay.js';
import { createStageBanner } from '../ui/stageBanner.js';
import { createSettingsPanel } from '../ui/settingsPanel.js';
import { createShopPanel } from '../ui/shopPanel.js';
import { createOfflineRewardPopup } from '../ui/offlineRewardPopup.js';
import { createAdRewardPanel } from '../ui/adRewardPanel.js';
import { createLastKillEffect } from './lastKillEffect.js';
import { createWeaponStore } from './weaponStore.js';
import { CONFIG } from '../config.js';

function worldToScreen(position, camera, container) {
  const vector = position.clone().project(camera);
  const rect = container.getBoundingClientRect();
  return {
    x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
  };
}

function clampToUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const effects = createEffects(engine.scene);
  const hud = createHud(container);
  const screens = createScreens(container);
  const scopeOverlay = createScopeOverlay(container);
  const stageBanner = createStageBanner(container);
  const settingsPanel = createSettingsPanel(container);
  const shopPanel = createShopPanel(container);
  const offlineRewardPopup = createOfflineRewardPopup(container);
  const adRewardPanel = createAdRewardPanel(container);
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const settingsStore = createSettingsStore(window.localStorage, CONFIG.settingsStorageKey);
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
  const raycaster = new THREE.Raycaster();
  const lastKillEffect = createLastKillEffect();

  let targetManager = null;
  let weaponViewmodel = null;
  let obstacles = null;
  let phase = 'menu';
  let scoreState = createScoreState();
  let round = 1;
  let timeRemaining = 0;
  let sensitivity = settingsStore.get().sensitivity;
  let settingsOpen = false;
  let settingsOrigin = null;

  const weaponStore = createWeaponStore(window.localStorage, CONFIG.weaponStorageKey);
  let shopError = null;

  function getEquippedWeapon() {
    const id = weaponStore.getEquipped();
    return CONFIG.weapons.find((weapon) => weapon.id === id) ?? CONFIG.weapons[0];
  }

  function beginRound(roundNumber) {
    round = roundNumber;
    obstacles.reset();
    const roundParams = targetManager.spawnRound(roundNumber);
    timeRemaining = roundParams.timeLimit;
  }

  function startGame() {
    scoreState = createScoreState();
    phase = 'playing';
    beginRound(1);
    screens.hide();
    updateHud();
  }

  function returnToMenu() {
    phase = 'menu';
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }

  function endGame() {
    phase = 'gameover';
    targetManager.clear();
    const previousHighScore = highScoreStore.get();
    const highScore = highScoreStore.submit(scoreState.score);
    const isNewHighScore = scoreState.score > previousHighScore && scoreState.score > 0;
    const goldEarned = Math.floor(scoreState.score / CONFIG.scorePerGold);
    currencyStore.earn(goldEarned);
    screens.showGameOver({ score: scoreState.score, highScore, isNewHighScore }, returnToMenu);
  }

  function updateHud() {
    hud.render({
      score: scoreState.score,
      streak: scoreState.streak,
      round,
      timeRemaining: Math.max(timeRemaining, 0),
    });
  }

  function handleSensitivityChange(value) {
    sensitivity = value;
    settingsStore.set({ sensitivity });
  }

  function openSettingsFromMenu() {
    settingsOrigin = 'menu';
    screens.hide();
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings);
  }

  function openSettingsFromPlay() {
    if (phase !== 'playing' || settingsOpen) return;
    settingsOrigin = 'playing';
    settingsOpen = true;
    settingsPanel.show(sensitivity, handleSensitivityChange, closeSettings);
  }

  function closeSettings() {
    settingsPanel.hide();
    if (settingsOrigin === 'menu') {
      screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
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

  function buyWeapon(id) {
    shopError = null;
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    if (!weapon || weaponStore.isOwned(id)) return;
    if (!currencyStore.spend(weapon.price)) return;
    weaponStore.markOwned(id);
    refreshShop();
  }

  function equipWeapon(id) {
    shopError = null;
    const weapon = CONFIG.weapons.find((entry) => entry.id === id);
    const previousId = weaponStore.getEquipped();
    if (!weapon || !weaponStore.equip(id)) return;
    refreshShop();
    swapWeaponViewmodel(weapon).catch(() => {
      // 모델 로드가 실패하면 들고 있던 무기를 그대로 유지한다. swapWeaponViewmodel은
      // 성공했을 때만 기존 뷰모델을 교체하므로, 저장값만 되돌리면 화면과 다시 맞는다.
      weaponStore.equip(previousId);
      shopError = '무기를 불러오지 못했습니다';
      refreshShop();
    });
  }

  const shopHandlers = {
    onBuy: buyWeapon,
    onEquip: equipWeapon,
    onClose: () => closeShop(),
  };

  function openShopFromMenu() {
    shopError = null;
    screens.hide();
    refreshShop();
  }

  function swapWeaponViewmodel(weapon) {
    return loadWeaponViewmodel(engine.camera, weapon).then((next) => {
      if (weaponViewmodel) weaponViewmodel.dispose();
      weaponViewmodel = next;
    });
  }

  function closeShop() {
    shopPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }

  function openAdRewardFromMenu() {
    screens.hide();
    adRewardPanel.show(closeAdReward, watchAdForGold);
  }

  function closeAdReward() {
    adRewardPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
  }

  function watchAdForGold() {
    showRewardedAd().then((success) => {
      if (success) {
        currencyStore.earn(CONFIG.adReward.goldAmount);
      }
      closeAdReward();
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p') return;
    openSettingsFromPlay();
  });

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

    const seen = new Set();
    const hits = [];
    let hitTowerIndex = null;
    for (const intersection of intersections) {
      const { monkeyId, towerIndex } = intersection.object.userData;
      if (monkeyId) {
        if (seen.has(monkeyId)) continue;
        seen.add(monkeyId);
        const monkey = targetManager.findMonkey(monkeyId);
        if (!monkey) continue;
        hits.push({ monkeyId, part: monkey.classifyHit(intersection.point) });
        continue;
      }
      if (towerIndex !== undefined) {
        hitTowerIndex = towerIndex;
      }
      break;
    }

    const outcome = resolveShot(hits);
    const weaponDamage = getEquippedWeapon().damage;

    let popupWorldPosition = null;
    const killedHits = [];
    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (!monkey) continue;
      const worldPos = monkey.getWorldPosition();
      if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
      effects.spawnHitBurst(worldPos);
      if (monkey.damage(computeHitDamage(hit.part, weaponDamage, CONFIG), hit.part)) {
        killedHits.push(hit);
      }
    }

    const isPureTowerHit = hits.length === 0 && hitTowerIndex !== null;
    const effectiveOutcome = isPureTowerHit
      ? { isMiss: false, penetrationCount: 0, hits: [] }
      : resolveKillOutcome(outcome, killedHits);
    const gained = calculateShotScore(effectiveOutcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, effectiveOutcome, CONFIG);

    if (hitTowerIndex !== null) {
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

    if (!effectiveOutcome.isMiss && !targetManager.hasAliveMonkeys()) {
      lastKillEffect.trigger();
    }

    if (hitTowerIndex !== null) {
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

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    screens.showLoading('로딩 중...');

    engine.start((dt) => {
      lastKillEffect.update(dt);
      const scaledDt = dt * lastKillEffect.getTimeScale();

      if (targetManager) {
        targetManager.update(scaledDt);
      }
      if (weaponViewmodel) {
        weaponViewmodel.update(scaledDt);
        weaponViewmodel.setVisible(!input.isAiming());
      }
      effects.update(scaledDt);

      if (obstacles) {
        obstacles.update(scaledDt);
      }

      if (input.isAiming()) {
        const ndc = input.getNdc();
        const effectiveX = clampToUnit(ndc.x * sensitivity);
        const effectiveY = clampToUnit(ndc.y * sensitivity);
        engine.camera.rotation.y = -effectiveX * CONFIG.aim.lookLimitX;
        engine.camera.rotation.x = effectiveY * CONFIG.aim.lookLimitY;
        scopeOverlay.show();
      } else {
        engine.camera.rotation.set(0, 0, 0);
        scopeOverlay.hide();
      }

      if (phase === 'playing' && !settingsOpen) {
        timeRemaining -= scaledDt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          }
        }
      }

      const baseFov = input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov;
      engine.setFov(baseFov * (1 - lastKillEffect.getZoomRatio()));
    });

    Promise.all([
      loadMonkeyModel(),
      loadWeaponViewmodel(engine.camera, getEquippedWeapon()),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedWeaponViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel, resolvedObstacles.getTowerSlots());
      weaponViewmodel = resolvedWeaponViewmodel;
      obstacles = resolvedObstacles;

      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, CONFIG.offlineReward);

      if (offlineGold > 0) {
        screens.hide();
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
        });
      } else {
        screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, openAdRewardFromMenu, currencyStore.get());
      }
    });
  }

  return { start };
}
