import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot, calculateShotScore, createHighScoreStore } from './scoring.js';
import { createSettingsStore } from './settingsStore.js';
import { calculateOfflineGold, createLastSeenStore } from './offlineReward.js';
import { createCurrencyStore } from './currencyStore.js';
import { createEffects } from './effects.js';
import { loadMonkeyModel } from './monkeyModel.js';
import { loadRifleViewmodel } from './rifleViewmodel.js';
import { loadObstacles } from './obstacles.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { createHud } from '../ui/hud.js';
import { createScreens } from '../ui/screens.js';
import { createScopeOverlay } from '../ui/scopeOverlay.js';
import { createStageBanner } from '../ui/stageBanner.js';
import { createSettingsPanel } from '../ui/settingsPanel.js';
import { createShopPanel } from '../ui/shopPanel.js';
import { createOfflineRewardPopup } from '../ui/offlineRewardPopup.js';
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
  const highScoreStore = createHighScoreStore(window.localStorage, CONFIG.highScoreStorageKey);
  const settingsStore = createSettingsStore(window.localStorage, CONFIG.settingsStorageKey);
  const currencyStore = createCurrencyStore(window.localStorage, CONFIG.currencyStorageKey);
  const lastSeenStore = createLastSeenStore(window.localStorage, CONFIG.lastSeenStorageKey);
  const raycaster = new THREE.Raycaster();

  let targetManager = null;
  let rifleViewmodel = null;
  let obstacles = null;
  let phase = 'menu';
  let scoreState = createScoreState();
  let round = 1;
  let timeRemaining = 0;
  let ammoRemaining = 0;
  let ammoMax = 0;
  let sensitivity = settingsStore.get().sensitivity;
  let settingsOpen = false;
  let settingsOrigin = null;

  function beginRound(roundNumber) {
    round = roundNumber;
    const roundParams = targetManager.spawnRound(roundNumber);
    timeRemaining = roundParams.timeLimit;
    ammoRemaining = roundParams.ammo;
    ammoMax = roundParams.ammo;
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
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
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
      ammo: Math.max(ammoRemaining, 0),
      ammoMax,
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
      screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
    } else {
      settingsOpen = false;
    }
    settingsOrigin = null;
  }

  function openShopFromMenu() {
    screens.hide();
    shopPanel.show(closeShop);
  }

  function closeShop() {
    shopPanel.hide();
    screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p') return;
    openSettingsFromPlay();
  });

  function handleShot() {
    if (phase !== 'playing' || ammoRemaining <= 0) return;
    ammoRemaining -= 1;
    sfx.shoot();
    rifleViewmodel.triggerRecoil();
    raycaster.setFromCamera({ x: 0, y: 0 }, engine.camera);
    const raycastTargets = [...targetManager.getRaycastMeshes(), ...obstacles.getBlockingMeshes()];
    const intersections = raycaster.intersectObjects(raycastTargets, false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId } = intersection.object.userData;
      if (!monkeyId) break;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      const monkey = targetManager.findMonkey(monkeyId);
      if (!monkey) continue;
      hits.push({ monkeyId, part: monkey.classifyHit(intersection.point) });
    }

    const outcome = resolveShot(hits);
    const gained = calculateShotScore(outcome, scoreState.streak, CONFIG);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    let popupWorldPosition = null;
    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) {
        const worldPos = monkey.getWorldPosition();
        if (!popupWorldPosition) popupWorldPosition = worldPos.clone();
        effects.spawnHitBurst(worldPos);
        monkey.hit(hit.part);
      }
    }

    if (outcome.isMiss) {
      sfx.miss();
    } else if (outcome.penetrationCount > 1) {
      sfx.combo();
    } else if (outcome.hits[0].part === 'head') {
      sfx.headshot();
    } else {
      sfx.hit();
    }

    if (!outcome.isMiss && popupWorldPosition) {
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
      if (targetManager) {
        targetManager.update(dt);
      }
      if (rifleViewmodel) {
        rifleViewmodel.update(dt);
        rifleViewmodel.setVisible(!input.isAiming());
      }
      effects.update(dt);

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
        timeRemaining -= dt;
        if (timeRemaining <= 0) {
          endGame();
        } else {
          updateHud();
          if (targetManager.allCleared()) {
            sfx.roundClear();
            stageBanner.show(round + 1);
            beginRound(round + 1);
            updateHud();
          } else if (ammoRemaining <= 0 && !targetManager.hasDyingMonkeys()) {
            endGame();
          }
        }
      }

      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });

    Promise.all([
      loadMonkeyModel(),
      loadRifleViewmodel(engine.camera),
      loadObstacles(engine.scene),
    ]).then(([monkeyModel, resolvedRifleViewmodel, resolvedObstacles]) => {
      targetManager = createTargetManager(engine.scene, CONFIG, monkeyModel);
      rifleViewmodel = resolvedRifleViewmodel;
      obstacles = resolvedObstacles;

      const now = Date.now();
      const lastSeenAt = lastSeenStore.get();
      lastSeenStore.set(now);
      const offlineGold = lastSeenAt === null ? 0 : calculateOfflineGold(now - lastSeenAt, CONFIG.offlineReward);

      if (offlineGold > 0) {
        screens.hide();
        offlineRewardPopup.show(offlineGold, () => {
          currencyStore.earn(offlineGold);
          screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
        });
      } else {
        screens.showMenu(startGame, openSettingsFromMenu, openShopFromMenu, currencyStore.get());
      }
    });
  }

  return { start };
}
