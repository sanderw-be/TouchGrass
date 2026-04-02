const expoConfig = require('eslint-config-expo/flat/default');
const prettierConfig = require('eslint-config-prettier');
const { defineConfig } = require('eslint/config');
const globals = require('globals');

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
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*', 'jest.setup.js'],
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
    },
  },
]);
