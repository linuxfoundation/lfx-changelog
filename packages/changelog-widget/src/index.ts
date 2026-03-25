// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { LfxChangelogElement } from './lfx-changelog.js';

export type { ChangelogApiResponse, ChangelogEntry, LfxChangelogAttributes } from './types.js';
export { LfxChangelogElement };

// Register the custom element (SSR-safe — only runs in browser)
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  if (!customElements.get('lfx-changelog')) {
    customElements.define('lfx-changelog', LfxChangelogElement);
  }
}
