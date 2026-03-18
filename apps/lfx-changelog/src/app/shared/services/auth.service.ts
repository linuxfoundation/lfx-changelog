// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { computed, Injectable, signal } from '@angular/core';
import { UserRole } from '@lfx-changelog/shared';

import type { AuthUser, User } from '@lfx-changelog/shared';

@Injectable({ providedIn: 'root' })
export class AuthService {
  public readonly authenticated = signal(false);
  public readonly user = signal<AuthUser | null>(null);
  public readonly dbUser = signal<User | null>(null);

  public readonly isSuperAdmin = computed(() => this.dbUser()?.roles?.some((r) => r.role === UserRole.SUPER_ADMIN) ?? false);

  /** Whether the user has global access (super admin or a role with productId === null). */
  public readonly hasGlobalAccess = computed(() => {
    if (this.isSuperAdmin()) return true;
    const roles = this.dbUser()?.roles;
    return roles?.some((r) => r.productId === null && (r.role === UserRole.EDITOR || r.role === UserRole.PRODUCT_ADMIN)) ?? false;
  });

  /** Product IDs the user has editor+ access to. Empty for unauthenticated or global-access users. */
  public readonly accessibleProductIds = computed(() => {
    const roles = this.dbUser()?.roles;
    if (!roles || this.hasGlobalAccess()) return [];
    return roles.filter((r) => r.productId !== null).map((r) => r.productId as string);
  });

  /** Whether the user has any admin/editor role (global or product-scoped). */
  public readonly isAdmin = computed(() => this.hasGlobalAccess() || this.accessibleProductIds().length > 0);

  /** Whether the user can write (edit/publish/delete) changelogs for a given product. */
  public canEditProduct(productId: string): boolean {
    return this.hasGlobalAccess() || this.accessibleProductIds().includes(productId);
  }
}
