import { describe, it, expect, vi } from 'vitest';
import { createInstallPrompt } from '../src/platform/install-prompt';

class FakeWindow {
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    this.listeners.get(type)?.forEach((listener) => listener(event as Event));
  }
}

function fakeInstallEvent(promptResolves = true) {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(() => (promptResolves ? Promise.resolve() : Promise.reject(new Error('dismissed')))),
  };
}

describe('AC #4 — install-prompt port: mirrors beforeinstallprompt, replays it once', () => {
  it('stays unavailable until beforeinstallprompt fires, then preventDefault runs and subscribers are told', () => {
    const win = new FakeWindow();
    const installPrompt = createInstallPrompt(win);
    const listener = vi.fn();
    installPrompt.onAvailability(listener);

    expect(installPrompt.isAvailable()).toBe(false);

    const event = fakeInstallEvent();
    win.dispatch('beforeinstallprompt', event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(installPrompt.isAvailable()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('prompt() replays the stored event and clears availability afterward', async () => {
    const win = new FakeWindow();
    const installPrompt = createInstallPrompt(win);
    const event = fakeInstallEvent();
    win.dispatch('beforeinstallprompt', event);

    await installPrompt.prompt();

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(installPrompt.isAvailable()).toBe(false);
  });

  it('prompt() is a no-op when nothing is stored', async () => {
    const installPrompt = createInstallPrompt(new FakeWindow());
    await expect(installPrompt.prompt()).resolves.toBeUndefined();
  });

  it('appinstalled clears availability and notifies subscribers, even without a prompt() call', () => {
    const win = new FakeWindow();
    const installPrompt = createInstallPrompt(win);
    win.dispatch('beforeinstallprompt', fakeInstallEvent());
    expect(installPrompt.isAvailable()).toBe(true);

    const listener = vi.fn();
    installPrompt.onAvailability(listener);
    win.dispatch('appinstalled', undefined);

    expect(installPrompt.isAvailable()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('stays unavailable forever on browsers that never fire beforeinstallprompt (Safari)', () => {
    const installPrompt = createInstallPrompt(new FakeWindow());
    expect(installPrompt.isAvailable()).toBe(false);
  });
});
