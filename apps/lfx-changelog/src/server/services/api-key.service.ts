// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { API_KEY_SCOPES, ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';
import { ApiKeyScope as PrismaApiKeyScope, User } from '@prisma/client';
import crypto from 'node:crypto';

import { AuthenticationError, AuthorizationError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { ApiKeyScope } from '@lfx-changelog/shared';
import type { ApiKey, UserRoleAssignment } from '@prisma/client';

const MAX_ACTIVE_KEYS_PER_USER = 10;
const KEY_PREFIX = 'lfx_';

/** Map TypeScript colon-based scope to Prisma underscore enum. */
function toPrismaScope(scope: ApiKeyScope): PrismaApiKeyScope {
  return scope.replaceAll(':', '_') as PrismaApiKeyScope;
}

/** Map Prisma underscore enum to TypeScript colon-based scope. */
function toApiScope(prismaScope: PrismaApiKeyScope): ApiKeyScope {
  return prismaScope.replaceAll('_', ':') as ApiKeyScope;
}

export class ApiKeyService {
  public async create(
    userId: string,
    data: { name: string; scopes: ApiKeyScope[]; expiresInDays: number },
    userRoles: UserRoleAssignment[]
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const prisma = getPrismaClient();

    // Validate that the user's highest role meets the minimumRole for every requested scope
    this.validateScopePermissions(data.scopes, userRoles);

    const activeCount = await prisma.apiKey.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    if (activeCount >= MAX_ACTIVE_KEYS_PER_USER) {
      throw new AuthorizationError(`Maximum of ${MAX_ACTIVE_KEYS_PER_USER} active API keys per user`, {
        operation: 'create',
        service: 'api-key',
      });
    }

    const rawBytes = crypto.randomBytes(48);
    const rawKey = KEY_PREFIX + rawBytes.toString('base64url');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name: data.name,
        keyPrefix,
        keyHash,
        scopes: data.scopes.map(toPrismaScope),
        expiresAt,
      },
    });

    serverLogger.info({ userId, keyId: apiKey.id, scopes: data.scopes }, 'API key created');

    return { apiKey, rawKey };
  }

  public async findByUserId(userId: string): Promise<ApiKey[]> {
    const prisma = getPrismaClient();
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async revoke(keyId: string, userId: string): Promise<ApiKey> {
    const prisma = getPrismaClient();

    const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!apiKey) {
      throw new NotFoundError(`API key not found: ${keyId}`, { operation: 'revoke', service: 'api-key' });
    }

    if (apiKey.userId !== userId) {
      throw new AuthorizationError("Cannot revoke another user's API key", { operation: 'revoke', service: 'api-key' });
    }

    if (apiKey.revokedAt) {
      return apiKey;
    }

    const revoked = await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    serverLogger.info({ userId, keyId }, 'API key revoked');
    return revoked;
  }

  public async validateKey(rawKey: string): Promise<{ apiKey: ApiKey; user: User }> {
    const prisma = getPrismaClient();

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { include: { userRoleAssignments: true } } },
    });

    if (!apiKey) {
      throw new AuthenticationError('Invalid API key');
    }

    if (apiKey.revokedAt) {
      throw new AuthenticationError('API key has been revoked');
    }

    if (apiKey.expiresAt < new Date()) {
      throw new AuthenticationError('API key has expired');
    }

    // Fire-and-forget update of lastUsedAt
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => serverLogger.warn({ err, keyId: apiKey.id }, 'Failed to update lastUsedAt'));

    const { user, ...keyWithoutUser } = apiKey;
    return { apiKey: keyWithoutUser as ApiKey, user };
  }

  public hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
    return apiKey.scopes.some((s) => toApiScope(s) === requiredScope);
  }

  /** Verify the user's highest role meets the minimumRole for every requested scope. */
  private validateScopePermissions(scopes: ApiKeyScope[], userRoles: UserRoleAssignment[]): void {
    const userHighestLevel = Math.max(...userRoles.map((a) => ROLE_HIERARCHY[a.role as UserRole] ?? 0), 0);

    for (const scope of scopes) {
      const scopeMeta = API_KEY_SCOPES.find((s) => s.scope === scope);
      if (!scopeMeta) {
        throw new AuthorizationError(`Unknown scope: ${scope}`, { operation: 'create', service: 'api-key' });
      }

      const requiredLevel = ROLE_HIERARCHY[scopeMeta.minimumRole];
      if (userHighestLevel < requiredLevel) {
        throw new AuthorizationError(`Insufficient role to create API key with scope '${scope}' (requires ${scopeMeta.minimumRole})`, {
          operation: 'create',
          service: 'api-key',
        });
      }
    }
  }
}
