// 원숭이 모델이 그룹 원점 기준으로 어디에 놓이는지 재서, 발바닥이 바닥에
// 정확히 닿게 하려면 y를 얼마나 옮겨야 하는지 계산한다.
import fs from 'node:fs';

// 이 FBX는 텍스처를 물고 있어서 로더가 DOM을 찾는다. 지오메트리 치수만 필요하므로
// 이미지 로딩이 조용히 no-op이 되도록 최소한의 껍데기만 심어준다.
const stubElement = () => ({
  style: {},
  setAttribute() {},
  addEventListener() {},
  removeEventListener() {},
  getContext: () => null,
});
globalThis.document = { createElementNS: stubElement, createElement: stubElement };
globalThis.self = globalThis;
globalThis.URL.createObjectURL = () => '';

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const MODEL_PATH = 'game/public/textures/Monkey_animated/monkey.FBX';
const MODEL_SCALE = 0.01;
const RECENTER_OFFSET = { x: 0.0432, y: 0.0053, z: 0.2513 };
const GROUND_Y = -1.0;

const raw = fs.readFileSync(MODEL_PATH);
const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const fbx = new FBXLoader().parse(arrayBuffer, '');
fbx.updateMatrixWorld(true);

console.log('=== FBX 원본 구조 ===');
console.log(`root scale: ${fbx.scale.toArray().map((n) => n.toFixed(5)).join(', ')}`);
fbx.traverse((object) => {
  if (!object.isMesh && !object.isSkinnedMesh) return;
  object.geometry.computeBoundingBox();
  const bb = object.geometry.boundingBox;
  const worldScale = new THREE.Vector3();
  object.getWorldScale(worldScale);
  console.log(
    `  ${object.type} "${object.name}" ` +
    `지오메트리 y ${bb.min.y.toFixed(2)} ~ ${bb.max.y.toFixed(2)} ` +
    `(누적 스케일 ${worldScale.y.toFixed(6)})`
  );
});

// 스킨드 메시는 Box3.setFromObject가 바인드 포즈 지오메트리만 보므로,
// 정점을 직접 월드로 옮겨 실제 도달 범위를 잰다.
function measureSkinnedExtent(root) {
  let min = Infinity;
  let max = -Infinity;
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    const position = object.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      if (object.isSkinnedMesh) {
        object.applyBoneTransform(i, vertex);
      }
      object.localToWorld(vertex);
      min = Math.min(min, vertex.y);
      max = Math.max(max, vertex.y);
    }
  });
  return { min, max };
}

// monkey.js가 만드는 구조를 그대로 재현: group > model(scale 0.01, recenter offset)
const group = new THREE.Group();
fbx.scale.multiplyScalar(MODEL_SCALE);
fbx.position.set(RECENTER_OFFSET.x, RECENTER_OFFSET.y, RECENTER_OFFSET.z);
group.add(fbx);
group.updateMatrixWorld(true);

const extent = measureSkinnedExtent(group);
console.log('');
console.log('=== 게임에서 쓰는 형태 (group > model, scale 0.01) ===');
console.log(`그룹 원점 기준 y 범위: ${extent.min.toFixed(4)} ~ ${extent.max.toFixed(4)} (키 ${(extent.max - extent.min).toFixed(4)})`);
console.log('');
console.log(`현재 group.position.y = ${GROUND_Y} → 발바닥 y = ${(GROUND_Y + extent.min).toFixed(4)}`);
console.log(`바닥(y = ${GROUND_Y})에 딱 붙이려면 group.position.y = ${(GROUND_Y - extent.min).toFixed(4)}`);
console.log(`=> GROUND_Y 대비 보정값: ${(-extent.min).toFixed(4)}`);
