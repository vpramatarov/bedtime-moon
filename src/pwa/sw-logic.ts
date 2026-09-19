/**
 * Pure service worker logic — install/activate/fetch handlers, testable in jsdom (no `self`,
 * no real Cache Storage). sw-entry.ts is the thin glue that wires these to the real globals.
 */

export interface PrecacheManifest {
  readonly version: string;
  readonly urls: readonly string[];
}

export interface CacheLike {
  addAll(urls: string[]): Promise<void>;
  match(request: RequestInfo): Promise<Response | undefined>;
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export const CACHE_PREFIX = 'bedtime-moon-';

export function cacheNameFor(version: string): string {
  return `${CACHE_PREFIX}${version}`;
}

/** Precaches every manifest URL into a version-named cache (AC #3). */
export function createInstallHandler(manifest: PrecacheManifest, cachesApi: CacheStorageLike): () => Promise<void> {
  return async () => {
    const cache = await cachesApi.open(cacheNameFor(manifest.version));
    await cache.addAll([...manifest.urls]);
  };
}

/** Drops every prior versioned cache so an update takes over cleanly (AC #5). Never touches a non-`bedtime-moon-*` cache. */
export function createActivateHandler(manifest: PrecacheManifest, cachesApi: CacheStorageLike): () => Promise<void> {
  return async () => {
    const current = cacheNameFor(manifest.version);
    const names = await cachesApi.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== current).map((name) => cachesApi.delete(name)),
    );
  };
}

/**
 * Cache-first. On a miss, falls through to `fetchFn` unmodified -- offline plus uncached is
 * deliberately left to surface the browser's own network-error page (no fallback shell, per the
 * ticket's decided edge case) (AC #4).
 */
export function createFetchResponder(
  manifest: PrecacheManifest,
  cachesApi: CacheStorageLike,
  fetchFn: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const cache = await cachesApi.open(cacheNameFor(manifest.version));
    const cached = await cache.match(request);
    if (cached) return cached;
    return fetchFn(request);
  };
}
