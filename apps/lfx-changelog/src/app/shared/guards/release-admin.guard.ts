// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '@lfx-changelog/shared';
import { AuthService } from '@services/auth.service';

import type { CanActivateFn } from '@angular/router';

export const releaseAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const roles = authService.dbUser()?.roles;
  if (roles?.some((role) => role.role === UserRole.SUPER_ADMIN || role.role === UserRole.PRODUCT_ADMIN)) {
    return true;
  }
  return router.createUrlTree(['/admin']);
};
