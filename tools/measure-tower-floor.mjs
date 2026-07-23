// obstacles.js가 실제로 하는 변환(scale, rotation.x = -90도, position)을 그대로
// 적용해서, 타워 바닥판(sack-trench)의 진짜 월드 바운딩박스와 윗면 y를 잰다.
// FLOOR_THICKNESS(0.7751)가 실측인지 추정인지 확인하기 위함.
import fs from 'node:fs';

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const SACK_TRENCH_SCALE = 1;
const GROUND_Y = -1.0;
const CRATE_ORIGIN_TO_BOTTOM = 0.0119;
const CRATE_UNIT_HEIGHT = 0.9614;
const FLOOR_ROTATION_X = -Math.PI / 2;
const FLOOR_THICKNESS_CONST = 0.7751;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function load(path) {
  const gltf = await new GLTFLoader().parseAsync(toArrayBuffer(fs.readFileSync(path)), '');
  return gltf.scene;
}

const sack = await load('game/public/models/sack-trench.glb');

// 회전 전 원본 크기부터 확인
const rawBox = new THREE.Box3().setFromObject(sack);
console.log('=== 원본 (회전 전) ===');
console.log(`x ${rawBox.min.x.toFixed(4)} ~ ${rawBox.max.x.toFixed(4)} (가로 ${(rawBox.max.x - rawBox.min.x).toFixed(4)})`);
console.log(`y ${rawBox.min.y.toFixed(4)} ~ ${rawBox.max.y.toFixed(4)} (세로 ${(rawBox.max.y - rawBox.min.y).toFixed(4)})`);
console.log(`z ${rawBox.min.z.toFixed(4)} ~ ${rawBox.max.z.toFixed(4)} (깊이 ${(rawBox.max.z - rawBox.min.z).toFixed(4)})`);

// obstacles.js가 실제로 하는 것: pillarTopY 위치에, rotation.x = -90도로 눕힌다.
const pillarTopY = GROUND_Y + CRATE_ORIGIN_TO_BOTTOM + 2 * CRATE_UNIT_HEIGHT;
const floor = sack.clone();
floor.scale.setScalar(SACK_TRENCH_SCALE);
floor.rotation.x = FLOOR_ROTATION_X;
floor.position.set(0, pillarTopY, 0);
floor.updateMatrixWorld(true);

const worldBox = new THREE.Box3().setFromObject(floor);
console.log('');
console.log('=== 게임에서 쓰는 형태 (pillarTopY에 눕힘) ===');
console.log(`pillarTopY(상자 2단 윗면) = ${pillarTopY.toFixed(4)}`);
console.log(`바닥판 y 범위: ${worldBox.min.y.toFixed(4)} ~ ${worldBox.max.y.toFixed(4)}`);
console.log(`바닥판 x 범위: ${worldBox.min.x.toFixed(4)} ~ ${worldBox.max.x.toFixed(4)} (가로 ${(worldBox.max.x - worldBox.min.x).toFixed(4)})`);
console.log(`바닥판 z 범위: ${worldBox.min.z.toFixed(4)} ~ ${worldBox.max.z.toFixed(4)} (깊이 ${(worldBox.max.z - worldBox.min.z).toFixed(4)})`);
console.log('');

const actualBottomOffset = worldBox.min.y - pillarTopY; // 보통 0 근처(상자 윗면에 닿음)
const actualTopOffset = worldBox.max.y - pillarTopY; // 이게 실제 두께
console.log(`floor.position.y 기준 바닥면 오프셋: ${actualBottomOffset.toFixed(4)} (0이면 상자 윗면에 딱 닿음)`);
console.log(`floor.position.y 기준 윗면 오프셋(진짜 두께): ${actualTopOffset.toFixed(4)}`);
console.log(`코드에 쓰인 FLOOR_THICKNESS 상수: ${FLOOR_THICKNESS_CONST}`);
console.log(`몬스터 슬롯 y (pillarTopY + FLOOR_THICKNESS) = ${(pillarTopY + FLOOR_THICKNESS_CONST).toFixed(4)}`);
console.log(`실제 바닥판 윗면 y = ${worldBox.max.y.toFixed(4)}`);
console.log(`차이(양수면 원숭이가 실제 윗면보다 위에 뜸): ${(pillarTopY + FLOOR_THICKNESS_CONST - worldBox.max.y).toFixed(4)}`);
