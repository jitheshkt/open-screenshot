/**
 * Rasterizes icons/icon.svg (the single source of truth) into the PNG sizes
 * Chrome requires. Edit the SVG, then run `npm run icons` to regenerate.
 *
 * Uses @resvg/resvg-js — a self-contained SVG renderer with no system
 * dependencies, so this also runs in CI.
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'icons', 'icon.svg');
const OUT_DIR = join(ROOT, 'icons');
const SIZES = [16, 32, 48, 128];

const svg = readFileSync(SRC, 'utf8');

for (const size of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${size}x${size})`);
}
