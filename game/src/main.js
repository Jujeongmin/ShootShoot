import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createWorld } from './gameplay/world.js';
import { loadMonkeyModel, cloneMonkeyModel } from './gameplay/monkeyModel.js';

const container = document.getElementById('app');
const engine = createEngine(container);
createWorld(engine.scene);

let mixer = null;

loadMonkeyModel().then(({ template, clip }) => {
  const instance = cloneMonkeyModel(template);
  instance.position.z = -4;
  engine.scene.add(instance);

  mixer = new THREE.AnimationMixer(instance);
  if (clip) mixer.clipAction(clip).play();
});

engine.start((dt) => {
  if (mixer) mixer.update(dt);
});
