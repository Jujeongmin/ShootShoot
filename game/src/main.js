import { createEngine } from './core/engine.js';
import { createInputController } from './core/input.js';
import * as THREE from 'three';

const container = document.getElementById('app');
const engine = createEngine(container);
const input = createInputController(engine.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
cube.position.z = -3;
engine.scene.add(cube);

input.onAimDown(() => console.log('aim down'));
input.onAimUp((x, y) => console.log('aim up, released at', x, y));

engine.start((dt) => {
  cube.rotation.x += dt;
  cube.rotation.y += dt;
});
