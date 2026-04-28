const expoConfig = require('eslint-config-expo/flat/default');
const prettierConfig = require('eslint-config-prettier');
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'build/**',
      'coverage/**',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'i18n-js',
              message: "Please import from 'src/i18n' instead to ensure type safety.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/i18n/index.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', '*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      '**/__tests__/**/*',
      '**/*.test.*',
      '**/*.spec.*',
      'jest.setup.js',
      'jest.integration.setup.js',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'react/display-name': 'off',
      // Common in Jest tests for module isolation and inline mock factories.
      '@typescript-eslint/no-require-imports': 'off',
      // Tests often intentionally place imports after mock setup.
      'import/first': 'off',
      // In tests, mocked navigation hooks often delegate callbacks indirectly.
      'react-hooks/exhaustive-deps': 'off',
      // Tests often need `any` for mocking and type overrides.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
