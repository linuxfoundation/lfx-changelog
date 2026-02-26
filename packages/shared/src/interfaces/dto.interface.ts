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

export interface AssignRoleRequest {
  userId: string;
  productId: string | null;
  role: UserRole;
}
