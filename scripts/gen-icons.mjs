// Tiny pure-JS icon generator. Produces dark-bg PNGs with a centred green
// dumbbell silhouette. Run once via `node scripts/gen-icons.mjs`.

import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'static/icons');
mkdirSync(outDir, { recursive: true });

const BG = [15, 23, 42];
const FG = [34, 197, 94];

function px(png, x, y, [r, g, b]) {
  const idx = ((png.width * y) + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = 255;
}

function fillRect(png, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x >= 0 && y >= 0 && x < png.width && y < png.height) px(png, x, y, color);
    }
  }
}

function generate(size, filename, opts = { paddedForMaskable: false }) {
  const png = new PNG({ width: size, height: size });
  // Background
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) px(png, x, y, BG);

  // Dumbbell:
  //   - centre bar
  //   - two heavy weights on each side
  // Maskable variant uses a tighter inner safe zone.
  const padPct = opts.paddedForMaskable ? 0.18 : 0.08;
  const pad = Math.round(size * padPct);
  const innerW = size - 2 * pad;
  const innerH = size - 2 * pad;
  const cy = size / 2;

  // Bar
  const barH = Math.round(innerH * 0.16);
  const barX0 = pad + Math.round(innerW * 0.22);
  const barX1 = pad + innerW - Math.round(innerW * 0.22);
  fillRect(png, barX0, Math.round(cy - barH / 2), barX1, Math.round(cy + barH / 2), FG);

  // Weights (left & right)
  const wW = Math.round(innerW * 0.18);
  const wH = Math.round(innerH * 0.55);
  const lx0 = pad;
  const ly0 = Math.round(cy - wH / 2);
  fillRect(png, lx0, ly0, lx0 + wW, ly0 + wH, FG);

  const rx1 = pad + innerW;
  const rx0 = rx1 - wW;
  fillRect(png, rx0, ly0, rx1, ly0 + wH, FG);

  // Inner highlights
  const innerHighlightW = Math.round(wW * 0.35);
  fillRect(png, lx0 + wW + 2, Math.round(cy - barH * 1.2), lx0 + wW + 2 + innerHighlightW, Math.round(cy + barH * 1.2), FG);
  fillRect(png, rx0 - 2 - innerHighlightW, Math.round(cy - barH * 1.2), rx0 - 2, Math.round(cy + barH * 1.2), FG);

  writeFileSync(resolve(outDir, filename), PNG.sync.write(png));
  console.log(`wrote ${filename} (${size}x${size})`);
}

generate(192, 'icon-192.png');
generate(512, 'icon-512.png');
generate(512, 'icon-512-maskable.png', { paddedForMaskable: true });
