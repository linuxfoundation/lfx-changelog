// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { NextFunction, Request, Response } from 'express';

/** Derives the allowed origin from the BASE_URL env var (falls back to localhost for dev). */
const ALLOWED_ORIGIN = (process.env['BASE_URL'] || 'http://localhost:4204').replace(/\/+$/, '');

function isAllowedOrigin(origin: string): boolean {
  return origin === ALLOWED_ORIGIN;
}

function isAllowedReferer(referer: string): boolean {
  try {
    const url = new URL(referer);
    return url.origin === ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Middleware that restricts access to same-origin requests only.
 *
 * Uses three layers of validation:
 * 1. `Sec-Fetch-Site` — set by modern browsers, cannot be spoofed by client-side JS.
 *    Rejects anything other than `same-origin` or `none` (direct navigation).
 * 2. `Origin` header — always sent by browsers on POST/PUT/DELETE. Must match
 *    one of the allowed UI domains.
 * 3. `Referer` header — fallback for GET requests where `Origin` may not be sent.
 *
 * If none of these headers are present (e.g. curl without spoofing), the request
 * is rejected. This raises the bar significantly against non-browser callers.
 */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction): void {
  const secFetchSite = req.headers['sec-fetch-site'] as string | undefined;
  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;

  // 1. Sec-Fetch-Site: strongest signal — browser-set, not spoofable by JS.
  //    `same-origin` = same domain, `none` = direct browser navigation (e.g. typing URL).
  if (secFetchSite) {
    if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
      next();
      return;
    }
    // cross-site, cross-origin, or any other value → block
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  // 2. Origin header: sent on POST/PUT/DELETE by all browsers.
  if (origin) {
    if (isAllowedOrigin(origin)) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  // 3. Referer header: fallback for GET requests from the app.
  if (referer) {
    if (isAllowedReferer(referer)) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  // No browser signals at all — likely a script/curl call. Block it.
  res.status(403).json({ success: false, error: 'Forbidden' });
}
