// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ChangelogStatus } from '../enums/changelog-status.enum.js';
import type { UserRole } from '../enums/user-role.enum.js';

export interface CreateChangelogEntryRequest {
  productId: string;
  title: string;
  description: string;
  version: string;
  status: ChangelogStatus;
}

export interface UpdateChangelogEntryRequest {
  title?: string;
  description?: string;
  version?: string;
  status?: ChangelogStatus;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  faIcon?: string;
}

export interface UpdateProductRequest {
  name?: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  faIcon?: string;
}

export interface AssignRoleRequest {
  userId: string;
  productId: string | null;
  role: UserRole;
}
