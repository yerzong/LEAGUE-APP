import base from '@league/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({ resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } } }),
);
