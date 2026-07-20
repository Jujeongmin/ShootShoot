import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadRifleViewmodel } from './gameplay/rifleViewmodel.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let rifle = null;
loadRifleViewmodel(engine.camera).then((viewmodel) => {
  rifle = viewmodel;
  window.rifle = viewmodel;
});

engine.start((dt) => {
  if (rifle) rifle.update(dt);
});
