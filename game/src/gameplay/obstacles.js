import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CRATE_URL = '/models/crate.glb';
const SACK_TRENCH_URL = '/models/sack-trench.glb';
const CRATE_SCALE = 6;
const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;

const PLACEMENTS = [
  { type: 'sackTrench', x: -3, z: -9 },
  { type: 'sackTrench', x: 2.5, z: -10 },
  { type: 'crate', x: 0.5, z: -7.5 },
  { type: 'crate', x: -1.5, z: -8.5 },
];

export function loadObstacles(scene) {
  const loader = new GLTFLoader();
  return Promise.all([loader.loadAsync(CRATE_URL), loader.loadAsync(SACK_TRENCH_URL)]).then(
    ([crateGltf, sackTrenchGltf]) => {
      const blockingMeshes = [];

      for (const placement of PLACEMENTS) {
        const isCrate = placement.type === 'crate';
        const template = isCrate ? crateGltf.scene : sackTrenchGltf.scene;
        const scale = isCrate ? CRATE_SCALE : SACK_TRENCH_SCALE;

        const instance = template.clone();
        instance.scale.setScalar(scale);
        instance.position.set(placement.x, GROUND_Y, placement.z);
        scene.add(instance);

        if (!isCrate) {
          instance.traverse((object) => {
            if (object.isMesh) blockingMeshes.push(object);
          });
        }
      }

      return {
        getBlockingMeshes() {
          return blockingMeshes;
        },
      };
    }
  );
}
