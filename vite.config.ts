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
	// make test/nights.test.ts deterministic across dev machines and CI
	env: { TZ: 'UTC' }
  },
});
