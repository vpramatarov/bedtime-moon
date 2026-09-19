import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/scene.css', 'utf8');

function rule(selector: string): string {
  const escaped = selector.replace(/[.[\]]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`rule ${selector} not found in scene.css`);
  return match[1];
}

describe('scene.css night strip (TKT-0004 AC #1, #5, #8)', () => {
  it('AC #1 — the track uses mandatory horizontal scroll-snap', () => {
    expect(rule('.night-strip-track')).toMatch(/scroll-snap-type:\s*x\s+mandatory/);
  });

  it('AC #1 — each card is a full-width, centre-aligned snap point', () => {
    const body = rule('.night-card');
    expect(body).toMatch(/flex:\s*0\s+0\s+100%/);
    expect(body).toMatch(/scroll-snap-align:\s*center/);
  });

  it('AC #5 — the track only allows horizontal panning; the page keeps its own touch-action', () => {
    expect(rule('.night-strip-track')).toMatch(/touch-action:\s*pan-x/);
    expect(rule('.scene')).toMatch(/touch-action:\s*manipulation/);
  });

  it('AC #8 — the track stops scrolling once the phase is asleep', () => {
    expect(rule('[data-phase="asleep"] .night-strip-track')).toMatch(/overflow:\s*hidden/);
  });

  it('nav zones sit on the outer thirds, not the centre where the moon is tappable', () => {
    const width = rule('.night-nav-zone').match(/width:\s*([\d.]+)%/)?.[1];
    expect(Number(width)).toBeLessThan(50);
    expect(rule('.night-nav-zone.left')).toMatch(/left:\s*0/);
    expect(rule('.night-nav-zone.right')).toMatch(/right:\s*0/);
  });
});
