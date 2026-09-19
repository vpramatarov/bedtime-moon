import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EIGHT_MIB = 8 * 1024 * 1024;

// The real build (all three pipeline steps) runs once in test/global-setup.ts, before any test
// file loads -- not here, and not per-file, so parallel test workers never race on shared dist/.
describe('AC #3, #5 — the real production build', () => {
  it('produces dist/sw.js as a classic script (no bare import/export tokens) that calls skipWaiting and clients.claim', () => {
    const swPath = join(process.cwd(), 'dist', 'sw.js');
    expect(existsSync(swPath)).toBe(true);
    const src = readFileSync(swPath, 'utf8');
    expect(src).not.toMatch(/\bimport\b|\bexport\b/);
    expect(src).toMatch(/skipWaiting/);
    expect(src).toMatch(/clients\.claim/);
  });

  it('produces manifest.webmanifest and the three icons in dist/', () => {
    for (const rel of [
      'manifest.webmanifest',
      'icons/icon-192-maskable.png',
      'icons/icon-512-maskable.png',
      'icons/apple-touch-icon-180.png',
    ]) {
      expect(existsSync(join(process.cwd(), 'dist', rel))).toBe(true);
    }
  });

  it('writes a precache manifest referencing every frame and asset, with every listed file present on disk', () => {
    const manifestPath = join(process.cwd(), 'src', 'pwa', 'precache-manifest.generated.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.version).not.toBe('seed');
    expect(typeof manifest.version).toBe('string');

    for (let i = 0; i < 60; i++) {
      const frame = `/frames/moon-${String(i).padStart(2, '0')}.webp`;
      expect(manifest.urls).toContain(frame);
    }
    expect(manifest.urls.some((url: string) => url.startsWith('/assets/') && url.endsWith('.js'))).toBe(true);
    expect(manifest.urls.some((url: string) => url.startsWith('/assets/') && url.endsWith('.css'))).toBe(true);
    expect(manifest.urls).toContain('/index.html');
    expect(manifest.urls).toContain('/manifest.webmanifest');
    expect(manifest.urls).not.toContain('/sw.js');

    let totalBytes = 0;
    for (const url of manifest.urls) {
      const path = join(process.cwd(), 'dist', url);
      expect(existsSync(path)).toBe(true);
      totalBytes += statSync(path).size;
    }
    expect(totalBytes).toBeLessThanOrEqual(EIGHT_MIB);
  });
});
