// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

// Root ESLint flat config. Scoped narrowly to .github/scripts/**/*.js (the
// CommonJS helpers loaded by actions/github-script from CI workflows). The
// Angular application has its own self-contained config at
// apps/lfx-changelog/eslint.config.js.

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['.github/scripts/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
    },
  },
];
