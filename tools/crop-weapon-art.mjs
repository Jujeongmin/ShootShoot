// 무기 그림을 알파 경계에 맞춰 잘라낸다.
//
// 렌더러가 512x512 정사각 캔버스로 뽑아 주는 탓에, 물체가 차지하는 영역이
// 세로의 20~68%밖에 안 된다. object-fit: contain 은 정사각형 기준으로 맞추므로
// 총이 실제보다 훨씬 작게 나오고, 그걸 CSS 배율로 우회하면 그림이 바뀔 때마다
// 숫자를 다시 재야 한다. 여백을 파일에서 없애면 그 문제가 사라진다.
//
// 실행: node tools/crop-weapon-art.mjs [--dry]
// 의존성 없이 zlib 만 쓴다. 8비트 RGBA(colorType 6) PNG 만 다룬다.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIR = 'game/public/images/weapons';
const ALPHA_THRESHOLD = 16; // 이 값 이하는 여백으로 본다
const DRY_RUN = process.argv.includes('--dry');

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

function decode(file) {
  const buffer = fs.readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      depth = buffer[offset + 16];
      colorType = buffer[offset + 17];
      if (buffer[offset + 20] !== 0) throw new Error(`${file}: interlaced PNG is not supported`);
    } else if (type === 'IDAT') {
      idat.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (colorType !== 6 || depth !== 8) {
    throw new Error(`${file}: expected 8-bit RGBA, got colorType ${colorType} depth ${depth}`);
  }

  const bpp = 4;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);

  // 스캔라인 필터를 되돌린다 (PNG 사양 9.2).
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? pixels[y * stride + i - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= bpp ? pixels[(y - 1) * stride + i - bpp] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[y * stride + i] = value & 0xff;
    }
  }

  return { width, height, stride, pixels };
}

function alphaBounds(image) {
  const { width, height, stride, pixels } = image;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * stride + x * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encode(image, bounds) {
  const { stride, pixels } = image;
  const outStride = bounds.width * 4;
  // 필터는 전부 0(None)으로 둔다. 어차피 zlib 이 압축하고, 5개짜리 일회성 작업에
  // 필터 탐색을 붙일 이유가 없다.
  const raw = Buffer.alloc(bounds.height * (outStride + 1));
  for (let y = 0; y < bounds.height; y += 1) {
    raw[y * (outStride + 1)] = 0;
    pixels.copy(
      raw,
      y * (outStride + 1) + 1,
      (bounds.y0 + y) * stride + bounds.x0 * 4,
      (bounds.y0 + y) * stride + (bounds.x0 + bounds.width) * 4
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bounds.width, 0);
  ihdr.writeUInt32BE(bounds.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.png')).sort();
let failed = false;

for (const name of files) {
  const file = path.join(DIR, name);
  try {
    const image = decode(file);
    const bounds = alphaBounds(image);
    if (!bounds) {
      console.log(`${name.padEnd(14)} SKIP — fully transparent`);
      continue;
    }
    if (bounds.width === image.width && bounds.height === image.height) {
      console.log(`${name.padEnd(14)} SKIP — already tight`);
      continue;
    }

    const before = fs.statSync(file).size;
    const out = encode(image, bounds);

    // 쓴 뒤 다시 읽어 크기가 맞는지 확인한다.
    if (!DRY_RUN) {
      fs.writeFileSync(file, out);
      const round = decode(file);
      const roundBounds = alphaBounds(round);
      if (round.width !== bounds.width || round.height !== bounds.height
          || roundBounds.width !== bounds.width || roundBounds.height !== bounds.height) {
        throw new Error('re-read does not match the crop that was written');
      }
    }

    const after = DRY_RUN ? out.length : fs.statSync(file).size;
    console.log(
      `${name.padEnd(14)} ${image.width}x${image.height} -> ${bounds.width}x${bounds.height}`
      + `   ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
      + (DRY_RUN ? '   (dry run, not written)' : '')
    );
  } catch (error) {
    failed = true;
    console.error(`${name.padEnd(14)} FAILED — ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
