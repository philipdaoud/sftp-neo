const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  // Equivalent of the old `ignorePatterns` / `.eslintignore`.
  // `*.d.ts` are vendored/ambient type declarations, not source to lint.
  {
    ignores: ['dist/', 'node_modules/', 'test/', '__mocks__/', '**/*.d.ts'],
  },
  // Lint TypeScript sources only (was `eslint src --ext .ts`).
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended, // was `eslint:recommended`
      ...tseslint.configs.recommended, // was `plugin:@typescript-eslint/recommended`
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-var-requires': 'off',
    },
  }
);
