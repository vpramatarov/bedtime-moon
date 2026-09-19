/**
 * Geolocation port (AC #4). Wraps the callback-based navigator.geolocation API in a Promise with
 * its own timeout, since getCurrentPosition can hang indefinitely when a permission prompt is
 * dismissed without an answer. Coordinates are rounded to 4 decimals (~11 m) — plenty for the
 * offline town-level direction word (TKT-0003); nothing more precise is ever sent anywhere.
 */

export interface GeolocationPort {
  request(): Promise<{ lat: number; lon: number }>;
}

interface GeolocationPositionLike {
  coords: { latitude: number; longitude: number };
}

interface GeolocationApiLike {
  getCurrentPosition(
    onSuccess: (position: GeolocationPositionLike) => void,
    onError: (error: unknown) => void,
    options?: { timeout?: number }
  ): void;
}

interface NavigatorLike {
  geolocation?: GeolocationApiLike;
}

const TIMEOUT_MS = 8_000;

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function createGeolocation(nav: NavigatorLike = defaultNavigator()): GeolocationPort {
  return {
    request(): Promise<{ lat: number; lon: number }> {
      const api = nav.geolocation;
      if (!api) return Promise.reject(new Error('geolocation unsupported'));

      return new Promise((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('geolocation timed out'));
        }, TIMEOUT_MS);

        api.getCurrentPosition(
          (position) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ lat: round(position.coords.latitude), lon: round(position.coords.longitude) });
          },
          (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
          { timeout: TIMEOUT_MS }
        );
      });
    },
  };
}

function defaultNavigator(): NavigatorLike {
  return typeof navigator === 'undefined' ? {} : (navigator as unknown as NavigatorLike);
}
