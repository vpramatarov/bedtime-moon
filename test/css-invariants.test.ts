import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/scene.css', 'utf8');

interface Block {
  header: string;
  body: string;
  start: number;
  end: number;
}

/** Every CSS block (rules and at-rules, nested included) via brace matching. */
function blocks(source: string): Block[] {
  const out: Block[] = [];
  const stack: Array<{ headerStart: number; bodyStart: number }> = [];
  let headerStart = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      stack.push({ headerStart, bodyStart: i + 1 });
      headerStart = i + 1;
    } else if (ch === '}') {
      const open = stack.pop();
      if (!open) throw new Error(`unbalanced } at ${i}`);
      const rawHeader = source.slice(open.headerStart, open.bodyStart - 1);
      const header = rawHeader.split(/[;}]/).pop()?.trim() ?? '';
      out.push({ header, body: source.slice(open.bodyStart, i), start: open.bodyStart, end: i });
      headerStart = i + 1;
    }
  }
  if (stack.length) throw new Error('unbalanced {');
  return out;
}

const all = blocks(css);
const keyframes = all.filter((b) => b.header.startsWith('@keyframes'));

/** Property names declared directly in a body (nested blocks included). */
function properties(body: string): string[] {
  return Array.from(body.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g), (m) => m[1] ?? '').filter((p) => p && !p.startsWith('--'));
}

describe('AC #6 / RES-0001 R11.5 — animations touch only compositor-friendly properties', () => {
  it('defines the tap, drift, twinkle and breathe keyframes', () => {
    const names = keyframes.map((b) => b.header.replace('@keyframes', '').trim());
    expect(names).toEqual(expect.arrayContaining(['tap-spring', 'drift', 'twinkle', 'breathe']));
  });

  it('every @keyframes block declares only transform and/or opacity', () => {
    expect(keyframes.length).toBeGreaterThan(0);
    for (const block of keyframes) {
      const props = [...new Set(properties(block.body))].sort();
      expect(props.length, block.header).toBeGreaterThan(0);
      expect(props, block.header).toEqual(props.filter((p) => p === 'transform' || p === 'opacity'));
    }
  });

  it('never animates or transitions filter, box-shadow, backdrop-filter or drop-shadow', () => {
    expect(css).not.toMatch(/transition:[^;]*(filter|box-shadow)/);
    for (const block of keyframes) {
      expect(block.body, block.header).not.toMatch(/filter|box-shadow|drop-shadow/);
    }
  });
});

describe('TKT-0002 AC #2 / #11 — one registered colour property drives the wind-down', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');
  const both = `${tokens}\n${css}`;
  const registrations = Array.from(both.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g));

  it('registers exactly one @property, --dim, as an inheriting <number> starting at 0', () => {
    expect(registrations.map((m) => m[1])).toEqual(['--dim']);
    const body = registrations[0]?.[2] ?? '';
    expect(body).toMatch(/syntax:\s*['"]<number>['"]/);
    expect(body).toMatch(/inherits:\s*true/);
    expect(body).toMatch(/initial-value:\s*0\b/);
  });

  it('wind-down and asleep set --dim to 1 and transition it in at most 20 s', () => {
    expect(css).toMatch(/\[data-phase="winding-down"\][^{]*\{[^}]*--dim:\s*1\b/);
    const dimTransitions = Array.from(css.matchAll(/transition:\s*--dim\s+([\d.]+)(m?s)/g));
    expect(dimTransitions.length).toBeGreaterThanOrEqual(1);
    for (const m of dimTransitions) {
      const seconds = m[2] === 'ms' ? Number(m[1]) / 1000 : Number(m[1]);
      expect(seconds).toBeLessThanOrEqual(20);
      expect(seconds).toBeGreaterThan(0);
    }
  });

  it('every transition lists only opacity, transform or --dim', () => {
    const transitions = Array.from(css.matchAll(/transition:\s*([^;]+);/g), (m) => m[1] ?? '');
    expect(transitions.length).toBeGreaterThan(0);
    for (const value of transitions) {
      const props = value.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '');
      for (const prop of props) expect(['opacity', 'transform', '--dim'], value).toContain(prop);
    }
  });

  it('defines the yawn and clouds-in keyframes (both covered by the transform/opacity-only check above)', () => {
    const names = keyframes.map((b) => b.header.replace('@keyframes', '').trim());
    expect(names).toEqual(expect.arrayContaining(['yawn', 'clouds-in']));
  });

  it('the goodnight picture is static: asleep turns the ambient loops off', () => {
    const asleep = all.filter((b) => /\[data-phase="asleep"\]/.test(b.header));
    expect(asleep.length).toBeGreaterThan(0);
    expect(asleep.some((b) => /animation(?:-name)?\s*:\s*none/.test(b.body))).toBe(true);
  });

  it('data-instant zeroes every animation and transition duration for reopen-during-cooldown', () => {
    const instant = all.filter((b) => /\[data-instant\]/.test(b.header));
    expect(instant.length).toBeGreaterThan(0);
    expect(instant.some((b) => /animation-duration:\s*0s\s*!important/.test(b.body) && /transition-duration:\s*0s\s*!important/.test(b.body))).toBe(true);
  });
});

describe('AC #8 — ambient loops exist only when motion is allowed', () => {
  const ambient = ['drift', 'twinkle', 'breathe'];
  const allowedRanges = all
    .filter((b) => /@media[^{]*prefers-reduced-motion:\s*no-preference/.test(b.header))
    .map((b) => [b.start, b.end] as const);

  it('has a prefers-reduced-motion: no-preference block', () => {
    expect(allowedRanges.length).toBeGreaterThan(0);
  });

  it('every animation declaration that uses an ambient loop sits inside that block', () => {
    const uses: RegExpExecArray[] = Array.from(css.matchAll(/animation(?:-name)?\s*:[^;]*;/g));
    const ambientUses = uses.filter((m) => ambient.some((name) => new RegExp(`\\b${name}\\b`).test(m[0])));
    expect(ambientUses.length).toBeGreaterThanOrEqual(3);
    for (const use of ambientUses) {
      const at = use.index ?? -1;
      const inside = allowedRanges.some(([start, end]) => at > start && at < end);
      expect(inside, use[0]).toBe(true);
    }
  });

  it('the calm-mode attribute also switches the ambient loops off', () => {
    expect(css).toMatch(/\[data-motion="reduced"\][^{]*\{[^}]*animation(?:-name)?\s*:\s*none/);
  });

  it('reduced motion keeps the glow-pulse tap reaction and never scales', () => {
    const reduced = all.filter((b) => /prefers-reduced-motion:\s*reduce|data-motion="reduced"/.test(b.header));
    expect(reduced.length).toBeGreaterThan(0);
    expect(reduced.some((b) => /glow-pulse/.test(b.body))).toBe(true);
    for (const block of reduced) {
      expect(block.body, block.header).not.toMatch(/\bscale\(/);
    }
  });

  it('glow-pulse animates opacity only, so the reduced-motion tap is a pure fade', () => {
    const glow = keyframes.find((b) => /glow-pulse/.test(b.header));
    expect(glow).toBeDefined();
    expect([...new Set(properties(glow!.body))]).toEqual(['opacity']);
  });
});
