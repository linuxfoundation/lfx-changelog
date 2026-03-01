// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ApiKeyService } from '../services/api-key.service';

import type { ApiKey, ApiKeyScope as PrismaApiKeyScope } from '@prisma/client';

export class ApiKeyController {
  private readonly apiKeyService = new ApiKeyService();

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await this.apiKeyService.findByUserId(req.dbUser!.id);
      res.json({ success: true, data: keys.map((k) => this.mapApiKey(k)) });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, scopes, expiresInDays } = req.body;
      const result = await this.apiKeyService.create(req.dbUser!.id, { name, scopes, expiresInDays });
      res.status(201).json({
        success: true,
        data: {
          apiKey: this.mapApiKey(result.apiKey),
          rawKey: result.rawKey,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.apiKeyService.revoke(req.params['id'] as string, req.dbUser!.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  /** Map Prisma underscore enum to API colon-based scope. */
  private toApiScope(prismaScope: PrismaApiKeyScope): string {
    return prismaScope.replace('_', ':');
  }

  /** Strip keyHash and convert scopes for client-safe response. */
  private mapApiKey(
    apiKey: ApiKey
  ): Omit<ApiKey, 'keyHash' | 'scopes' | 'expiresAt' | 'lastUsedAt' | 'revokedAt' | 'createdAt'> & {
    scopes: string[];
    expiresAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  } {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash, ...result } = apiKey;
    return {
      ...result,
      scopes: result.scopes.map((s) => this.toApiScope(s)),
      expiresAt: result.expiresAt instanceof Date ? result.expiresAt.toISOString() : result.expiresAt,
      lastUsedAt: result.lastUsedAt instanceof Date ? result.lastUsedAt.toISOString() : result.lastUsedAt,
      revokedAt: result.revokedAt instanceof Date ? result.revokedAt.toISOString() : result.revokedAt,
      createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
    };
  }
}
