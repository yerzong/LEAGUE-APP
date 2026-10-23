// Shared Vitest base config. Packages merge it with mergeConfig().
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
