import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start(() => {});
