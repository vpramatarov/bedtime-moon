import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/settings.css', 'utf8');

function rule(selector: string): string {
  const escaped = selector.replace(/[.[\]]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`rule ${selector} not found in settings.css`);
  return match[1];
}

describe('settings.css (TKT-0005 AC #1, #3)', () => {
  it('.settings-entry is offset from the top-right by the safe-area insets', () => {
    const body = rule('.settings-entry');
    expect(body).toMatch(/top:\s*calc\(env\(safe-area-inset-top/);
    expect(body).toMatch(/right:\s*calc\(env\(safe-area-inset-right/);
  });

  it('AC #1 — .settings-entry is a dull glyph no larger than 32px', () => {
    const body = rule('.settings-entry');
    const width = Number(body.match(/width:\s*(\d+)px/)?.[1]);
    const height = Number(body.match(/height:\s*(\d+)px/)?.[1]);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(32);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(32);
    expect(body).toMatch(/background:\s*var\(--glyph-dull\)/);
  });

  it('.settings-screen uses system-ui at exactly 17px', () => {
    const body = rule('.settings-screen');
    expect(body).toMatch(/font-family:\s*system-ui/);
    expect(body).toMatch(/font-size:\s*17px/);
  });

  it('never declares box-shadow, backdrop-filter, or an animated filter', () => {
    expect(css).not.toMatch(/box-shadow/);
    expect(css).not.toMatch(/backdrop-filter/);
    // no filter used inside any @keyframes body or transition/animation declaration
    expect(css).not.toMatch(/transition:[^;]*\bfilter\b/);
    expect(css).not.toMatch(/animation:[^;]*\bfilter\b/);
    const keyframeBodies = Array.from(css.matchAll(/@keyframes[^{]*\{([\s\S]*?)\n\}/g), (m) => m[1] ?? '');
    for (const body of keyframeBodies) expect(body).not.toMatch(/\bfilter\b/);
  });
});
