import type { UserRole } from '../enums/user-role.enum.js';

export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  roles: UserRoleAssignment[];
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  productId: string | null;
  role: UserRole;
}
