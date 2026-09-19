// Pure helpers for building the service worker's precache manifest. No file I/O here — see
// generate-manifest.mjs for the CLI that walks dist/ and calls these.

import { createHash } from 'node:crypto';
import { relative, sep } from 'node:path';

/** Absolute path under distRoot -> a clean leading-slash URL path (POSIX separators, any OS). */
export function toUrlPath(distRoot, absPath) {
  const rel = relative(distRoot, absPath).split(sep).join('/');
  return `/${rel}`;
}

/**
 * Deterministic version string for a set of precached files. Depends only on each file's actual
 * bytes (and which urlPath they're served at) -- sorted by urlPath first so OS-dependent
 * directory-walk order never changes the result. An unchanged redeploy therefore reuses the same
 * cache name; a single changed byte anywhere busts it.
 */
export function hashManifest(files) {
  const sorted = [...files].sort((a, b) => (a.urlPath < b.urlPath ? -1 : a.urlPath > b.urlPath ? 1 : 0));
  const hash = createHash('sha256');
  for (const file of sorted) {
    hash.update(file.urlPath);
    hash.update(file.bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

/** Prefixes a leading-slash root-relative path with basePath (itself leading+trailing slash, e.g.
 *  '/' or '/mishi/'). Identity when basePath is '/' (TKT-0007). */
export function withBasePath(basePath, rootRelativePath) {
  return basePath + rootRelativePath.slice(1);
}

/** Throws if the total precache size exceeds the budget (AC #3) -- a build-time guard, not a manual eyeball. */
export function checkSizeBudget(totalBytes, maxBytes) {
  if (totalBytes > maxBytes) {
    throw new Error(`precache size ${totalBytes} bytes exceeds the ${maxBytes} byte budget`);
  }
}
