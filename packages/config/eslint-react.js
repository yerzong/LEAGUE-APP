// Shared ESLint flat config for React packages (ui, web).
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import base from './eslint.js';

export default [
  ...base,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
