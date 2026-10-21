// 앱 아이콘 생성: 게임 속 도트 화분(벚꽃)을 그대로 1024×1024 PNG 로 그린다.
// electron-builder 가 이 PNG 에서 macOS(.icns)·Windows(.ico) 아이콘을 자동으로 만든다.
//   node scripts/make-icon.mjs  →  build/icon.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { buildPlantGrid, SPRITE_W, SPRITE_H } from '../src/lib/sprites.js';
import { FLOWER_BY_ID } from '../src/data/flowers.js';

const SIZE = 1024;
const px = Buffer.alloc(SIZE * SIZE * 4);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function fill(x0, y0, w, h, [r, g, b], a = 255) {
  for (let y = Math.max(0, y0); y < Math.min(SIZE, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(SIZE, x0 + w); x++) {
      const i = (y * SIZE + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
}

// 배경: macOS 아이콘 규격(824px 둥근 사각형)을 도트 계단 모서리로
const PAD = 100;
const BOX = SIZE - PAD * 2;
const STEP = 8;
const ROWS = BOX / STEP; // 103줄
const corner = [12, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1]; // 위·아래 끝에서부터 줄마다 깎을 칸 수
for (let row = 0; row < ROWS; row++) {
  const fromEdge = Math.min(row, ROWS - 1 - row);
  const cut = (corner[fromEdge] ?? 0) * STEP;
  const t = row / ROWS;
  const top = hex('#fde9f0');
  const bottom = hex('#e4f3df');
  const color = top.map((c, i) => Math.round(c + (bottom[i] - c) * t));
  fill(PAD + cut, PAD + row * STEP, BOX - cut * 2, STEP, color);
}

// 스프라이트 (벚꽃 만개) — 빈 여백을 잘라내고 아이콘을 꽉 채우게
const grid = buildPlantGrid(FLOWER_BY_ID.cherry, 1);
let [minX, minY, maxX, maxY] = [SPRITE_W, SPRITE_H, 0, 0];
grid.forEach((row, y) =>
  row.forEach((c, x) => {
    if (!c) return;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }),
);
const w = maxX - minX + 1;
const h = maxY - minY + 1;
const scale = Math.floor((BOX * 0.78) / Math.max(w, h));
const ox = Math.round((SIZE - w * scale) / 2);
const oy = Math.round((SIZE - h * scale) / 2);
grid.forEach((row, y) =>
  row.forEach((c, x) => {
    if (c) fill(ox + (x - minX) * scale, oy + (y - minY) * scale, scale, scale, hex(c));
  }),
);

// ── 최소 PNG 인코더 ──
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);

mkdirSync('build', { recursive: true });
writeFileSync(
  'build/icon.png',
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('build/icon.png 생성 완료');
