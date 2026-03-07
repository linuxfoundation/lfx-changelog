// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { SsrCookieService } from 'ngx-cookie-service-ssr';

import { AuthService } from '@services/auth.service';

/**
 * Adds credentials to API requests when the user is authenticated.
 *
 * In the browser, `withCredentials: true` is sufficient — the browser automatically
 * attaches cookies to same-origin requests. Manually setting the Cookie header would
 * cause Fetch API errors because decoded cookie values may contain non-ISO-8859-1
 * characters (e.g. from Auth0 session data), which the Fetch spec rejects.
 *
 * In SSR (Node.js), there is no native cookie jar, so we must manually forward the
 * incoming request's cookies to outgoing API calls.
 */
export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const cookieService = inject(SsrCookieService);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if ((req.url.startsWith('/api/') || req.url.startsWith('/public/api/')) && authService.authenticated()) {
    if (isPlatformBrowser(platformId)) {
      return next(req.clone({ withCredentials: true }));
    }

    // SSR: manually forward cookies from the incoming request
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
