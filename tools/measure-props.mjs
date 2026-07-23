// 상자/자루 모델을 게임에서 쓰는 스케일 그대로 재서, 타워를 쌓고 그 위에
// 원숭이를 세울 때 필요한 실제 높이를 뽑는다.
import fs from 'node:fs';

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const CRATE_SCALE = 6;
const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function load(path) {
  const gltf = await new GLTFLoader().parseAsync(toArrayBuffer(fs.readFileSync(path)), '');
  return gltf.scene;
}

function measure(object, scale) {
  const holder = new THREE.Group();
  const clone = object.clone();
  clone.scale.setScalar(scale);
  holder.add(clone);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  return { min: box.min, max: box.max, size: box.getSize(new THREE.Vector3()) };
}

const crate = await load('game/public/models/crate.glb');
const sack = await load('game/public/models/sack-trench.glb');

const c = measure(crate, CRATE_SCALE);
console.log(`crate.glb  (scale ${CRATE_SCALE})`);
console.log(`  y ${c.min.y.toFixed(4)} ~ ${c.max.y.toFixed(4)}  높이 ${c.size.y.toFixed(4)}`);
console.log(`  가로 ${c.size.x.toFixed(4)}  세로(깊이) ${c.size.z.toFixed(4)}`);

const s = measure(sack, SACK_TRENCH_SCALE);
console.log(`sack-trench.glb (scale ${SACK_TRENCH_SCALE})`);
console.log(`  y ${s.min.y.toFixed(4)} ~ ${s.max.y.toFixed(4)}  높이 ${s.size.y.toFixed(4)}`);
console.log(`  가로 ${s.size.x.toFixed(4)}  세로(깊이) ${s.size.z.toFixed(4)}`);

// 눕힌 자루(바닥판)는 x축으로 -90도 회전하므로 두께는 원래 깊이(z)가 된다.
console.log('');
console.log('=== 타워 계산 ===');
const crateHeight = c.size.y;
const crateBottomOffset = c.min.y; // 원점 기준 바닥까지의 거리
console.log(`상자 높이 ${crateHeight.toFixed(4)}, 원점→바닥 ${crateBottomOffset.toFixed(4)}`);
console.log(`현재 코드의 CRATE_UNIT_HEIGHT = 0.9612 (실측 ${crateHeight.toFixed(4)})`);

const laidThickness = s.size.z; // 회전 후 두께
console.log(`눕힌 자루 두께(회전 후) ${laidThickness.toFixed(4)}`);
console.log(`현재 코드의 FLOOR_THICKNESS = 0.8 (실측 ${laidThickness.toFixed(4)})`);

// 상자를 GROUND_Y 기준으로 2단 쌓았을 때 실제 윗면
const level0Top = GROUND_Y - crateBottomOffset + c.max.y;
console.log('');
console.log(`상자를 y=${GROUND_Y}에 놓으면(현재 코드처럼 position.y=GROUND_Y) 상자 윗면 = ${(GROUND_Y + c.max.y).toFixed(4)}`);
console.log(`상자 바닥이 지면에 닿게 하려면 position.y = ${(GROUND_Y - crateBottomOffset).toFixed(4)}`);
