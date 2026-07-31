// 브라우저 없이 무기 상점 그림을 굽는다.
//
// 원래 절차는 thumb.html 을 브라우저로 열어 WebGL 로 뽑고 파일을 옮기는 것이었다.
// 이 개발 환경에서는 브라우저 창이 안 열리고 헤드리스 WebGL(gl/canvas 패키지)도 없어서,
// 같은 구도와 조명을 CPU 래스터라이저로 다시 구현한다. 의존성은 three 와 zlib 뿐이다.
//
// 실행:
//   node tools/bake-weapon-art.mjs            그림이 없는 무기만 굽는다
//   node tools/bake-weapon-art.mjs heavy      특정 무기만 굽는다
//   node tools/bake-weapon-art.mjs --all      전부 다시 굽는다
//
// 굽고 나면 반드시 `node tools/crop-weapon-art.mjs` 를 돌린다. 여기서는 thumb.html 과
// 같은 512x512 정사각 캔버스로 내보내므로, 자르지 않으면 상점에서 작게 나온다.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// FBX/GLTF 로더가 텍스처를 물면 DOM 을 찾는다. 이 무기들은 전부 머티리얼 색만 쓰고
// 텍스처가 없으므로, 이미지 로딩이 조용히 no-op 이 되도록 껍데기만 심어 준다.
// tools/measure-monkey.mjs 가 쓰는 것과 같은 수법이다.
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
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { CONFIG } = await import('../game/src/config.js');

const OUT_DIR = 'game/public/images/weapons';
const PUBLIC_DIR = 'game/public';
const SIZE = 512;
// 한 변을 이만큼 키워 그린 뒤 평균내어 줄인다. WebGL 의 MSAA 대신 쓰는 수퍼샘플링이라
// 3이면 픽셀당 9표본이다. 4로 올려도 눈에 띄는 차이가 없고 시간만 두 배가 된다.
const SUPERSAMPLE = 3;

// thumb.html 과 같은 값이다. 여기를 바꾸면 이미 구운 그림과 구도가 어긋난다.
const FOV_DEGREES = 35;
const ROTATION_Y_DEGREES = 35;
const ROTATION_X_DEGREES = 15;
const PADDING_PERCENT = 12;

// thumb.html 의 조명 셋을 그대로 옮긴 것이다. 방향광은 위치에서 원점을 향한다.
const AMBIENT_INTENSITY = 1.6;
const LIGHTS = [
  { position: [3, 5, 4], intensity: 2.2 },
  { position: [-4, 1, -3], intensity: 0.8 },
];

// 이 무기 FBX 들은 머티리얼 색이 거의 검정이다(선형 0.002 수준). 조명을 다 곱해도
// 새까맣게 나오므로 확산광에만 노출을 얹어 실루엣이 보이게 한다. 스펙큘러에는 안
// 먹인다 — 하이라이트까지 밝히면 총이 하얗게 뜬다.
// 값은 기존 그림(저격소총 0.196, 레이건 0.276)과 평균 밝기를 맞춰서 고른 것이다.
const DIFFUSE_EXPOSURE = 1.5;

// three 의 BRDF_BlinnPhong 정규화. pow(N·H, s) 를 그냥 더하면 shininess 가 9.6밖에
// 안 되는 이 모델들에서 하이라이트가 총 전체를 덮어 하얗게 뜬다.
// G_BlinnPhong_Implicit(0.25) × D_BlinnPhong(1/π × (s/2+1) × pow) 를 옮긴 것이다.
const SPECULAR_NORMALISATION = 0.25 / Math.PI;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// 8비트 RGBA(colorType 6) PNG. 필터는 전부 0(None)으로 둔다 — crop-weapon-art.mjs 와 같다.
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function loadModel(weapon) {
  const file = path.join(PUBLIC_DIR, weapon.model);
  const raw = fs.readFileSync(file);
  const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  if (weapon.format === 'fbx') return new FBXLoader().parse(arrayBuffer, '');
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

// 삼각형마다 월드 좌표 세 점, 월드 법선 세 개, 그리고 머티리얼을 들고 있게 만든다.
// 지오메트리의 group 이 어느 구간에 어느 머티리얼을 쓰는지 알려 준다.
function collectTriangles(root) {
  const triangles = [];
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    if (!positions) return;

    const index = geometry.index;
    const count = index ? index.count : positions.count;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);

    // group 이 없으면 전부 0번 머티리얼이다.
    const groups = geometry.groups.length > 0
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }];

    for (const group of groups) {
      const material = materials[group.materialIndex] ?? materials[0];
      const end = Math.min(group.start + group.count, count);
      for (let i = group.start; i + 2 < end; i += 3) {
        const vertices = [];
        const vertexNormals = [];
        let degenerate = false;
        for (let k = 0; k < 3; k += 1) {
          const vertexIndex = index ? index.getX(i + k) : i + k;
          position.fromBufferAttribute(positions, vertexIndex).applyMatrix4(object.matrixWorld);
          vertices.push(position.clone());
          if (normals) {
            normal.fromBufferAttribute(normals, vertexIndex).applyMatrix3(normalMatrix);
            if (normal.lengthSq() === 0) degenerate = true;
            else normal.normalize();
            vertexNormals.push(normal.clone());
          }
        }
        // 법선이 없거나 0인 지오메트리는 면 법선으로 대신한다.
        if (!normals || degenerate) {
          const faceNormal = new THREE.Vector3()
            .subVectors(vertices[1], vertices[0])
            .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0]));
          if (faceNormal.lengthSq() === 0) continue;
          faceNormal.normalize();
          vertexNormals.length = 0;
          vertexNormals.push(faceNormal, faceNormal.clone(), faceNormal.clone());
        }
        triangles.push({ vertices, normals: vertexNormals, material });
      }
    }
  });

  return triangles;
}

function linearToSrgb(value) {
  const v = Math.min(Math.max(value, 0), 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function render(triangles) {
  const width = SIZE * SUPERSAMPLE;
  const height = SIZE * SUPERSAMPLE;

  // 바운딩 박스로 원점에 맞추고 카메라를 반경에 물린다. thumb.html 의 frame() 과 같다.
  const box = new THREE.Box3();
  for (const triangle of triangles) for (const vertex of triangle.vertices) box.expandByPoint(vertex);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const fov = THREE.MathUtils.degToRad(FOV_DEGREES);
  const distance = (radius * (1 + PADDING_PERCENT / 100)) / Math.sin(fov / 2);

  // 피벗 회전. Object3D 의 기본 오일러 순서가 XYZ 라 행렬은 Rx·Ry 다.
  const pivot = new THREE.Matrix4()
    .makeRotationX(THREE.MathUtils.degToRad(ROTATION_X_DEGREES))
    .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(ROTATION_Y_DEGREES)));
  const pivotNormal = new THREE.Matrix3().setFromMatrix4(pivot);

  const cameraPosition = new THREE.Vector3(0, 0, distance);
  const focal = 1 / Math.tan(fov / 2);
  const near = Math.max(distance - radius * 4, 0.01);

  const colour = new Float32Array(width * height * 3);
  const alpha = new Float32Array(width * height);
  const depth = new Float32Array(width * height).fill(Infinity);

  const lights = LIGHTS.map((light) => ({
    direction: new THREE.Vector3(...light.position).normalize(),
    intensity: light.intensity,
  }));

  const view = new THREE.Vector3();
  const shaded = new THREE.Vector3();
  const pixelNormal = new THREE.Vector3();
  const halfway = new THREE.Vector3();

  for (const triangle of triangles) {
    const clip = [];
    let behind = false;
    for (let k = 0; k < 3; k += 1) {
      const p = triangle.vertices[k].clone().sub(centre).applyMatrix4(pivot);
      const viewZ = p.z - distance;
      if (viewZ > -near) { behind = true; break; }
      const w = -viewZ;
      clip.push({
        world: p,
        normal: triangle.normals[k].clone().applyMatrix3(pivotNormal).normalize(),
        x: ((focal * p.x) / w * 0.5 + 0.5) * width,
        y: (1 - ((focal * p.y) / w * 0.5 + 0.5)) * height,
        w,
      });
    }
    if (behind) continue;

    const [a, b, c] = clip;
    const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    if (area === 0) continue;

    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    if (minX > maxX || minY > maxY) continue;

    const material = triangle.material;
    const diffuse = material.color ?? { r: 0.5, g: 0.5, b: 0.5 };
    const specular = material.specular ?? { r: 0.07, g: 0.07, b: 0.07 };
    const shininess = material.shininess ?? 30;

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const sx = px + 0.5;
        const sy = py + 0.5;
        // 무게중심 좌표. 뒷면도 그려야 해서 부호를 면적으로 나눠 정규화한다.
        let w0 = ((b.x - sx) * (c.y - sy) - (c.x - sx) * (b.y - sy)) / area;
        let w1 = ((c.x - sx) * (a.y - sy) - (a.x - sx) * (c.y - sy)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        // 원근 보정: 속성을 w 로 나눠 보간한 뒤 다시 곱한다.
        const inverseW = w0 / a.w + w1 / b.w + w2 / c.w;
        const pixelDepth = 1 / inverseW;
        const offset = py * width + px;
        if (pixelDepth >= depth[offset]) continue;

        pixelNormal.set(
          (w0 * a.normal.x / a.w + w1 * b.normal.x / b.w + w2 * c.normal.x / c.w) / inverseW,
          (w0 * a.normal.y / a.w + w1 * b.normal.y / b.w + w2 * c.normal.y / c.w) / inverseW,
          (w0 * a.normal.z / a.w + w1 * b.normal.z / b.w + w2 * c.normal.z / c.w) / inverseW
        );
        if (pixelNormal.lengthSq() === 0) continue;
        pixelNormal.normalize();

        view.set(
          (w0 * a.world.x / a.w + w1 * b.world.x / b.w + w2 * c.world.x / c.w) / inverseW,
          (w0 * a.world.y / a.w + w1 * b.world.y / b.w + w2 * c.world.y / c.w) / inverseW,
          (w0 * a.world.z / a.w + w1 * b.world.z / b.w + w2 * c.world.z / c.w) / inverseW
        );
        view.subVectors(cameraPosition, view).normalize();
        // 면이 뒤집혀 들어온 모델이 있다. 카메라를 향하도록 법선을 세운다.
        if (pixelNormal.dot(view) < 0) pixelNormal.negate();

        let diffuseTerm = AMBIENT_INTENSITY;
        let specularTerm = 0;
        for (const light of lights) {
          const lambert = pixelNormal.dot(light.direction);
          if (lambert <= 0) continue;
          diffuseTerm += lambert * light.intensity;
          halfway.addVectors(light.direction, view).normalize();
          const highlight = Math.max(pixelNormal.dot(halfway), 0);
          specularTerm += SPECULAR_NORMALISATION * (shininess * 0.5 + 1)
            * Math.pow(highlight, shininess) * lambert * light.intensity;
        }

        shaded.set(
          diffuse.r * diffuseTerm * DIFFUSE_EXPOSURE + specular.r * specularTerm,
          diffuse.g * diffuseTerm * DIFFUSE_EXPOSURE + specular.g * specularTerm,
          diffuse.b * diffuseTerm * DIFFUSE_EXPOSURE + specular.b * specularTerm
        );

        depth[offset] = pixelDepth;
        alpha[offset] = 1;
        colour[offset * 3] = shaded.x;
        colour[offset * 3 + 1] = shaded.y;
        colour[offset * 3 + 2] = shaded.z;
      }
    }
  }

  // 수퍼샘플을 평균낸다. 알파로 가중해야 경계에 검은 테두리가 안 생긴다.
  const out = new Uint8Array(SIZE * SIZE * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0;
      let g = 0;
      let bl = 0;
      let covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const offset = (y * SUPERSAMPLE + sy) * width + (x * SUPERSAMPLE + sx);
          if (alpha[offset] === 0) continue;
          covered += 1;
          r += colour[offset * 3];
          g += colour[offset * 3 + 1];
          bl += colour[offset * 3 + 2];
        }
      }
      const target = (y * SIZE + x) * 4;
      if (covered === 0) continue;
      out[target] = Math.round(linearToSrgb(r / covered) * 255);
      out[target + 1] = Math.round(linearToSrgb(g / covered) * 255);
      out[target + 2] = Math.round(linearToSrgb(bl / covered) * 255);
      out[target + 3] = Math.round((covered / samples) * 255);
    }
  }

  return out;
}

const args = process.argv.slice(2);
const bakeAll = args.includes('--all');
const requested = args.filter((arg) => !arg.startsWith('--'));

const entries = [CONFIG.bazooka.weapon, ...CONFIG.weapons];
const targets = entries.filter((weapon) => {
  if (requested.length > 0) return requested.includes(weapon.id);
  if (bakeAll) return true;
  return !fs.existsSync(path.join(OUT_DIR, `${weapon.id}.png`));
});

if (targets.length === 0) {
  console.log('굽을 무기가 없다. 특정 무기는 id 로, 전부 다시 구우려면 --all 로.');
  process.exit(0);
}

for (const weapon of targets) {
  const model = await loadModel(weapon);
  const triangles = collectTriangles(model);
  if (triangles.length === 0) {
    console.error(`${weapon.id.padEnd(8)} FAILED — ${weapon.model} 에서 삼각형을 못 찾았다`);
    process.exitCode = 1;
    continue;
  }
  const pixels = render(triangles);

  let covered = 0;
  let luminance = 0;
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    if (pixels[i * 4 + 3] <= 16) continue;
    covered += 1;
    luminance += (pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722) / 255;
  }

  const file = path.join(OUT_DIR, `${weapon.id}.png`);
  fs.writeFileSync(file, encodePng(SIZE, SIZE, pixels));
  console.log(
    `${weapon.id.padEnd(8)} ${weapon.model}  삼각형 ${triangles.length}`
    + `  채운 픽셀 ${(covered / (SIZE * SIZE) * 100).toFixed(1)}%`
    + `  평균 밝기 ${(luminance / Math.max(covered, 1)).toFixed(3)}`
    + `  -> ${file}`
  );
}

console.log('다음: node tools/crop-weapon-art.mjs');
