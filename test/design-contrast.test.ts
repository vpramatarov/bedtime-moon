import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, oklchToSrgb, parseOklch, relativeLuminance } from '../src/design/oklch';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`token --${name} not found in tokens.css`);
  return match[1].trim();
}

function contrast(a: string, b: string): number {
  return contrastRatio(oklchToSrgb(parseOklch(token(a))), oklchToSrgb(parseOklch(token(b))));
}

describe('AC #9 — moon-vs-sky contrast ≥ 3:1 (WCAG 1.4.11), computed from the oklch tokens', () => {
  it('--moon against --ground is at least 3:1', () => {
    expect(contrast('moon', 'ground')).toBeGreaterThanOrEqual(3);
  });

  it('--glow against --ground is at least 3:1', () => {
    expect(contrast('glow', 'ground')).toBeGreaterThanOrEqual(3);
  });

  it('oklch conversion hits the sRGB anchors: white, black, and pure sRGB red', () => {
    expect(oklchToSrgb(parseOklch('oklch(100% 0 0)'))).toEqual({ r: 1, g: 1, b: 1 });
    expect(oklchToSrgb(parseOklch('oklch(0% 0 0)'))).toEqual({ r: 0, g: 0, b: 0 });
    const red = oklchToSrgb(parseOklch('oklch(62.8% 0.2577 29.23)'));
    expect(red.r).toBeCloseTo(1, 2);
    expect(red.g).toBeCloseTo(0, 1);
    expect(red.b).toBeCloseTo(0, 1);
  });

  it('contrast ratio matches the WCAG reference: white on black is 21:1', () => {
    const white = { r: 1, g: 1, b: 1 };
    const black = { r: 0, g: 0, b: 0 };
    expect(relativeLuminance(white)).toBeCloseTo(1, 6);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 6);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 6);
  });
});

describe('TKT-0005 AC #1 — --glyph-dull (a derived color-mix, not a raw oklch literal) is legible', () => {
  /** Resolve a two-stop `color-mix(in oklch, var(--a) X%, var(--b) Y%)` token to sRGB, by mixing
   *  the two referenced oklch tokens the way CSS Color 4 does: L and C linearly, H around the
   *  shorter arc — reusing this file's own parseOklch/oklchToSrgb, not a new colour library. */
  function mixedToken(name: string): ReturnType<typeof oklchToSrgb> {
    const raw = token(name);
    const match = raw.match(/color-mix\(in oklch,\s*var\(--([\w-]+)\)\s*(\d+(?:\.\d+)?)%,\s*var\(--([\w-]+)\)\s*(\d+(?:\.\d+)?)%\)/);
    if (!match) throw new Error(`not a two-stop oklch color-mix(): ${raw}`);
    const [, name1, p1Str, name2, p2Str] = match as unknown as [string, string, string, string, string];
    const c1 = parseOklch(token(name1));
    const c2 = parseOklch(token(name2));
    const t = Number(p2Str) / (Number(p1Str) + Number(p2Str));
    let h1 = c1.h;
    let h2 = c2.h;
    if (h2 - h1 > 180) h1 += 360;
    else if (h2 - h1 < -180) h2 += 360;
    const h = (((h1 + t * (h2 - h1)) % 360) + 360) % 360;
    const l = (1 - t) * c1.l + t * c2.l;
    const c = (1 - t) * c1.c + t * c2.c;
    return oklchToSrgb({ l, c, h });
  }

  it('--glyph-dull is at least 3:1 against both --ground and --ground-2', () => {
    const glyphDull = mixedToken('glyph-dull');
    expect(contrastRatio(glyphDull, oklchToSrgb(parseOklch(token('ground'))))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(glyphDull, oklchToSrgb(parseOklch(token('ground-2'))))).toBeGreaterThanOrEqual(3);
  });
});
