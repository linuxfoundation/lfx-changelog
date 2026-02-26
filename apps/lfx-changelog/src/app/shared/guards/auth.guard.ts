import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { AuthService } from '@services/auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  if (authService.authenticated()) {
    return true;
  }

  const returnTo = encodeURIComponent(state.url);
  window.location.href = `/login?returnTo=${returnTo}`;
  return false;
};
