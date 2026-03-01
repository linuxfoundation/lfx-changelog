// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import { serverLogger } from '../server-logger';
import { ApiKeyService } from '../services/api-key.service';
import { UserService } from '../services/user.service';

const apiKeyService = new ApiKeyService();
const userService = new UserService();

/**
 * Extracts an API key from the request if present.
 * Checks `Authorization: Bearer lfx_...` and `X-API-Key: lfx_...` headers.
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer lfx_')) {
    return authHeader.slice(7); // Remove "Bearer " prefix
  }

  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.startsWith('lfx_')) {
    return xApiKey;
  }

  return null;
}

/**
 * Hybrid authentication middleware that supports both API key and OAuth (OIDC) authentication.
 *
 * - If an API key is detected: validates it and attaches `dbUser`, `apiKey`, and `authMethod: 'api_key'`
 * - If no API key: falls through to OIDC session-based auth (existing behavior)
 */
export function hybridAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawKey = extractApiKey(req);

  if (rawKey) {
    apiKeyService
      .validateKey(rawKey)
      .then(({ apiKey, user }) => {
        req.dbUser = user;
        req.apiKey = apiKey;
        req.authMethod = 'api_key';
        next();
      })
      .catch((error: unknown) => {
        next(error);
      });
    return;
  }

  // Fall through to OIDC auth
  if (!req.oidc?.isAuthenticated()) {
    next(new AuthenticationError('Authentication required', { path: req.path }));
    return;
  }

  const auth0User = req.oidc.user;
  if (!auth0User?.['sub'] || !auth0User['email']) {
    next(new AuthenticationError('Invalid authentication context', { path: req.path }));
    return;
  }

  userService
    .findByEmail(auth0User['email'])
    .then((dbUser) => {
      req.dbUser = dbUser;
      req.authMethod = 'oauth';
      next();
    })
    .catch((error: unknown) => {
      serverLogger.error({ err: error }, 'Failed to look up user from Auth0');
      next(error);
    });
}
