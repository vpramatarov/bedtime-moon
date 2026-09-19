import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`token --${name} not found in tokens.css`);
  return match[1].trim();
}

describe('design tokens (RES-0001 R12.10: one :root block, six oklch colours)', () => {
  it('AC #5 — --moon-size has a 60vw floor', () => {
    expect(token('moon-size')).toMatch(/^max\(\s*60vw\s*,/);
  });

  it('declares exactly the six palette colours, all in oklch', () => {
    for (const name of ['ground', 'ground-2', 'moon', 'star', 'cloud', 'glow']) {
      expect(token(name)).toMatch(/^oklch\(/);
    }
    const colourTokens = tokens.match(/--[\w-]+:\s*oklch\(/g) ?? [];
    expect(colourTokens).toHaveLength(6);
  });

  it('opts the page into the dark colour scheme', () => {
    expect(tokens).toMatch(/color-scheme:\s*dark/);
  });
});
