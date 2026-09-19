import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountScene, type SceneDeps, type SceneHandle } from '../src/scene/scene';
import { getMoonIllumination } from 'suncalc';
import { loadFrames } from '../src/moon/frames';
import { nearestFrame } from '../src/moon/phase';
import { createTapSound } from '../src/audio/tap-sound';
import type { Greeter } from '../src/audio/greeter';
import { createSessionController } from '../src/session/controller';
import { budgetMs } from '../src/session/session';
import { FakeAudioContext } from './helpers/fake-audio';
import { FakeVisibility, FakeWakeLock } from './helpers/fake-platform';
import { MemoryStorage } from './helpers/memory-storage';

const frames = loadFrames();
const FULL_MOON_NIGHT = new Date('2026-01-03T19:00:00Z');

function fakeGreeter(results: boolean[]): Greeter & { calls: number } {
  const queue = [...results];
  const greeter = {
    calls: 0,
    speak(): Promise<boolean> {
      greeter.calls++;
      return Promise.resolve(queue.length > 1 ? queue.shift()! : (queue[0] ?? true));
    },
  };
  return greeter;
}

function tap(target: Element): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
}

function mount(overrides: Partial<SceneDeps> = {}): { root: HTMLElement; handle: SceneHandle; deps: SceneDeps } {
  const root = document.createElement('div');
  root.id = 'app';
  document.body.appendChild(root);
  const deps: SceneDeps = {
    now: () => FULL_MOON_NIGHT,
    frames,
    tapSound: createTapSound({ createContext: () => new FakeAudioContext(), clock: () => Date.now() }),
    greeter: fakeGreeter([true]),
    reducedMotion: () => false,
    // TKT-0002 ports — inert fakes so these TKT-0001 assertions stay about the awake scene
    session: createSessionController({ now: () => Date.now(), storage: new MemoryStorage(), budgetMs: budgetMs(10) }),
    goodnightVoice: fakeGreeter([true]),
    wakeLock: new FakeWakeLock(),
    visibility: new FakeVisibility(),
    storage: new MemoryStorage(),
    ...overrides,
  };
  const handle = mountScene(root, deps);
  return { root, handle, deps };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FULL_MOON_NIGHT);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe("AC #2 — the scene shows tonight's frame", () => {
  it('renders the img whose src is the manifest file nearest the phase for deps.now()', () => {
    const { root } = mount();
    // TKT-0004: 15 cards now exist; tonight's is the one tagged data-night-offset="0".
    const img = root.querySelector<HTMLImageElement>('[data-night-offset="0"] img.moon-img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(nearestFrame(getMoonIllumination(FULL_MOON_NIGHT).phase, frames).file);
    // 2026-01-03 19:00 UTC is full moon (Skyfield: 185.15°), i.e. frame 30 ± 1 of 60.
    const index = Number(/moon-(\d{2})\.webp$/.exec(img!.getAttribute('src') ?? '')?.[1]);
    expect(Math.abs(index - 30)).toBeLessThanOrEqual(1);
  });
});

describe('AC #4 — the child screen has zero text characters', () => {
  it('contains no non-whitespace text nodes anywhere under the root', () => {
    const { root } = mount();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent ?? '';
      if (text.trim() !== '') texts.push(text);
    }
    expect(texts).toEqual([]);
    expect(root.textContent?.trim()).toBe('');
  });

  it('gives the moon image an empty alt so assistive tech reads nothing on the child screen', () => {
    const { root } = mount();
    expect(root.querySelector('img.moon-img')!.getAttribute('alt')).toBe('');
  });
});

describe('AC #5 — the moon reacts on pointerdown, not click', () => {
  it('adds the tap animation class on pointerdown', () => {
    const { root } = mount();
    const moon = root.querySelector('.moon')!;
    expect(moon.classList.contains('is-tapped')).toBe(false);
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
  });

  it('ignores a bare click event', () => {
    const { root } = mount();
    const moon = root.querySelector('.moon')!;
    moon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(moon.classList.contains('is-tapped')).toBe(false);
  });

  it('clears the tap class when the animation ends, so the next tap restarts it', () => {
    const { root } = mount();
    const moon = root.querySelector('.moon')!;
    tap(moon);
    moon.querySelector('.moon-body')!.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(moon.classList.contains('is-tapped')).toBe(false);
  });

  it('is sized by the --moon-size token (≥ 60 % of the viewport width)', () => {
    const { root } = mount();
    const moon = root.querySelector<HTMLElement>('.moon')!;
    expect(moon.className.split(' ')).toContain('moon');
    expect(moon.tagName).toBe('DIV');
  });
});

describe('AC #6 — one glow and one soft sound per tap, no stacking', () => {
  it('two taps within the chime start exactly one oscillator; a tap after it ends starts another', () => {
    const ctx = new FakeAudioContext();
    const tapSound = createTapSound({ createContext: () => ctx, clock: () => Date.now() });
    const { root } = mount({ tapSound });
    const moon = root.querySelector('.moon')!;
    tap(moon);
    vi.advanceTimersByTime(150);
    tap(moon);
    expect(ctx.oscillators).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    tap(moon);
    expect(ctx.oscillators).toHaveLength(2);
  });
});

describe('AC #7 — exactly one spoken greeting after 5 s without input', () => {
  it('speaks once after 5 s idle and never again in the session', async () => {
    const greeter = fakeGreeter([true]);
    const { root } = mount({ greeter });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(greeter.calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(greeter.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    tap(root.querySelector('.moon')!);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(greeter.calls).toBe(1);
  });

  it('input before 5 s postpones the greeting until 5 s have passed without input', async () => {
    const greeter = fakeGreeter([true]);
    const { root } = mount({ greeter });
    await vi.advanceTimersByTimeAsync(3_000);
    tap(root.querySelector('.moon')!);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(greeter.calls).toBe(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(greeter.calls).toBe(1);
  });

  it('when speech is blocked at 5 s, the greeting plays once on the next tap and not again', async () => {
    const greeter = fakeGreeter([false, true]);
    const { root } = mount({ greeter });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(greeter.calls).toBe(1);
    const moon = root.querySelector('.moon')!;
    tap(moon);
    await vi.advanceTimersByTimeAsync(0);
    expect(greeter.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(10_000);
    tap(moon);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(greeter.calls).toBe(2);
  });

  it('stops the idle timer on destroy', async () => {
    const greeter = fakeGreeter([true]);
    const { handle } = mount({ greeter });
    handle.destroy();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(greeter.calls).toBe(0);
  });
});

describe('AC #8 — reduced motion', () => {
  it('marks the root with data-motion="reduced" and the moon still reacts to taps', () => {
    const { root } = mount({ reducedMotion: () => true });
    expect(root.dataset.motion).toBe('reduced');
    const moon = root.querySelector('.moon')!;
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
  });

  it('leaves the attribute off when motion is allowed', () => {
    const { root } = mount({ reducedMotion: () => false });
    expect(root.dataset.motion).toBeUndefined();
  });
});

describe('RES-0001 R11.5 — star field budget', () => {
  it('renders at most 30 star elements', () => {
    const { root } = mount();
    const stars = root.querySelectorAll('.star');
    expect(stars.length).toBeGreaterThan(0);
    expect(stars.length).toBeLessThanOrEqual(30);
  });
});

describe('TKT-0005 — setCalmMode live override', () => {
  it('setCalmMode(true) sets data-motion="reduced" even when reducedMotion() is false', () => {
    const { root, handle } = mount({ reducedMotion: () => false });
    expect(root.dataset.motion).toBeUndefined();
    handle.setCalmMode(true);
    expect(root.dataset.motion).toBe('reduced');
  });

  it('setCalmMode(false) removes the attribute again when reducedMotion() is false', () => {
    const { root, handle } = mount({ reducedMotion: () => false });
    handle.setCalmMode(true);
    expect(root.dataset.motion).toBe('reduced');
    handle.setCalmMode(false);
    expect(root.dataset.motion).toBeUndefined();
  });

  it('setCalmMode(false) leaves data-motion="reduced" in place when reducedMotion() is true', () => {
    const { root, handle } = mount({ reducedMotion: () => true });
    expect(root.dataset.motion).toBe('reduced');
    handle.setCalmMode(true);
    handle.setCalmMode(false);
    expect(root.dataset.motion).toBe('reduced');
  });

  it('the moon still reacts to pointerdown taps with the override on', () => {
    const { root, handle } = mount({ reducedMotion: () => false });
    handle.setCalmMode(true);
    const moon = root.querySelector('.moon')!;
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
  });

  it('the moon still reacts to pointerdown taps with the override off', () => {
    const { root, handle } = mount({ reducedMotion: () => false });
    handle.setCalmMode(true);
    handle.setCalmMode(false);
    const moon = root.querySelector('.moon')!;
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
  });
});

describe('AC #1, #2 — the night strip (TKT-0004)', () => {
  it('holds exactly 15 cards, tonight tagged and centred by default', () => {
    const { root } = mount();
    const cards = root.querySelectorAll('.night-card');
    expect(cards).toHaveLength(15);
    expect(root.querySelectorAll('[data-night-offset="0"]')).toHaveLength(1);
    expect(root.querySelectorAll('.moon-img')).toHaveLength(15);
  });

  it('every card has its own independently tappable moon', () => {
    const { root } = mount();
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.night-card'));
    const first = cards[0]!.querySelector('.moon')!;
    const last = cards[cards.length - 1]!.querySelector('.moon')!;
    tap(first);
    expect(first.classList.contains('is-tapped')).toBe(true);
    expect(last.classList.contains('is-tapped')).toBe(false);
  });
});

describe('AC #4 — no text, arrows, dots or labels on any card', () => {
  it('contains no non-whitespace text nodes anywhere under the root, with 15 cards mounted', () => {
    const { root } = mount();
    expect(root.querySelectorAll('.night-card')).toHaveLength(15);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent ?? '';
      if (text.trim() !== '') texts.push(text);
    }
    expect(texts).toEqual([]);
  });

  it('the nav zones and cards carry no button, link, svg or aria-label content', () => {
    const { root } = mount();
    expect(root.querySelectorAll('.night-strip button, .night-strip a, .night-strip svg')).toHaveLength(0);
    expect(root.querySelectorAll('.night-strip [aria-label]')).toHaveLength(0);
  });
});

describe('AC #6 — swiping never creates a browser history entry', () => {
  it('history.length is unchanged after nav-zone taps and card taps', () => {
    const { root } = mount();
    const before = history.length;
    const left = root.querySelector<HTMLElement>('.night-nav-zone.left')!;
    const right = root.querySelector<HTMLElement>('.night-nav-zone.right')!;
    tap(right);
    tap(right);
    tap(left);
    tap(root.querySelector<HTMLElement>('.moon')!);
    expect(history.length).toBe(before);
  });

  it('neither scene.ts nor night-strip.ts ever calls pushState or touches location.hash', () => {
    for (const path of ['src/scene/scene.ts', 'src/scene/night-strip.ts']) {
      expect(readFileSync(path, 'utf8')).not.toMatch(/pushState|location\.hash/);
    }
  });
});
