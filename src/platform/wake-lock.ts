/**
 * Screen Wake Lock port (AC #10). Chrome 84+ / Safari 16.4+; the platform releases the lock
 * automatically when the page is hidden, so the scene re-requests it on every return to visible.
 * Unsupported or denied → silent no-op; the app must never depend on it.
 */

export interface WakeLockPort {
  request(): Promise<void>;
  release(): Promise<void>;
}

interface SentinelLike {
  release(): Promise<void>;
  readonly released?: boolean;
}

interface WakeLockApiLike {
  request(type: 'screen'): Promise<SentinelLike>;
}

export function createWakeLock(api: WakeLockApiLike | null = defaultApi()): WakeLockPort {
  let sentinel: SentinelLike | null = null;
  return {
    async request(): Promise<void> {
      if (!api) return;
      if (sentinel && sentinel.released !== true) return;
      try {
        sentinel = await api.request('screen');
      } catch {
        sentinel = null;
      }
    },
    async release(): Promise<void> {
      const held = sentinel;
      sentinel = null;
      if (!held) return;
      try {
        await held.release();
      } catch {
        /* already released or hidden — nothing to do */
      }
    },
  };
}

function defaultApi(): WakeLockApiLike | null {
  if (typeof navigator === 'undefined') return null;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApiLike }).wakeLock;
  return api ?? null;
}
