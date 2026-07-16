import * as THREE from 'three';
import { createEngine } from '../core/engine.js';
import { createInputController } from '../core/input.js';
import { createWorld } from './world.js';
import { createTargetManager } from './targetManager.js';
import { resolveShot } from './shooting.js';
import { createScoreState, applyShot } from './scoring.js';
import { sfx, resumeAudio } from '../audio/sfx.js';
import { CONFIG } from '../config.js';

export function createGame(container) {
  const engine = createEngine(container);
  const input = createInputController(engine.domElement);
  createWorld(engine.scene);
  const targetManager = createTargetManager(engine.scene, CONFIG);

  const raycaster = new THREE.Raycaster();
  let scoreState = createScoreState();

  targetManager.spawnRound(1);

  function handleShot(ndcX, ndcY) {
    sfx.shoot();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, engine.camera);
    const intersections = raycaster.intersectObjects(targetManager.getRaycastMeshes(), false);

    const seen = new Set();
    const hits = [];
    for (const intersection of intersections) {
      const { monkeyId, part } = intersection.object.userData;
      if (seen.has(monkeyId)) continue;
      seen.add(monkeyId);
      hits.push({ monkeyId, part });
    }

    const outcome = resolveShot(hits);
    scoreState = applyShot(scoreState, outcome, CONFIG);

    for (const hit of outcome.hits) {
      const monkey = targetManager.findMonkey(hit.monkeyId);
      if (monkey) monkey.hit(hit.part);
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

    console.log('score:', scoreState.score, 'streak:', scoreState.streak, 'misses:', scoreState.misses);
  }

  input.onAimDown(() => resumeAudio());
  input.onAimUp(handleShot);

  function start() {
    engine.start((dt) => {
      targetManager.update(dt);
      engine.setFov(input.isAiming() ? CONFIG.aim.aimFov : CONFIG.aim.normalFov);
    });
  }

  return { start };
}
