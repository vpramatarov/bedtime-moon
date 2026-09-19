import { describe, it, expect, vi } from 'vitest';
import {
  CACHE_PREFIX,
  cacheNameFor,
  createActivateHandler,
  createFetchResponder,
  createInstallHandler,
  type CacheLike,
  type CacheStorageLike,
  type PrecacheManifest,
} from '../src/pwa/sw-logic';

/** Normalizes a string or Request to a comparable key, mirroring how the real Cache API resolves relative and absolute URLs to the same entry. */
function toKey(input: RequestInfo): string {
  const raw = typeof input === 'string' ? input : input.url;
  return new URL(raw, 'https://bedtime-moon.invalid').pathname;
}

class FakeCache implements CacheLike {
  readonly store = new Map<string, Response>();

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) this.store.set(toKey(url), new Response(`body:${url}`));
  }

  async match(request: RequestInfo): Promise<Response | undefined> {
    return this.store.get(toKey(request));
  }
}

class FakeCacheStorage implements CacheStorageLike {
  readonly caches = new Map<string, FakeCache>();

  async open(name: string): Promise<CacheLike> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

const manifest: PrecacheManifest = {
  version: 'abc123',
  urls: ['/index.html', '/assets/index.js', '/frames/moon-00.webp'],
};

describe('cacheNameFor', () => {
  it('prefixes the version with the shared cache prefix', () => {
    expect(cacheNameFor('abc123')).toBe(`${CACHE_PREFIX}abc123`);
  });
});

describe('AC #5 — install handler', () => {
  it('opens the exact versioned cache name and addAlls every manifest url', async () => {
    const cachesApi = new FakeCacheStorage();
    const install = createInstallHandler(manifest, cachesApi);

    await install();

    const cache = cachesApi.caches.get(cacheNameFor('abc123'));
    expect(cache).toBeDefined();
    for (const url of manifest.urls) {
      await expect(cache!.match(url)).resolves.toBeDefined();
    }
  });
});

describe('AC #5 — activate handler', () => {
  it("deletes every bedtime-moon-* cache except the current version, and never touches an unrelated cache name", async () => {
    const cachesApi = new FakeCacheStorage();
    await cachesApi.open(cacheNameFor('old-1'));
    await cachesApi.open(cacheNameFor('old-2'));
    await cachesApi.open(cacheNameFor('abc123'));
    await cachesApi.open('some-other-apps-cache');

    const activate = createActivateHandler(manifest, cachesApi);
    await activate();

    const remaining = await cachesApi.keys();
    expect(remaining.sort()).toEqual([cacheNameFor('abc123'), 'some-other-apps-cache'].sort());
  });
});

describe('AC #4 — fetch responder', () => {
  it('returns the cached response on a hit without calling fetchFn', async () => {
    const cachesApi = new FakeCacheStorage();
    await createInstallHandler(manifest, cachesApi)();
    const fetchFn = vi.fn();

    const respond = createFetchResponder(manifest, cachesApi, fetchFn);
    const response = await respond(new Request('https://bedtime-moon.invalid/index.html'));

    expect(await response.text()).toBe('body:/index.html');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('calls fetchFn unmodified on a miss -- offline plus uncached surfaces the browser\'s own error, by design', async () => {
    const cachesApi = new FakeCacheStorage();
    await createInstallHandler(manifest, cachesApi)();
    const networkResponse = new Response('from network');
    const fetchFn = vi.fn().mockResolvedValue(networkResponse);
    const request = new Request('https://bedtime-moon.invalid/not-precached.json');

    const respond = createFetchResponder(manifest, cachesApi, fetchFn);
    const response = await respond(request);

    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(response).toBe(networkResponse);
  });
});
