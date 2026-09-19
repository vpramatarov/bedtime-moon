import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

describe('AC #2 — web app manifest', () => {
  it('declares name, short_name, standalone display and the ground colour for background/theme', () => {
    expect(manifest.name).toBe('Bedtime Moon');
    expect(manifest.short_name).toBe('Луна');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#100d26');
    expect(manifest.theme_color).toBe('#100d26');
  });

  it('declares 192x192 and 512x512 maskable icons pointing at committed same-origin files', () => {
    expect(manifest.icons).toHaveLength(2);
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes).sort();
    expect(sizes).toEqual(['192x192', '512x512']);
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/icons\/.+\.png$/);
      expect(icon.type).toBe('image/png');
      expect(icon.purpose).toBe('any maskable');
    }
  });
});
