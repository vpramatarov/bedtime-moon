/**
 * Chromium "install this PWA" prompt port (AC #4). Chrome/Edge fire `beforeinstallprompt` once,
 * synchronously, and require calling `.preventDefault()` right away to defer it for a later user
 * gesture — Safari and Firefox never fire it at all, so `isAvailable()` staying false forever there
 * is the expected, permanent answer, not a bug; the panel falls back to a static hint in that case.
 */

export interface InstallPromptPort {
  isAvailable(): boolean;
  prompt(): Promise<void>;
  /** Subscribe to availability changes; returns an unsubscribe function. */
  onAvailability(listener: (available: boolean) => void): () => void;
}

interface InstallEventLike {
  preventDefault(): void;
  prompt(): Promise<void>;
}

interface WindowLike {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export function createInstallPrompt(win: WindowLike = defaultWindow()): InstallPromptPort {
  let deferred: InstallEventLike | null = null;
  const listeners = new Set<(available: boolean) => void>();

  const notify = (available: boolean): void => {
    listeners.forEach((listener) => listener(available));
  };

  win.addEventListener('beforeinstallprompt', (event) => {
    const installEvent = event as unknown as InstallEventLike;
    installEvent.preventDefault();
    deferred = installEvent;
    notify(true);
  });

  win.addEventListener('appinstalled', () => {
    if (!deferred) return;
    deferred = null;
    notify(false);
  });

  return {
    isAvailable(): boolean {
      return deferred !== null;
    },
    async prompt(): Promise<void> {
      const event = deferred;
      if (!event) return;
      try {
        await event.prompt();
      } catch {
        /* dismissed or unsupported — nothing to do */
      } finally {
        deferred = null;
        notify(false);
      }
    },
    onAvailability(listener: (available: boolean) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function defaultWindow(): WindowLike {
  return typeof window === 'undefined'
    ? { addEventListener() {}, removeEventListener() {} }
    : (window as unknown as WindowLike);
}
