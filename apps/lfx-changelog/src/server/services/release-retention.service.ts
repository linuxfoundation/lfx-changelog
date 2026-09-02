// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';
import { serverLogger } from '../server-logger';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class ReleaseRetentionService {
  private purgerStarted = false;

  public startPurger(): void {
    if (this.purgerStarted) {
      return;
    }
    this.purgerStarted = true;
    setInterval(() => {
      void this.purgeOldData();
    }, PURGE_INTERVAL_MS);
    void this.purgeOldData();
  }

  public async purgeOldData(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - RETENTION_MS);
      const prisma = getPrismaClient();

      const jobs = await prisma.releaseJob.deleteMany({
        where: {
          status: { in: ['completed', 'cancelled', 'failed'] },
          completedAt: { lt: cutoff },
        },
      });
      const contributorMaps = await prisma.contributorSlackMap.deleteMany({
        where: { updatedAt: { lt: cutoff } },
      });

      if (jobs.count || contributorMaps.count) {
        serverLogger.info({ releaseJobs: jobs.count, contributorSlackMaps: contributorMaps.count }, 'Release data retention purge complete');
      }
    } catch (error) {
      serverLogger.warn({ err: error }, 'Release data retention purge skipped');
    }
  }
}

export const releaseRetentionService = new ReleaseRetentionService();
