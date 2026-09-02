// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { MAX_PAGE_SIZE, ReleaseJobStatusSchema } from '@lfx-changelog/shared';

import { ConflictError, NotFoundError } from '../errors';
import { FlushableResponse } from '../interfaces/chat.interface';
import { getPrismaClient } from '../services/prisma.service';
import { releaseAuthService } from '../services/release-auth.service';
import { releaseJobEmitter } from '../services/release-job-emitter.service';
import { releaseSyncService } from '../services/release-sync.service';
import { releaseWorkflowService } from '../services/release-workflow.service';

import type { ReleaseJobSSEEvent, ReleaseJobSSEEventType } from '@lfx-changelog/shared';
import type { Prisma, ReleaseJob as PrismaReleaseJob } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

export class ReleaseJobController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      releaseAuthService.assertCanSeeReleases(req.dbUser);
      const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
      const limit = Math.max(1, Math.min(parseInt(req.query['limit'] as string, 10) || 20, MAX_PAGE_SIZE));
      const skip = (page - 1) * limit;
      const where: Prisma.ReleaseJobWhereInput = {};
      if (req.query['serviceKey']) {
        where.serviceKey = req.query['serviceKey'] as string;
      }
      if (req.query['status']) {
        const parsed = ReleaseJobStatusSchema.safeParse(req.query['status']);
        if (!parsed.success) {
          res.status(400).json({ success: false, error: 'Invalid status' });
          return;
        }
        where.status = parsed.data;
      }

      const visible = await releaseAuthService.visibleServiceKeys(req.dbUser);
      if (visible !== 'all') {
        const requested = where.serviceKey as string | undefined;
        if (requested && !visible.includes(requested)) {
          res.json({ success: true, data: [], total: 0, page, pageSize: limit, totalPages: 0 });
          return;
        }
        if (!requested) {
          where.serviceKey = { in: visible };
        }
      }

      const prisma = getPrismaClient();
      const [data, total] = await Promise.all([
        prisma.releaseJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { environmentSyncs: true },
        }),
        prisma.releaseJob.count({ where }),
      ]);

      res.json({
        success: true,
        data: data.map((job) => this.toApi(job)),
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { serviceKey, notes, newTag } = req.body as { serviceKey: string; notes: string; newTag?: string };
      await releaseAuthService.assertCanReleaseService(req.dbUser, serviceKey);
      const existing = await releaseAuthService.findActiveJob(serviceKey);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'An active release job already exists for this service',
          data: { jobId: existing.id, status: existing.status },
        });
        return;
      }
      if (!notes?.trim()) {
        res.status(422).json({ success: false, error: 'Release notes are required' });
        return;
      }

      try {
        const job = await releaseWorkflowService.startJob({
          serviceKey,
          notes,
          newTag,
          requesterId: req.dbUser!.id,
        });
        res.status(202).json({ success: true, data: this.toApi(job) });
      } catch (error) {
        if (error instanceof Error && error.message === 'ACTIVE_JOB') {
          const conflict = error as Error & { jobId: string; status: string };
          res.status(409).json({
            success: false,
            error: 'An active release job already exists for this service',
            data: { jobId: conflict.jobId, status: conflict.status },
          });
          return;
        }
        if (error instanceof Error && error.message === 'Nothing to release') {
          res.status(422).json({ success: false, error: error.message });
          return;
        }
        if (error instanceof Error && error.message === 'STALE_TAG') {
          const stale = error as Error & { expectedTag: string };
          res.status(409).json({
            success: false,
            error: 'The release plan is out of date; the next tag has changed',
            data: { expectedTag: stale.expectedTag },
          });
          return;
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.loadVisibleJob(req);
      res.json({ success: true, data: this.toApi(job) });
    } catch (error) {
      next(error);
    }
  }

  public async stream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.loadVisibleJob(req);
      const flushableRes = res as FlushableResponse;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Content-Encoding', 'identity');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.socket?.setNoDelay(true);

      let clientDisconnected = false;
      const sendEvent = (type: ReleaseJobSSEEventType, data: unknown): void => {
        if (clientDisconnected) return;
        res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        flushableRes.flush?.();
      };

      for (const entry of job.progressLog as unknown[]) {
        sendEvent('progress', entry);
      }
      sendEvent('status', { status: job.status });
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        sendEvent('done', '');
        res.end();
        return;
      }

      const listener = (event: ReleaseJobSSEEvent): void => {
        sendEvent(event.type, event.data);
        if (event.type === 'done') {
          cleanup();
          res.end();
        }
      };
      releaseJobEmitter.subscribe(job.id, listener);
      const heartbeat = setInterval(() => {
        if (clientDisconnected) {
          cleanup();
          return;
        }
        res.write(': heartbeat\n\n');
      }, 15_000);
      const cleanup = (): void => {
        clearInterval(heartbeat);
        releaseJobEmitter.unsubscribe(job.id, listener);
      };
      req.on('close', () => {
        clientDisconnected = true;
        cleanup();
      });
    } catch (error) {
      next(error);
    }
  }

  public async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.loadVisibleJob(req);
      await releaseAuthService.assertCanReleaseService(req.dbUser, job.serviceKey);
      try {
        const updated = await releaseWorkflowService.cancel(job.id, req.dbUser!.id);
        res.json({ success: true, data: this.toApi(updated) });
      } catch (error) {
        if (error instanceof Error && error.message === 'Job is not waiting for approval') {
          throw new ConflictError(error.message, { operation: 'cancel', service: 'release-job' });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  public async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.loadVisibleJob(req);
      await releaseAuthService.assertCanReleaseService(req.dbUser, job.serviceKey);
      try {
        const updated = await releaseWorkflowService.retry(job.id);
        res.status(202).json({ success: true, data: this.toApi(updated) });
      } catch (error) {
        if (error instanceof Error && error.message === 'Nothing left to retry') {
          throw new ConflictError(error.message, { operation: 'retry', service: 'release-job' });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  public async refreshSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.loadVisibleJob(req);
      await releaseAuthService.assertCanReleaseService(req.dbUser, job.serviceKey);
      await releaseSyncService.refreshStatus(job.id);
      const refreshed = await this.loadVisibleJob(req);
      res.json({ success: true, data: this.toApi(refreshed) });
    } catch (error) {
      next(error);
    }
  }

  public async activeLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expected = process.env['RELEASE_LOCK_TOKEN'] || '';
      const provided = req.header('x-release-lock-token') || '';
      if (!expected || provided !== expected) {
        res.status(401).json({ success: false, error: 'Invalid release lock token' });
        return;
      }
      const serviceKey = req.params['serviceKey'] as string;
      const active = await releaseAuthService.findActiveJob(serviceKey);
      res.json({ success: true, data: { active: Boolean(active), jobId: active?.id ?? null, status: active?.status ?? null } });
    } catch (error) {
      next(error);
    }
  }

  private async loadVisibleJob(req: Request) {
    const prisma = getPrismaClient();
    const job = await prisma.releaseJob.findUnique({
      where: { id: req.params['id'] as string },
      include: { environmentSyncs: true },
    });
    if (!job) {
      throw new NotFoundError(`Release job not found: ${req.params['id']}`, { operation: 'getById', service: 'release-job' });
    }
    if (!(await releaseAuthService.canReleaseService(req.dbUser, job.serviceKey)) && !releaseAuthService.isSuperAdmin(req.dbUser)) {
      throw new NotFoundError(`Release job not found: ${req.params['id']}`, { operation: 'getById', service: 'release-job' });
    }
    return job;
  }

  private toApi(
    job: PrismaReleaseJob & {
      environmentSyncs?: {
        environment: string;
        applicationName: string;
        requestStatus: string;
        lastSyncStatus: string | null;
        lastHealth: string | null;
        lastRefreshedAt: Date | null;
      }[];
    }
  ) {
    return {
      id: job.id,
      serviceKey: job.serviceKey,
      status: job.status,
      requesterId: job.requesterId,
      latestTag: job.latestTag,
      newTag: job.newTag,
      releaseUrl: job.releaseUrl,
      ciStatus: job.ciStatus,
      ciRunUrl: job.ciRunUrl,
      argocdPrUrl: job.argocdPrUrl,
      bumpOutcome: job.bumpOutcome,
      bumpRunUrl: job.bumpRunUrl,
      mergeQueuedAt: job.mergeQueuedAt?.toISOString() ?? null,
      progressLog: job.progressLog,
      environmentSyncs: (job.environmentSyncs ?? []).map((row) => ({
        environment: row.environment,
        applicationName: row.applicationName,
        requestStatus: row.requestStatus,
        lastSyncStatus: row.lastSyncStatus,
        lastHealth: row.lastHealth,
        lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
      })),
      errorMessage: job.errorMessage,
    };
  }
}
