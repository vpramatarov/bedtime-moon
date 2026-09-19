import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Built by a second, bare `vite build` pass in test/global-setup.ts with BASE_PATH=/base-test/ --
// the one piece of TKT-0007 with no unit-testable seam (Vite's own %BASE_URL% HTML templating).
const html = readFileSync(join(process.cwd(), 'dist-basepath-test', 'index.html'), 'utf8');

describe('TKT-0007 AC #2 — built output resolves under a non-root base path', () => {
  it('the manifest link resolves under /base-test/', () => {
    expect(html).toMatch(/<link\s+rel=["']manifest["']\s+href=["']\/base-test\/manifest\.webmanifest["']/i);
  });

  it('the apple-touch-icon link resolves under /base-test/', () => {
    expect(html).toMatch(
      /<link\s+rel=["']apple-touch-icon["']\s+href=["']\/base-test\/icons\/apple-touch-icon-180\.png["']/i,
    );
  });

  it('the injected script tag resolves under /base-test/', () => {
    expect(html).toMatch(/<script[^>]+type=["']module["'][^>]+src=["']\/base-test\/assets\/[^"']+["']/i);
  });
});
