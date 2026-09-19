// Walks dist/ after the first Vite build (before dist/sw.js exists) and writes the service
// worker's precache manifest: every emitted URL, versioned by a hash of their actual bytes so an
// unchanged redeploy doesn't force a spurious cache-bust (AC #3, AC #5).
//
// Runs as the middle step of `npm run build` -- see package.json.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSizeBudget, hashManifest, toUrlPath, withBasePath } from './manifest-utils.mjs';

const MAX_PRECACHE_BYTES = 8 * 1024 * 1024;
const basePath = process.env.BASE_PATH || '/'; // TKT-0007 -- matches vite.config.ts's `base`

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distRoot = join(root, 'dist');
const outPath = join(root, 'src', 'pwa', 'precache-manifest.generated.json');

const entries = await readdir(distRoot, { withFileTypes: true, recursive: true });
const files = [];
for (const entry of entries) {
  if (!entry.isFile()) continue;
  const absPath = join(entry.parentPath ?? entry.path, entry.name);
  const urlPath = withBasePath(basePath, toUrlPath(distRoot, absPath));
  if (urlPath === withBasePath(basePath, '/sw.js')) continue; // doesn't exist at this point in the pipeline; stay explicit anyway
  files.push({ urlPath, bytes: await readFile(absPath) });
}

const totalBytes = files.reduce((sum, file) => sum + file.bytes.length, 0);
checkSizeBudget(totalBytes, MAX_PRECACHE_BYTES);

const manifest = {
  version: hashManifest(files),
  urls: files.map((file) => file.urlPath).sort(),
};
await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `wrote ${outPath}: version ${manifest.version}, ${manifest.urls.length} urls, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB / 8 MiB`,
);
