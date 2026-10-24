import base from '@league/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/__fixtures__/**', 'src/index.ts', 'src/types.ts'],
        reporter: ['text-summary', 'text'],
        // docs/specs/m01-core-engine.md: high coverage on the domain (≥ 90%).
        thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  }),
);
