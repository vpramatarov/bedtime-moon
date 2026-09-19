import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountScene, type SceneDeps } from '../src/scene/scene';
import { loadFrames } from '../src/moon/frames';
import { createTapSound } from '../src/audio/tap-sound';
import type { Greeter, SpeakOverride } from '../src/audio/greeter';
import { HANDOFF_DIRECTION_WORDS_BG, HANDOFF_NO_LOCATION_BG, HANDOFF_VISIBLE_PREFIX_BG } from '../src/audio/greeting';
import { createSessionController } from '../src/session/controller';
import { COOLDOWN_MS, budgetMs } from '../src/session/session';
import { KEYS } from '../src/session/storage';
import { writeLocation } from '../src/settings/settings-storage';
import { FakeAudioContext } from './helpers/fake-audio';
import { fakeObserverFactory } from './helpers/fake-observer';
import { FakeVisibility, FakeWakeLock } from './helpers/fake-platform';
import { MemoryStorage } from './helpers/memory-storage';

const frames = loadFrames();
const B = budgetMs(5);
const T0 = Date.UTC(2026, 8, 15, 18, 0, 0);

let nowMs = T0;

function countingGreeter(): Greeter & { calls: number; lastOverride: SpeakOverride | undefined } {
  const g = {
    calls: 0,
    lastOverride: undefined as SpeakOverride | undefined,
    speak(override?: SpeakOverride): Promise<boolean> {
      g.calls++;
      g.lastOverride = override;
      return Promise.resolve(true);
    },
  };
  return g;
}

function tap(target: Element): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
}

interface Rig {
  root: HTMLElement;
  storage: MemoryStorage;
  wakeLock: FakeWakeLock;
  visibility: FakeVisibility;
  goodnight: ReturnType<typeof countingGreeter>;
  greeter: ReturnType<typeof countingGreeter>;
  ctx: FakeAudioContext;
  handle: ReturnType<typeof mountScene>;
  moon: HTMLElement;
}

function mount(storage = new MemoryStorage(), overrides: Partial<SceneDeps> = {}): Rig {
  const root = document.createElement('div');
  root.id = 'app';
  document.body.appendChild(root);
  const wakeLock = new FakeWakeLock();
  const visibility = new FakeVisibility();
  const goodnight = countingGreeter();
  const greeter = countingGreeter();
  const ctx = new FakeAudioContext();
  const session = createSessionController({ now: () => nowMs, storage, budgetMs: B });
  const handle = mountScene(root, {
    now: () => new Date(nowMs),
    frames,
    tapSound: createTapSound({ createContext: () => ctx, clock: () => nowMs }),
    greeter,
    reducedMotion: () => false,
    session,
    goodnightVoice: goodnight,
    wakeLock,
    visibility,
    storage,
    ...overrides,
  });
  return { root, storage, wakeLock, visibility, goodnight, greeter, ctx, handle, moon: root.querySelector<HTMLElement>('.moon')! };
}

/** Advance the injected wall clock and the fake timers together. */
async function elapse(ms: number): Promise<void> {
  nowMs += ms;
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  nowMs = T0;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('AC #1 — the first tap starts the session', () => {
  it('writes bedtime-moon.sessionStart on the first tap and marks the scene active', () => {
    const { storage, moon, root } = mount();
    expect(root.dataset.phase).toBe('awake');
    expect(storage.getItem(KEYS.sessionStart)).toBeNull();
    tap(moon);
    expect(storage.getItem(KEYS.sessionStart)).toBe(String(T0));
    expect(root.dataset.phase).toBe('active');
  });

  it('still plays the tap reaction on that first tap', () => {
    const { moon, ctx } = mount();
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
    expect(ctx.oscillators).toHaveLength(1);
  });
});

describe('AC #2 — wind-down at 80 % of the budget', () => {
  it('sets data-phase=winding-down and yawns exactly once', async () => {
    const { moon, root } = mount();
    tap(moon);
    await elapse(0.8 * B);
    expect(root.dataset.phase).toBe('winding-down');
    // AC #8 (TKT-0004): wind-down yawns the *centred* card, not whichever one was tapped to start
    // the session -- here that's still tonight ([data-night-offset="0"]), since nothing swiped.
    const body = root.querySelector('[data-night-offset="0"] .moon-body')!;
    expect(body.classList.contains('is-yawning')).toBe(true);
    // jsdom has no AnimationEvent constructor; a plain Event carrying animationName is what the handler reads
    body.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: 'yawn' }));
    expect(body.classList.contains('is-yawning')).toBe(false);
    await elapse(10_000);
    expect(body.classList.contains('is-yawning')).toBe(false);
  });

  it('the moon still reacts to taps during wind-down', async () => {
    const { moon, ctx } = mount();
    tap(moon);
    await elapse(0.8 * B + 1_000);
    tap(moon);
    expect(moon.classList.contains('is-tapped')).toBe(true);
    expect(ctx.oscillators).toHaveLength(2);
  });
});

describe('AC #8 — wind-down/goodnight target the centred card (TKT-0004)', () => {
  it('yawns whichever card is centred, not tonight, once the Child has swiped away', async () => {
    const observer = fakeObserverFactory();
    const storage = new MemoryStorage();
    const { root, moon } = mount(storage, { nightStrip: { createObserver: observer.factory } });
    tap(moon);
    const swipedToCard = root.querySelector('[data-night-offset="-2"]')!;
    observer.fireCentered(swipedToCard);

    await elapse(0.8 * B);

    expect(root.dataset.phase).toBe('winding-down');
    expect(root.querySelector('[data-night-offset="0"] .moon-body')!.classList.contains('is-yawning')).toBe(false);
    expect(swipedToCard.querySelector('.moon-body')!.classList.contains('is-yawning')).toBe(true);
  });

  it('reaches asleep, which scene.css keys the strip-disabling rule off of (see night-strip-css.test.ts)', async () => {
    const { root, moon } = mount();
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');
    expect(root.querySelector('.night-strip-track')).not.toBeNull();
  });
});

describe('AC #3 — goodnight at the budget', () => {
  it('shows clouds, speaks the goodnight line once and marks the scene asleep', async () => {
    const { moon, root, goodnight } = mount();
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');
    expect(root.querySelectorAll('.cloud').length).toBeGreaterThanOrEqual(3);
    expect(goodnight.calls).toBe(1);
    await elapse(60_000);
    expect(goodnight.calls).toBe(1);
    expect(root.textContent?.trim()).toBe('');
  });

  it('plays the lullaby instead of the spoken line when a lullaby asset is configured', async () => {
    const played: string[] = [];
    const { moon, goodnight } = mount(new MemoryStorage(), {
      lullabyUrl: '/audio/lullaby.mp3',
      createAudio: (url: string) => {
        played.push(url);
        return { play: () => Promise.resolve() };
      },
    });
    tap(moon);
    await elapse(B);
    expect(played).toEqual(['/audio/lullaby.mp3']);
    expect(goodnight.calls).toBe(0);
  });
});

describe('AC #2, #3, #7 — the real-sky hand-off at goodnight (TKT-0003)', () => {
  it('speaks the no-location line when nothing is stored (fresh MemoryStorage)', async () => {
    const { moon, goodnight } = mount();
    tap(moon);
    await elapse(B);
    expect(goodnight.lastOverride?.text).toBe(HANDOFF_NO_LOCATION_BG);
  });

  it('reads the stored location fresh at goodnight and speaks the visible+direction line', async () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.7, lon: 23.32, source: 'manual', townId: null });
    const { moon, goodnight } = mount(storage, { now: () => new Date('2026-09-16T10:06:59Z') });
    tap(moon);
    await elapse(B);
    expect(goodnight.lastOverride?.text).toBe(
      `${HANDOFF_VISIBLE_PREFIX_BG}, ${HANDOFF_DIRECTION_WORDS_BG['south-east']}.`,
    );
  });

  it('AC #7 — no text appears on the goodnight screen in the location-aware branch either', async () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.7, lon: 23.32, source: 'manual', townId: null });
    const { moon, root } = mount(storage, { now: () => new Date('2026-09-16T10:06:59Z') });
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');
    expect(root.textContent?.trim()).toBe('');
  });
});

describe('AC #4 — the goodnight screen is inert', () => {
  it('taps produce no class, no sound, no speech; the scene is inert with nothing focusable', async () => {
    const { moon, root, ctx, greeter, goodnight } = mount();
    tap(moon);
    await elapse(B);
    const oscillatorsBefore = ctx.oscillators.length;
    tap(moon);
    tap(root.querySelector('.scene')!);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(moon.classList.contains('is-tapped')).toBe(false);
    expect(ctx.oscillators.length).toBe(oscillatorsBefore);
    expect(greeter.calls).toBe(0);
    expect(goodnight.calls).toBe(1);
    const scene = root.querySelector('.scene')!;
    expect(scene.hasAttribute('inert')).toBe(true);
    expect(root.querySelectorAll('button, a, input, select, textarea, [tabindex], [contenteditable]')).toHaveLength(0);
  });
});

describe('AC #5 — visibilitychange recomputes from the stored start', () => {
  it('a clock jump while hidden yields goodnight the moment the app is shown again', async () => {
    const { moon, root, visibility } = mount();
    tap(moon);
    await elapse(60_000);
    visibility.set(false);
    nowMs += B; // hidden for longer than the budget; timers frozen
    expect(root.dataset.phase).toBe('active');
    visibility.set(true);
    expect(root.dataset.phase).toBe('asleep');
    expect(root.querySelectorAll('.cloud').length).toBeGreaterThan(0);
  });
});

describe('AC #6 / #7 — reopening during and after the cooldown', () => {
  it('mounting inside the cooldown shows the goodnight picture instantly (data-instant) with no speech', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0 - B));
    storage.setItem(KEYS.sleptAt, String(T0));
    nowMs = T0 + 30 * 60_000;
    const { root, goodnight, wakeLock } = mount(storage);
    expect(root.dataset.phase).toBe('asleep');
    expect(root.dataset.instant).toBeDefined();
    expect(root.querySelectorAll('.cloud').length).toBeGreaterThan(0);
    expect(root.querySelector('.scene')!.hasAttribute('inert')).toBe(true);
    expect(goodnight.calls).toBe(0);
    expect(wakeLock.requests).toBe(0);
  });

  it('mounting at or after sleptAt + 2 h is awake and the next tap starts a fresh session', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0 - B));
    storage.setItem(KEYS.sleptAt, String(T0));
    nowMs = T0 + COOLDOWN_MS;
    const { root, moon } = mount(storage);
    expect(root.dataset.phase).toBe('awake');
    expect(root.dataset.instant).toBeUndefined();
    expect(root.querySelectorAll('.cloud')).toHaveLength(0);
    tap(moon);
    expect(storage.getItem(KEYS.sessionStart)).toBe(String(nowMs));
    expect(storage.getItem(KEYS.sleptAt)).toBeNull();
  });

  it('the cooldown expiring while the goodnight picture is shown wakes the moon on the next visibility', async () => {
    const { moon, root, visibility } = mount();
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');
    visibility.set(false);
    nowMs += COOLDOWN_MS;
    visibility.set(true);
    expect(root.dataset.phase).toBe('awake');
    expect(root.querySelectorAll('.cloud')).toHaveLength(0);
    expect(root.querySelector('.scene')!.hasAttribute('inert')).toBe(false);
  });
});

describe('AC #8 — abandoned session', () => {
  it('opening after start + B shows goodnight immediately', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0));
    nowMs = T0 + B + 10 * 60_000;
    const { root } = mount(storage);
    expect(root.dataset.phase).toBe('asleep');
    expect(storage.getItem(KEYS.sleptAt)).toBe(String(T0 + B));
  });
});

describe('AC #9 — restart', () => {
  it('handle.restart() clears storage and returns the awake scene synchronously', async () => {
    const { moon, root, storage, handle, greeter } = mount();
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');
    handle.restart();
    expect(root.dataset.phase).toBe('awake');
    expect(root.querySelectorAll('.cloud')).toHaveLength(0);
    expect(root.querySelector('.scene')!.hasAttribute('inert')).toBe(false);
    expect(storage.getItem(KEYS.sessionStart)).toBeNull();
    expect(storage.getItem(KEYS.sleptAt)).toBeNull();
    // a fresh session gets its greeting again (the first one may have been cut off by goodnight)
    const before = greeter.calls;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(greeter.calls).toBe(before + 1);
  });
});

describe('AC #10 — screen wake lock', () => {
  it('is requested when the session starts, again on every return to visible, and released at goodnight', async () => {
    const { moon, wakeLock, visibility } = mount();
    expect(wakeLock.requests).toBe(0);
    tap(moon);
    expect(wakeLock.requests).toBe(1);
    visibility.set(false);
    visibility.set(true);
    expect(wakeLock.requests).toBe(2);
    await elapse(B);
    expect(wakeLock.releases).toBeGreaterThanOrEqual(1);
    expect(wakeLock.held).toBe(false);
    visibility.set(false);
    visibility.set(true);
    expect(wakeLock.requests).toBe(2);
  });
});

describe('TKT-0001 regressions with the session wired in', () => {
  it('the idle greeting still fires once in a fresh session and never on the goodnight screen', async () => {
    const { greeter, moon } = mount();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(greeter.calls).toBe(1);
    tap(moon);
    await elapse(B + 10_000);
    expect(greeter.calls).toBe(1);
  });

  it('destroy() releases the wake lock and stops evaluating', async () => {
    const { moon, handle, wakeLock, root } = mount();
    tap(moon);
    handle.destroy();
    expect(wakeLock.held).toBe(false);
    await elapse(B);
    expect(root.dataset.phase).toBeUndefined();
  });
});
