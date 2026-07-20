import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MODEL_URL = '/textures/Monkey_animated/monkey.FBX';
const MODEL_SCALE = 0.01;
const RECENTER_OFFSET = { x: 0.0432, y: 0.0053, z: 0.2513 };

let cachedModelPromise = null;

export function loadMonkeyModel() {
  if (!cachedModelPromise) {
    const loader = new FBXLoader();
    cachedModelPromise = loader.loadAsync(MODEL_URL).then((fbx) => {
      return { template: fbx, clip: fbx.animations[0] };
    });
  }
  return cachedModelPromise;
}

export function cloneMonkeyModel(template) {
  const cloned = cloneSkeleton(template);
  cloned.traverse((child) => {
    if (child.isMesh) {
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone();
    }
  });
  cloned.scale.setScalar(MODEL_SCALE);
  cloned.position.set(RECENTER_OFFSET.x, RECENTER_OFFSET.y, RECENTER_OFFSET.z);
  return cloned;
}
