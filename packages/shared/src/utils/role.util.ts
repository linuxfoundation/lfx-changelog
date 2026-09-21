// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ROLE_HIERARCHY } from '../constants/role-hierarchy.constant.js';
import { UserRole } from '../enums/user-role.enum.js';
import type { UserRoleAssignment } from '../schemas/user.schema.js';

/**
 * Structural rather than the zod-inferred `UserRoleAssignment`: Prisma generates `role` as a
 * string-literal union while the shared enum is a TS enum, so a nominal type here forces every
 * server caller into a cast. This keeps that cast in one place.
 */
type RoleAssignment = { role: string; productId: string | null };

/**
 * Whether any assignment meets `requiredRole`, optionally for a specific product.
 *
 * A super admin always qualifies. An assignment with a null `productId` is a global grant of that
 * role and satisfies any product. Omitting `productId` asks only about the global hierarchy and
 * ignores product scoping entirely — do not use it to authorize a product-scoped action.
 */
export function hasMinimumRole(assignments: RoleAssignment[], requiredRole: UserRole, productId?: string): boolean {
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return assignments.some((assignment) => {
    const assignmentLevel = ROLE_HIERARCHY[assignment.role as UserRole];
    if (assignmentLevel === undefined) return false;
    if (assignmentLevel >= ROLE_HIERARCHY[UserRole.SUPER_ADMIN]) return true;
    if (productId !== undefined && assignment.productId !== null && assignment.productId !== productId) return false;

    return assignmentLevel >= requiredLevel;
  });
}

/** Whether the caller administers a product, and so may act on what that product owns. */
export function canAdministerProduct(assignments: RoleAssignment[], productId: string): boolean {
  return hasMinimumRole(assignments, UserRole.PRODUCT_ADMIN, productId);
}

/**
 * Products the caller administers, for filtering a list rather than checking one resource.
 * Null means every product — a super admin, or a product_admin granted without a product scope.
 */
export function administeredProductIds(assignments: RoleAssignment[]): string[] | null {
  if (assignments.some((assignment) => assignment.role === UserRole.SUPER_ADMIN)) {
    return null;
  }

  const minimumLevel = ROLE_HIERARCHY[UserRole.PRODUCT_ADMIN];
  const administered = assignments.filter((assignment) => {
    const assignmentLevel = ROLE_HIERARCHY[assignment.role as UserRole];
    return assignmentLevel !== undefined && assignmentLevel >= minimumLevel;
  });

  if (administered.some((assignment) => assignment.productId === null)) {
    return null;
  }

  return administered.map((assignment) => assignment.productId as string);
}

export function getHighestRole(assignments: UserRoleAssignment[]): UserRole | null {
  if (assignments.length === 0) return null;

  return assignments.reduce((highest, current) => {
    return ROLE_HIERARCHY[current.role] > ROLE_HIERARCHY[highest.role] ? current : highest;
  }).role;
}
