import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'src/api/generated'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // The mobile app of V2 reuses these folders: no browser or web-only code.
    files: ['src/{api,domain,i18n}/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(react-dom|react-router|react-native|expo)(-|/|$)',
              message: 'Portable folder: no web or mobile-only package (README §4.1).',
            },
            {
              regex: '^(\\.\\./)+(lib|features|components|routes|pages)(/|$)',
              message: 'Portable folder: no import from the web app (README §4.1).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'location',
          'history',
        ].map((name) => ({ name, message: 'Portable folder: no browser API (README §4.1).' })),
      ],
    },
  },
  {
    // Playwright journeys run in Node, and their fixtures' `use` is not React's.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  prettier,
);
