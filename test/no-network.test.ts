import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mountScene } from '../src/scene/scene';
import { loadFrames } from '../src/moon/frames';
import { createTapSound } from '../src/audio/tap-sound';
import type { Greeter } from '../src/audio/greeter';
import { createSessionController } from '../src/session/controller';
import { budgetMs } from '../src/session/session';
import { FakeAudioContext } from './helpers/fake-audio';
import { FakeVisibility, FakeWakeLock } from './helpers/fake-platform';
import { MemoryStorage } from './helpers/memory-storage';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const silentGreeter: Greeter = { speak: () => Promise.resolve(false) };

/** TKT-0002 ports — inert fakes; this file is about the network, not the session. */
function sessionPorts() {
  return {
    session: createSessionController({ now: () => Date.now(), storage: new MemoryStorage(), budgetMs: budgetMs(10) }),
    goodnightVoice: silentGreeter,
    wakeLock: new FakeWakeLock(),
    visibility: new FakeVisibility(),
    storage: new MemoryStorage(),
  };
}

describe('AC #3 — no network request at runtime', () => {
  it('mounting the scene and tapping the moon never calls fetch or XMLHttpRequest', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');

    const root = document.createElement('div');
    document.body.appendChild(root);
    mountScene(root, {
      now: () => new Date('2026-09-15T18:00:00Z'),
      frames: loadFrames(),
      tapSound: createTapSound({ createContext: () => new FakeAudioContext(), clock: () => 0 }),
      greeter: silentGreeter,
      reducedMotion: () => false,
      ...sessionPorts(),
    });
    root.querySelector('.moon')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('every image the scene renders is a same-origin file under /frames/', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountScene(root, {
      now: () => new Date('2026-09-15T18:00:00Z'),
      frames: loadFrames(),
      tapSound: createTapSound({ createContext: () => null, clock: () => 0 }),
      greeter: silentGreeter,
      reducedMotion: () => false,
      ...sessionPorts(),
    });
    const images = Array.from(root.querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('src')).toMatch(/^\/frames\/moon-\d{2}\.webp$/);
    }
    expect(root.innerHTML).not.toMatch(/https?:\/\//);
  });

  it('index.html references no cross-origin script, stylesheet, image or font', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i);
    expect(html).not.toMatch(/<link[^>]+rel=["']preconnect/i);
    expect(html).toMatch(/<meta\s+name=["']color-scheme["']\s+content=["']dark["']/i);
  });

  it('index.html declares color-scheme before any stylesheet or script', () => {
    const html = readFileSync('index.html', 'utf8');
    const meta = html.search(/<meta\s+name=["']color-scheme["']/i);
    const firstAsset = html.search(/<(?:link\s+[^>]*rel=["']stylesheet|script)/i);
    expect(meta).toBeGreaterThan(-1);
    expect(firstAsset).toBeGreaterThan(-1);
    expect(meta).toBeLessThan(firstAsset);
  });
});

describe('AC #1 — install-to-home-screen meta (source)', () => {
  const html = readFileSync('index.html', 'utf8');

  it('declares the manifest link and the apple-touch-icon link', () => {
    expect(html).toMatch(/<link\s+rel=["']manifest["']\s+href=["']%BASE_URL%manifest\.webmanifest["']/i);
    expect(html).toMatch(
      /<link\s+rel=["']apple-touch-icon["']\s+href=["']%BASE_URL%icons\/apple-touch-icon-180\.png["']/i,
    );
  });

  it('declares apple-mobile-web-app-capable and a black-translucent status bar', () => {
    expect(html).toMatch(/<meta\s+name=["']apple-mobile-web-app-capable["']\s+content=["']yes["']/i);
    expect(html).toMatch(
      /<meta\s+name=["']apple-mobile-web-app-status-bar-style["']\s+content=["']black-translucent["']/i,
    );
  });

  // The on-device "opens without a browser bar" half of AC #1 is opt-out: infra-config -- no
  // Vercel deployment or physical phone available in this session (see .workflow/tech-plans/TKT-0006.md).
});

// The real build runs once in test/global-setup.ts, before any test file loads.
describe('AC #6 — color-scheme precedes the stylesheet in the built page', () => {
  const builtHtml = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8');

  it('the built dist/index.html still declares color-scheme before its injected stylesheet', () => {
    const meta = builtHtml.search(/<meta\s+name=["']color-scheme["']/i);
    const stylesheet = builtHtml.search(/<link\s+[^>]*rel=["']stylesheet["']/i);
    expect(meta).toBeGreaterThan(-1);
    expect(stylesheet).toBeGreaterThan(-1);
    expect(meta).toBeLessThan(stylesheet);
  });
});
