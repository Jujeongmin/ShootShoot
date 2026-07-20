import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadMonkeyModel } from './gameplay/monkeyModel.js';
import { createMonkey } from './gameplay/monkey.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let monkey = null;

loadMonkeyModel().then(({ template, clip }) => {
  monkey = createMonkey({
    id: 'preview',
    position: { x: 0, y: -1, z: -6 },
    scale: 1,
    speed: 0.5,
    template,
    clip,
  });
  engine.scene.add(monkey.group);
});

engine.start((dt) => {
  if (monkey) monkey.update(dt);
});
