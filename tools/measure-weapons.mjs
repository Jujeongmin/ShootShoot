// 각 무기 모델의 바운딩박스를 재고, 현재 rifle.glb가 화면에서 차지하는 크기와
// 같아지도록 하는 scale 값을 계산해 출력한다.
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const REFERENCE_SCALE = 0.08; // rifleViewmodel.js가 rifle.glb에 쓰던 값

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadModel(path) {
  const raw = fs.readFileSync(path);
  if (path.endsWith('.glb')) {
    const gltf = await new GLTFLoader().parseAsync(toArrayBuffer(raw), '');
    return gltf.scene;
  }
  const loader = new FBXLoader();
  const isBinary = raw.subarray(0, 18).toString('binary').startsWith('Kaydara FBX Binary');
  return loader.parse(isBinary ? toArrayBuffer(raw) : raw.toString('utf8'), '');
}

function measure(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { size, center, longest: Math.max(size.x, size.y, size.z) };
}

const reference = measure(await loadModel('game/public/models/rifle.glb'));
const targetLength = reference.longest * REFERENCE_SCALE;
console.log(`기준 rifle.glb: 최대변 ${reference.longest.toFixed(4)} × ${REFERENCE_SCALE} = 화면상 ${targetLength.toFixed(4)}`);

for (const file of ['Rifle.fbx', 'Sniper rifle.fbx', 'Ray Gun.fbx', 'Lightning Gun.fbx']) {
  const { size, center, longest } = measure(await loadModel(`game/public/models/${file}`));
  console.log(
    `${file}\n` +
    `  크기 x=${size.x.toFixed(2)} y=${size.y.toFixed(2)} z=${size.z.toFixed(2)} (최대변 ${longest.toFixed(2)})\n` +
    `  중심 x=${center.x.toFixed(2)} y=${center.y.toFixed(2)} z=${center.z.toFixed(2)}\n` +
    `  권장 scale = ${(targetLength / longest).toFixed(5)}`
  );
}
