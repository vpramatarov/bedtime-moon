import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Bundles the service worker as a single classic script (IIFE), not an ES module -- Safari has
// no module-service-worker support. A second build target reusing Vite (already a dependency),
// run after scripts/sw/generate-manifest.mjs so sw-entry.ts's virtual manifest import resolves to
// real (gitignored, build-time-only) data -- see src/pwa/virtual-precache-manifest.d.ts.
export default defineConfig({
  resolve: {
    alias: {
      'virtual:precache-manifest': fileURLToPath(
        new URL('./src/pwa/precache-manifest.generated.json', import.meta.url),
      ),
    },
  },
  publicDir: false, // this pass only builds one JS file; without this it re-copies public/ and
  // clobbers apply-base-path.mjs's already-rewritten dist/manifest.webmanifest (TKT-0007)
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/pwa/sw-entry.ts',
      formats: ['iife'],
      name: 'BedtimeMoonSW',
      fileName: () => 'sw.js',
    },
  },
});
