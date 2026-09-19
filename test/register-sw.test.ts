import { describe, it, expect, vi } from 'vitest';
import { registerServiceWorker } from '../src/pwa/register-sw';

describe('AC #3, #5 — service worker registration', () => {
  it('registers /sw.js when both isProd and hasSupport are true', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    registerServiceWorker({ isProd: true, hasSupport: true, register });
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does nothing outside production', () => {
    const register = vi.fn();
    registerServiceWorker({ isProd: false, hasSupport: true, register });
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no serviceWorker support', () => {
    const register = vi.fn();
    registerServiceWorker({ isProd: true, hasSupport: false, register });
    expect(register).not.toHaveBeenCalled();
  });

  it('never throws even when registration itself rejects', async () => {
    const register = vi.fn().mockRejectedValue(new Error('nope'));
    expect(() => registerServiceWorker({ isProd: true, hasSupport: true, register })).not.toThrow();
    await Promise.resolve();
  });

  it('registers under a non-root base path when one is given (TKT-0007)', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    registerServiceWorker({ isProd: true, hasSupport: true, register, basePath: '/base-test/' });
    expect(register).toHaveBeenCalledWith('/base-test/sw.js');
  });
});
