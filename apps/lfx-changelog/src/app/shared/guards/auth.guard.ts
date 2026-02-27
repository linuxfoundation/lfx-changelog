// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@services/auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Authentication check — browser only (SSR can't redirect to Express /login route)
  if (isPlatformBrowser(platformId) && !authService.authenticated()) {
    const returnTo = encodeURIComponent(state.url);
    window.location.href = `/login?returnTo=${returnTo}`;
    return false;
  }

  // Role check — works on both SSR and client via Angular router
  const roles = authService.dbUser()?.roles;
  if (!roles || roles.length === 0) {
    return router.createUrlTree(['/']);
  }

  return true;
};
