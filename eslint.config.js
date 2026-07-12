// ESLint flat config (WS4-05, F-28). Lint gate runs in ci.yml's typecheck job.
// Kept deliberately small: typescript-eslint recommended + the two rules the
// constitution names (no-var §IV.2; no stray console output in shipped code).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'functions/lib/**',
      '**/node_modules/**',
      '.emulator-data/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-var': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Node CLI tools (seeding, role grants) and root config files: console
    // output is their UI, and they run under Node globals.
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  }
);
