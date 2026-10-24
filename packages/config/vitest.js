// Shared Vitest base config. Packages merge it with mergeConfig().
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Per-package cache: packages run in parallel under Turbo and must not share one.
  cacheDir: 'node_modules/.vite',
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    passWithNoTests: false,
  },
});
