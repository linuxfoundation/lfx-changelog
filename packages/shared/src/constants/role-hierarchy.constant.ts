// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '../enums/user-role.enum.js';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.PRODUCT_ADMIN]: 50,
  [UserRole.EDITOR]: 10,
};
