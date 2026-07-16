import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import { createWorld } from './gameplay/world.js';
import { createMonkey } from './gameplay/monkey.js';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);
createWorld(engine.scene);

const monkey = createMonkey({ id: 'preview', position: { x: 0, y: -1, z: -6 }, scale: 1, speed: 0.5 });
engine.scene.add(monkey.group);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  monkey.update(dt);
});
