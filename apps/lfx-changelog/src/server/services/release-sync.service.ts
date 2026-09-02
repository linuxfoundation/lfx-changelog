// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';
import { releasableCatalogService } from './releasable-catalog.service';
import { serverLogger } from '../server-logger';

import type { ReleasableServiceConfig } from './releasable-catalog.service';

const DISABLED_REASON =
  'Argo CD sync is disabled. Deploy apply is left to the cluster webhook.';

export function isArgocdSyncEnabled(): boolean {
  const raw = (process.env['RELEASE_ARGOCD_SYNC_ENABLED'] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export class ReleaseSyncService {
  public async requestSyncs(jobId: string, service: ReleasableServiceConfig): Promise<void> {
    const prisma = getPrismaClient();
    const appName = releasableCatalogService.argocdAppName(service);
    const enabled = isArgocdSyncEnabled();

    for (const environment of service.environments) {
      const existing = await prisma.environmentSync.findUnique({
        where: { jobId_environment: { jobId, environment } },
      });
      if (!existing) {
        await prisma.environmentSync.create({
          data: { jobId, environment, applicationName: appName },
        });
      }

      if (!enabled) {
        await prisma.environmentSync.update({
          where: { jobId_environment: { jobId, environment } },
          data: {
            requestStatus: 'skipped',
            requestError: DISABLED_REASON,
            requestedAt: new Date(),
          },
        });
        continue;
      }

      const result = await this.postSync(environment, appName);
      let requestStatus: 'accepted' | 'skipped' | 'failed' = 'failed';
      if (result.ok) {
        requestStatus = 'accepted';
      } else if (result.skipped) {
        requestStatus = 'skipped';
      }
      await prisma.environmentSync.update({
        where: { jobId_environment: { jobId, environment } },
        data: {
          requestStatus,
          requestError: result.error ?? null,
          requestedAt: new Date(),
        },
      });
    }
  }

  public async refreshStatus(jobId: string): Promise<void> {
    if (!isArgocdSyncEnabled()) {
      return;
    }
    const prisma = getPrismaClient();
    const rows = await prisma.environmentSync.findMany({ where: { jobId } });
    for (const row of rows) {
      const status = await this.getApplication(row.environment, row.applicationName);
      await prisma.environmentSync.update({
        where: { id: row.id },
        data: {
          lastSyncStatus: status.syncStatus,
          lastHealth: status.health,
          lastRefreshedAt: new Date(),
        },
      });
    }
  }

  private async postSync(environment: string, appName: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    const creds = this.credentials(environment);
    if (!creds) {
      return { ok: false, skipped: true, error: `Argo CD credentials missing for ${environment}` };
    }
    try {
      const response = await fetch(`${creds.url}/api/v1/applications/${encodeURIComponent(appName)}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: `${response.status} ${body}` };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error, environment, appName }, 'Argo CD sync request failed');
      return { ok: false, error: message };
    }
  }

  private async getApplication(environment: string, appName: string): Promise<{ syncStatus: string | null; health: string | null }> {
    const creds = this.credentials(environment);
    if (!creds) {
      return { syncStatus: null, health: null };
    }
    const response = await fetch(`${creds.url}/api/v1/applications/${encodeURIComponent(appName)}`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (!response.ok) {
      return { syncStatus: null, health: null };
    }
    const data = (await response.json()) as {
      status?: { sync?: { status?: string }; health?: { status?: string } };
    };
    return {
      syncStatus: data.status?.sync?.status ?? null,
      health: data.status?.health?.status ?? null,
    };
  }

  private credentials(environment: string): { url: string; token: string } | null {
    const envKey = environment === 'prod' || environment === 'production' ? 'PROD' : 'STAGING';
    const url = process.env[`ARGOCD_${envKey}_URL`] || '';
    const token = process.env[`ARGOCD_${envKey}_TOKEN`] || '';
    if (!url || !token) {
      return null;
    }
    return { url: url.replace(/\/$/, ''), token };
  }
}

export const releaseSyncService = new ReleaseSyncService();
