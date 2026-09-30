// Generates the PWA icons (original artwork: a golden relic coin stamped with a ruin gate)
// as PNGs using only Node built-ins. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const BG_IN = [52, 38, 26];
const BG_OUT = [22, 16, 12];
const GOLD = [242, 193, 78];
const GOLD_DARK = [181, 131, 42];
const GOLD_LIGHT = [255, 231, 154];
const INK = [43, 28, 14];

/** Colour of the icon at normalised (u, v) in [-1, 1]; `scale` shrinks the coin (maskable). */
function shade(u, v, scale) {
  const r = Math.hypot(u, v);
  let c = mix(BG_IN, BG_OUT, Math.min(1, r / 1.2));
  const cr = 0.78 * scale;
  if (r < cr) {
    // Coin body with a light rim and a subtle top-left highlight.
    const t = r / cr;
    c = t > 0.88 ? GOLD_DARK : mix(GOLD_LIGHT, GOLD, Math.min(1, (u + v + 1.2) / 2.4));
    if (t > 0.8 && t < 0.86) c = GOLD_LIGHT;
    // Ruin gate: two pillars and a lintel with a dark doorway.
    const x = u / scale;
    const y = v / scale;
    const inPillar = Math.abs(Math.abs(x) - 0.3) < 0.1 && y > -0.28 && y < 0.42;
    const inLintel = Math.abs(x) < 0.48 && y > -0.42 && y < -0.28;
    const inCap = Math.abs(x) < 0.3 && y > -0.52 && y < -0.42;
    const inStep = Math.abs(x) < 0.52 && y > 0.42 && y < 0.5;
    if (inPillar || inLintel || inCap || inStep) c = INK;
  }
  return c;
}

function render(size, scale, round) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0];
      let alpha = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((px + (sx + 0.5) / ss) / size) * 2 - 1;
          const v = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
          if (round && Math.hypot(u, v) > 1) continue;
          const c = shade(u, v, scale);
          acc = acc.map((a, i) => a + c[i]);
          alpha++;
        }
      }
      const i = (py * size + px) * 4;
      const n = Math.max(1, alpha);
      buf[i] = Math.round(acc[0] / n);
      buf[i + 1] = Math.round(acc[1] / n);
      buf[i + 2] = Math.round(acc[2] / n);
      buf[i + 3] = Math.round((alpha / (ss * ss)) * 255);
    }
  }
  return png(size, buf);
}

const icons = [
  ['icon-192.png', 192, 1, false],
  ['icon-512.png', 512, 1, false],
  ['icon-maskable-512.png', 512, 0.72, false],
  ['apple-touch-icon.png', 180, 0.9, false],
  ['favicon-32.png', 32, 1.15, true],
];
for (const [name, size, scale, round] of icons) {
  writeFileSync(new URL(name, OUT), render(size, scale, round));
  console.info(`wrote public/icons/${name}`);
}
