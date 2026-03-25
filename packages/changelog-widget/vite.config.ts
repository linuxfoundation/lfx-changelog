// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LfxChangelog',
      fileName: (format) => `lfx-changelog.${format === 'umd' ? 'umd.cjs' : 'es.js'}`,
      formats: ['es', 'umd'],
    },
    minify: 'esbuild',
    sourcemap: true,
  },
});
