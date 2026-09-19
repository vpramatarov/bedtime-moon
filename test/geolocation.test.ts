import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGeolocation } from '../src/platform/geolocation';

afterEach(() => vi.useRealTimers());

function fakeNavigator(
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    error: (error: unknown) => void
  ) => void
) {
  return { geolocation: { getCurrentPosition } };
}

describe('AC #4 — geolocation port: rounded coordinates, rejects rather than throwing', () => {
  it('resolves with coordinates rounded to 4 decimals', async () => {
    const nav = fakeNavigator((success) => {
      success({ coords: { latitude: 42.123456789, longitude: 23.987654321 } });
    });
    const geolocation = createGeolocation(nav);
    await expect(geolocation.request()).resolves.toEqual({ lat: 42.1235, lon: 23.9877 });
  });

  it('rejects when permission is denied', async () => {
    const nav = fakeNavigator((_success, error) => {
      error(new Error('User denied Geolocation'));
    });
    const geolocation = createGeolocation(nav);
    await expect(geolocation.request()).rejects.toThrow('User denied Geolocation');
  });

  it('rejects rather than throwing when navigator.geolocation is missing', async () => {
    const geolocation = createGeolocation({});
    await expect(geolocation.request()).rejects.toThrow();
  });

  it('rejects after 8 seconds when getCurrentPosition never calls back', async () => {
    vi.useFakeTimers();
    const nav = fakeNavigator(() => {
      /* permission prompt left open forever */
    });
    const geolocation = createGeolocation(nav);
    const assertion = expect(geolocation.request()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });
});
