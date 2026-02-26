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
    .findOrCreateByAuth0({
      sub: auth0User['sub'],
      email: auth0User['email'],
      name: auth0User['name'] || auth0User['email'],
      picture: auth0User['picture'],
    })
    .then((dbUser) => {
      (req as any).dbUser = dbUser;
      next();
    })
    .catch((error: unknown) => {
      serverLogger.error({ err: error }, 'Failed to sync user from Auth0');
      next(error);
    });
}
