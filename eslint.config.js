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
    },
  },
]);
