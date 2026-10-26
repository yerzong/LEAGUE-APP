import { fileURLToPath } from 'node:url';

import base from '@league/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  // fileURLToPath decodes the path (URL.pathname keeps spaces as %20).
  defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } }),
);
