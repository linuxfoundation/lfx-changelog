// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ContributorWithRelations } from '@lfx-changelog/shared';

/** Paginated contributor list state held by the admin Contributors page. */
export interface ContributorPageState {
  contributors: ContributorWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
