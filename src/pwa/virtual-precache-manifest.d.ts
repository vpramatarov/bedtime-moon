// The generated manifest is gitignored build output (scripts/sw/generate-manifest.mjs writes it
// fresh every build), so sw-entry.ts imports it through this virtual specifier instead of a
// relative path -- TypeScript only honors ambient `declare module` shims reliably for
// non-relative specifiers, and this way `tsc` never needs the file to exist on disk.
// vite.sw.config.ts aliases the specifier to the real file for the actual bundle.
declare module 'virtual:precache-manifest' {
  import type { PrecacheManifest } from './sw-logic';
  const manifest: PrecacheManifest;
  export default manifest;
}
