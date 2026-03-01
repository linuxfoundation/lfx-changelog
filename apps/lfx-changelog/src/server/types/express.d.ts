// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ApiKey, User, UserRoleAssignment } from '@prisma/client';

/**
 * Extends the Express Request interface with custom properties set by our middleware.
 *
 * - `dbUser` / `apiKey` / `authMethod` — set by `hybridAuthMiddleware`
 * - `resolvedProductId` — set by `authorize({ resolveProductId: true })`
 */
declare module 'express-serve-static-core' {
  interface Request {
    /** Authenticated user from DB. Set by hybridAuthMiddleware. */
    dbUser?: (User & { userRoleAssignments?: UserRoleAssignment[] }) | null;
    /** API key record when authenticated via API key. Set by hybridAuthMiddleware. */
    apiKey?: ApiKey;
    /** How the request was authenticated. Set by hybridAuthMiddleware. */
    authMethod?: 'api_key' | 'oauth';
    /** Product ID resolved from a changelog entry's :id param. Set by authorize middleware. */
    resolvedProductId?: string;
  }
}
