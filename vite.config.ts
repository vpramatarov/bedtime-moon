import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Pin so "local time" math (test/nights.test.ts) is deterministic across dev machines and CI --
    // without this, the same date fixture can resolve a different nearest-frame per runner TZ.
    env: { TZ: 'UTC' },
  },
});
