// Rewrites dist/manifest.webmanifest's start_url and icon paths for a non-root BASE_PATH deploy
// (e.g. a GitHub Pages project site). No-op when BASE_PATH is unset/root -- Vite's verbatim copy
// of the untouched public/manifest.webmanifest is already correct for that case (TKT-0007).
//
// Runs as the second step of `npm run build` -- see package.json.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withBasePath } from '../sw/manifest-utils.mjs';

const basePath = process.env.BASE_PATH || '/';

if (basePath === '/') {
  console.log('apply-base-path: BASE_PATH is "/", nothing to rewrite');
} else {
  const manifestPath = join(process.cwd(), process.env.OUT_DIR || 'dist', 'manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.start_url = withBasePath(basePath, manifest.start_url);
  for (const icon of manifest.icons) icon.src = withBasePath(basePath, icon.src);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`apply-base-path: rewrote ${manifestPath} for base path ${basePath}`);
}
