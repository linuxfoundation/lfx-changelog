// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { RepositoryWithCounts } from '@lfx-changelog/shared';

export interface ProductGroup {
  productId: string;
  productName: string;
  productFaIcon: string | null;
  repos: RepositoryWithCounts[];
  totalReleases: number;
}
