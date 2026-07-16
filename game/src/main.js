import { createEngine } from './core/engine.js';
import * as THREE from 'three';

const container = document.getElementById('app');
const engine = createEngine(container);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
cube.position.z = -3;
engine.scene.add(cube);

engine.start((dt) => {
  cube.rotation.x += dt;
  cube.rotation.y += dt;
});
