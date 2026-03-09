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
  public readonly accessibleProductIds = computed(() => {
    const roles = this.dbUser()?.roles;
    if (!roles || this.isSuperAdmin()) return [];
    return roles.filter((r) => r.productId !== null).map((r) => r.productId as string);
  });
}
