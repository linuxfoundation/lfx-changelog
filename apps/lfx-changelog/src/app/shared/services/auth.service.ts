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

  /** Product IDs the user has editor+ access to. Empty for unauthenticated users. Super admins use isSuperAdmin() instead. */
  public readonly accessibleProductIds = computed(() => {
    const roles = this.dbUser()?.roles;
    if (!roles || this.isSuperAdmin()) return [];
    return roles.filter((r) => r.productId !== null).map((r) => r.productId as string);
  });

  /** Whether the user can write (edit/publish/delete) changelogs for a given product. */
  public canEditProduct(productId: string): boolean {
    return this.isSuperAdmin() || this.accessibleProductIds().includes(productId);
  }
}
