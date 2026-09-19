import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('TKT-0008 AC #1 — README "Deploying" section', () => {
  const readme = readFileSync('README.md', 'utf8');
  const match = readme.match(/## Deploying\n([\s\S]*?)(?=\n## |$)/);
  const body = match?.[1] ?? '';

  it('exists and links to deploy.html', () => {
    expect(match).not.toBeNull();
    expect(body).toMatch(/\[[^\]]+\]\(\.?\/?deploy\.html\)/);
  });

  it('is 2-4 sentences (no per-platform steps duplicated)', () => {
    const sentences = (body.match(/[.!?](?=\s|$)/g) ?? []).length;
    expect(sentences).toBeGreaterThanOrEqual(2);
    expect(sentences).toBeLessThanOrEqual(4);
  });
});

describe('TKT-0008 AC #2, #3, #4 — deploy.html', () => {
  const html = readFileSync('deploy.html', 'utf8');
  const PLATFORMS = ['vercel', 'netlify', 'cloudflare-pages', 'github-pages'];

  it('has a section for each of the 4 platforms', () => {
    for (const id of PLATFORMS) {
      expect(html).toMatch(new RegExp(`<section[^>]+id=["']${id}["']`, 'i'));
    }
  });

  it('the GitHub Pages section documents the BASE_PATH build command', () => {
    expect(html).toMatch(/BASE_PATH=/);
  });

  it('is self-contained: no external script or stylesheet tags', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
  });

  it('every in-page nav anchor resolves to a real section id', () => {
    const hrefs = [...html.matchAll(/href=["']#([\w-]+)["']/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    const ids = new Set([...html.matchAll(/\sid=["']([\w-]+)["']/g)].map((m) => m[1]));
    for (const href of hrefs) expect(ids.has(href)).toBe(true);
  });
});
