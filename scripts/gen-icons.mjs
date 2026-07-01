/**
 * Generates simple placeholder PNG icons (a rounded blue square with a lighter
 * "capture frame" in the middle) at the sizes Chrome needs. No image libraries
 * required — we hand-encode a PNG with Node's built-in zlib.
 *
 * Run: npm run icons
 * Replace public/icons/*.png with real artwork before publishing.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const SIZES = [16, 32, 48, 128];

// Palette (RGBA)
const BG = [15, 17, 21, 255]; // page background, transparent-ish frame edges
const BRAND = [91, 140, 255, 255]; // accent blue
const FRAME = [230, 233, 239, 255]; // light capture frame

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const px = (x, y) => {
    const pad = Math.round(size * 0.16);
    const inner = Math.round(size * 0.28);
    const border = Math.max(1, Math.round(size * 0.06));
    // Rounded-ish brand square
    const inSquare = x >= pad && x < size - pad && y >= pad && y < size - pad;
    if (!inSquare) return BG;
    // Capture frame ring
    const fx = x >= inner && x < size - inner;
    const fy = y >= inner && y < size - inner;
    const onRing =
      inSquare &&
      ((fx && (Math.abs(y - inner) < border || Math.abs(y - (size - inner)) < border)) ||
        (fy && (Math.abs(x - inner) < border || Math.abs(x - (size - inner)) < border)));
    return onRing ? FRAME : BRAND;
  };

  // Raw image data: each row prefixed with a filter byte (0 = none).
  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y);
      const o = y * (rowBytes + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, makePng(size));
  console.log(`wrote ${file}`);
}
