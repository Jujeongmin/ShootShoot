import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';
import { createTargetManager } from './gameplay/targetManager.js';
import { CONFIG } from './config.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

const targetManager = createTargetManager(engine.scene, CONFIG);
targetManager.spawnRound(1);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  targetManager.update(dt);
});
