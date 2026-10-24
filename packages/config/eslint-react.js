// Shared ESLint flat config for React packages (ui, web).
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import base from './eslint.js';

// Design system rule (docs/specs/m0d-design-system.md): styles come from tokens only.
const HEX = '#[0-9a-fA-F]{3,8}\\b';
const MAGIC_SIZE = '-\\[(calc\\()?-?[0-9.]+(px|rem|em|vh|vw|%)';
// Tailwind's default palette is removed from the theme: these classes silently do nothing.
const DEFAULT_PALETTE =
  '\\b(bg|text|border|ring|fill|stroke|outline|from|via|to|shadow|divide|decoration|caret)-(black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\\b';
const tokensOnly = 'Use design tokens (Tailwind token classes), not hex colors or arbitrary sizes.';

export default [
  ...base,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${HEX}/]`, message: tokensOnly },
        { selector: `TemplateElement[value.raw=/${HEX}/]`, message: tokensOnly },
        { selector: `Literal[value=/${MAGIC_SIZE}/]`, message: tokensOnly },
        { selector: `TemplateElement[value.raw=/${MAGIC_SIZE}/]`, message: tokensOnly },
        { selector: `Literal[value=/${DEFAULT_PALETTE}/]`, message: tokensOnly },
        { selector: `TemplateElement[value.raw=/${DEFAULT_PALETTE}/]`, message: tokensOnly },
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'No inline styles: use token classes or a utility in packages/ui styles.',
        },
      ],
    },
  },
];
