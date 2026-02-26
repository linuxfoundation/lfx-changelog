// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ChangelogStatus } from '../enums/changelog-status.enum.js';
import type { Product } from './product.interface.js';
import type { User } from './user.interface.js';

export interface ChangelogEntry {
  id: string;
  productId: string;
  title: string;
  description: string;
  version: string;
  status: ChangelogStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogEntryWithRelations extends ChangelogEntry {
  product?: Product;
  author?: User;
}
