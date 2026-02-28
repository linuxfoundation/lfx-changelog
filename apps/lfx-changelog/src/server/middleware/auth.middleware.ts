// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import { serverLogger } from '../server-logger';
import { UserService } from '../services/user.service';

const userService = new UserService();

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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
      (req as any).dbUser = dbUser;
      next();
    })
    .catch((error: unknown) => {
      serverLogger.error({ err: error }, 'Failed to look up user from Auth0');
      next(error);
    });
}
