import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

// Must match scripts/icons/generate-icons.mjs's own constants.
const GROUND_RGB = { r: 0x10, g: 0x0d, b: 0x26 };
const MOON_RGB = { r: 0xf3, g: 0xdb, b: 0xa9 };
const SAFE_ZONE_RATIO = 0.4;

const ICONS = [
  { name: 'icon-192-maskable.png', size: 192 },
  { name: 'icon-512-maskable.png', size: 512 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

async function pixelAt(png: Buffer, size: number, x: number, y: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(size);
  expect(info.height).toBe(size);
  const i = (Math.floor(y) * info.width + Math.floor(x)) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

describe('AC #2 — maskable app icons', () => {
  for (const icon of ICONS) {
    const path = join(process.cwd(), 'public', 'icons', icon.name);

    it(`${icon.name} exists as a ${icon.size}x${icon.size} PNG`, async () => {
      expect(existsSync(path)).toBe(true);
      const meta = await sharp(path).metadata();
      expect(meta.width).toBe(icon.size);
      expect(meta.height).toBe(icon.size);
      expect(meta.format).toBe('png');
    });

    it(`${icon.name} has the moon colour at its exact centre`, async () => {
      const png = await sharp(path).png().toBuffer();
      const centre = icon.size / 2;
      const px = await pixelAt(png, icon.size, centre, centre);
      expect(px).toEqual(MOON_RGB);
    });

    it(`${icon.name} has the ground colour just outside the 40% maskable safe radius (never clipped by an OS mask)`, async () => {
      const png = await sharp(path).png().toBuffer();
      const centre = icon.size / 2;
      // 10% beyond the safe radius, along an axis — well clear of the circle's anti-aliased edge.
      const x = centre + icon.size * SAFE_ZONE_RATIO * 1.1;
      const px = await pixelAt(png, icon.size, x, centre);
      expect(px).toEqual(GROUND_RGB);
    });
  }
});
