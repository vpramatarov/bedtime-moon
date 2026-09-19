import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountApp } from '../src/app/shell';
import type { Greeter } from '../src/audio/greeter';
import { createTapSound } from '../src/audio/tap-sound';
import { loadFrames } from '../src/moon/frames';
import type { GeolocationPort } from '../src/platform/geolocation';
import type { InstallPromptPort } from '../src/platform/install-prompt';
import { createSessionController } from '../src/session/controller';
import { budgetMs } from '../src/session/session';
import { TOWNS } from '../src/settings/towns';
import { FakeAudioContext } from './helpers/fake-audio';
import { FakeVisibility, FakeWakeLock } from './helpers/fake-platform';
import { FakeSpeechSynthesis } from './helpers/fake-speech';
import { MemoryStorage } from './helpers/memory-storage';

const frames = loadFrames();
const B = budgetMs(5);
const T0 = Date.UTC(2026, 8, 15, 18, 0, 0);

let nowMs = T0;

function inertGreeter(): Greeter {
  return { speak: () => Promise.resolve(true) };
}

function fakeGeolocation(): GeolocationPort {
  return { request: () => Promise.resolve({ lat: 42.7, lon: 23.32 }) };
}

/** Never fires — the shell's own composition, not the install feature, is what these tests cover. */
class FakeInstallPrompt implements InstallPromptPort {
  isAvailable(): boolean {
    return false;
  }
  prompt(): Promise<void> {
    return Promise.resolve();
  }
  onAvailability(): () => void {
    return () => undefined;
  }
}

function tap(target: Element): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
}

interface Rig {
  root: HTMLElement;
  storage: MemoryStorage;
  handle: ReturnType<typeof mountApp>;
  moon: HTMLElement;
}

function mount(): Rig {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const storage = new MemoryStorage();
  const session = createSessionController({ now: () => nowMs, storage, budgetMs: B });
  const handle = mountApp(root, {
    now: () => new Date(nowMs),
    frames,
    tapSound: createTapSound({ createContext: () => new FakeAudioContext(), clock: () => nowMs }),
    greeter: inertGreeter(),
    reducedMotion: () => false,
    session,
    goodnightVoice: inertGreeter(),
    wakeLock: new FakeWakeLock(),
    visibility: new FakeVisibility(),
    storage,
    geolocation: fakeGeolocation(),
    installPrompt: new FakeInstallPrompt(),
    speechSynth: new FakeSpeechSynthesis([{ lang: 'bg-BG', name: 'Daria' }]),
    towns: TOWNS,
  });
  return { root, storage, handle, moon: root.querySelector<HTMLElement>('.moon')! };
}

/** Advance the injected wall clock and the fake timers together (same technique as scene-session.test.ts). */
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

describe('mountApp — composing scene + entry + panel (TKT-0005 AC #2)', () => {
  it('renders both the scene and the settings entry glyph', () => {
    const { root } = mount();
    expect(root.querySelector('.scene')).not.toBeNull();
    const entryButton = root.querySelector<HTMLButtonElement>('button.settings-entry');
    expect(entryButton).not.toBeNull();
    expect(entryButton!.hidden).toBe(false);
  });

  it('tapping the entry hides it and shows the settings panel', () => {
    const { root } = mount();
    const entryButton = root.querySelector<HTMLButtonElement>('button.settings-entry')!;
    const panelEl = root.querySelector<HTMLElement>('.settings-screen')!;
    expect(panelEl.hidden).toBe(true);

    tap(entryButton);

    expect(entryButton.hidden).toBe(true);
    expect(panelEl.hidden).toBe(false);
  });

  it('Back inside the panel closes it and shows the entry glyph again', () => {
    const { root } = mount();
    const entryButton = root.querySelector<HTMLButtonElement>('button.settings-entry')!;
    tap(entryButton);
    const panelEl = root.querySelector<HTMLElement>('.settings-screen')!;
    expect(panelEl.hidden).toBe(false);

    panelEl.querySelector<HTMLButtonElement>('.settings-back')!.click();

    expect(panelEl.hidden).toBe(true);
    expect(entryButton.hidden).toBe(false);
  });

  it('Restart works through the goodnight screen: the entry stays reachable and reopens the moon', async () => {
    const { root, moon } = mount();
    tap(moon);
    await elapse(B);
    expect(root.dataset.phase).toBe('asleep');

    // the entry glyph is a sibling of .scene, so the scene's `inert` during goodnight never disables it
    const entryButton = root.querySelector<HTMLButtonElement>('button.settings-entry')!;
    expect(entryButton.hidden).toBe(false);
    expect(entryButton.hasAttribute('disabled')).toBe(false);

    tap(entryButton);
    const panelEl = root.querySelector<HTMLElement>('.settings-screen')!;
    expect(panelEl.hidden).toBe(false);

    const restartButton = panelEl.querySelector<HTMLButtonElement>('[data-setting="restart"] button')!;
    restartButton.click();

    expect(root.dataset.phase).toBe('awake');
    expect(root.querySelector('.scene')!.hasAttribute('inert')).toBe(false);
  });

  it('destroy() tears down the scene, the entry and the panel without throwing', () => {
    const { root, handle } = mount();
    tap(root.querySelector<HTMLButtonElement>('button.settings-entry')!); // leave it mid-open, destroy must still be clean

    expect(() => handle.destroy()).not.toThrow();

    expect(root.querySelector('.scene')).toBeNull();
    expect(root.querySelector('button.settings-entry')).toBeNull();
    expect(root.querySelector('.settings-screen')).toBeNull();
  });
});
