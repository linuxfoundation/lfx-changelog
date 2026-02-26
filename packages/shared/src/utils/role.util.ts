import { ROLE_HIERARCHY } from '../constants/role-hierarchy.constant.js';
import { UserRole } from '../enums/user-role.enum.js';
import type { UserRoleAssignment } from '../interfaces/user.interface.js';

export function hasMinimumRole(assignments: UserRoleAssignment[], requiredRole: UserRole, productId?: string): boolean {
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return assignments.some((assignment) => {
    const assignmentLevel = ROLE_HIERARCHY[assignment.role];
    if (assignmentLevel >= ROLE_HIERARCHY[UserRole.SUPER_ADMIN]) {
      return true;
    }
    if (productId && assignment.productId !== productId) {
      return false;
    }
    return assignmentLevel >= requiredLevel;
  });
}

export function getHighestRole(assignments: UserRoleAssignment[]): UserRole | null {
  if (assignments.length === 0) return null;

  return assignments.reduce((highest, current) => {
    return ROLE_HIERARCHY[current.role] > ROLE_HIERARCHY[highest.role] ? current : highest;
  }).role;
}
