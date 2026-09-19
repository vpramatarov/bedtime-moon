// Flat maskable app icon: a --ground square with a --moon circle centred inside the standard
// maskable safe zone (a circle of radius 40% of the icon size — PRD-0001 RES-0001 finding 76).
// No external asset, no network. Hex values are a one-time computation of tokens.css's
// --ground (oklch(18% 0.05 285)) and --moon (oklch(90% 0.07 85)) via src/design/oklch.ts's own
// conversion math -- keep both in sync if the palette ever changes.
//
// Usage: npm run icons

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const GROUND_HEX = '#100d26';
const MOON_HEX = '#f3dba9';
const SAFE_ZONE_RATIO = 0.4;

const ICONS = [
  { name: 'icon-192-maskable.png', size: 192 },
  { name: 'icon-512-maskable.png', size: 512 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

function buildIconSvg(size) {
  const c = size / 2;
  const r = size * SAFE_ZONE_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${GROUND_HEX}"/><circle cx="${c}" cy="${c}" r="${r}" fill="${MOON_HEX}"/></svg>`;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });
for (const icon of ICONS) {
  await sharp(Buffer.from(buildIconSvg(icon.size)))
    .png()
    .toFile(join(outDir, icon.name));
  console.log(`wrote ${icon.name} (${icon.size}x${icon.size})`);
}
