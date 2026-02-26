// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SsrCookieService } from 'ngx-cookie-service-ssr';

import { AuthService } from '@services/auth/auth.service';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const cookieService = inject(SsrCookieService);
  const authService = inject(AuthService);

  if ((req.url.startsWith('/api/') || req.url.startsWith('/public/api/')) && authService.authenticated()) {
    const authenticatedReq = req.clone({
      withCredentials: true,
      headers: req.headers.append(
        'Cookie',
        Object.entries(cookieService.getAll())
          .map(([key, value]) => `${key}=${value}`)
          .join('; ')
      ),
    });

    return next(authenticatedReq);
  }

  return next(req);
};
