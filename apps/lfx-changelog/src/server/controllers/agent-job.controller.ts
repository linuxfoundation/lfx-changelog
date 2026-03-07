// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AgentJobStatusSchema, MAX_PAGE_SIZE } from '@lfx-changelog/shared';

import { NotFoundError } from '../errors';
import { FlushableResponse } from '../interfaces/chat.interface';
import { agentJobEmitter } from '../services/agent-job-emitter.service';
import { ChangelogAgentService } from '../services/changelog-agent.service';
import { getPrismaClient } from '../services/prisma.service';

import type { AgentJobSSEEvent, AgentJobSSEEventType } from '@lfx-changelog/shared';
import type { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

export class AgentJobController {
  private readonly agentService = new ChangelogAgentService();

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
      const limit = Math.max(1, Math.min(parseInt(req.query['limit'] as string, 10) || 20, MAX_PAGE_SIZE));
      const skip = (page - 1) * limit;

      const where: Prisma.AgentJobWhereInput = {};
      if (req.query['productId']) where.productId = req.query['productId'] as string;
      if (req.query['status']) {
        const parsed = AgentJobStatusSchema.safeParse(req.query['status']);
        if (!parsed.success) {
          res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'status', message: `Invalid status. Must be one of: ${AgentJobStatusSchema.options.join(', ')}` }],
          });
          return;
        }
        where.status = parsed.data;
      }

      const [data, total] = await Promise.all([
        prisma.agentJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { product: { select: { id: true, name: true, slug: true } } },
        }),
        prisma.agentJob.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const job = await prisma.agentJob.findUnique({
        where: { id: req.params['id'] as string },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          changelogEntry: { select: { id: true, title: true, status: true } },
        },
      });

      if (!job) {
        throw new NotFoundError(`Agent job not found: ${req.params['id']}`, { operation: 'getById', service: 'agent-job' });
      }

      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  public async trigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['productId'] as string;

      // Verify product exists
      const prisma = getPrismaClient();
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) {
        throw new NotFoundError(`Product not found: ${productId}`, { operation: 'trigger', service: 'agent-job' });
      }

      const jobId = await this.agentService.runAgentForProduct(productId, 'manual');

      res.status(202).json({ success: true, data: { jobId } });
    } catch (error) {
      next(error);
    }
  }

  public async stream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const jobId = req.params['id'] as string;

      const job = await prisma.agentJob.findUnique({
        where: { id: jobId },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          changelogEntry: { select: { id: true, title: true, status: true } },
        },
      });

      if (!job) {
        throw new NotFoundError(`Agent job not found: ${jobId}`, { operation: 'stream', service: 'agent-job' });
      }

      // SSE headers — same pattern as chat.controller.ts
      const flushableRes = res as FlushableResponse;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Content-Encoding', 'identity');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.socket?.setNoDelay(true);

      let clientDisconnected = false;

      const sendEvent = (type: AgentJobSSEEventType, data: unknown): void => {
        if (clientDisconnected) return;
        res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        flushableRes.flush?.();
      };

      // Send catch-up: existing progress log entries
      for (const entry of job.progressLog as unknown[]) {
        sendEvent('progress', entry);
      }
      sendEvent('status', { status: job.status });

      // If already terminal, send result + done and close
      if (job.status === 'completed' || job.status === 'failed') {
        sendEvent('result', {
          durationMs: job.durationMs,
          numTurns: job.numTurns,
          promptTokens: job.promptTokens,
          outputTokens: job.outputTokens,
          changelogEntry: job.changelogEntry,
          errorMessage: job.errorMessage,
        });
        sendEvent('done', '');
        res.end();
        return;
      }

      // Subscribe to live events
      const listener = (event: AgentJobSSEEvent): void => {
        sendEvent(event.type, event.data);
        if (event.type === 'done') {
          cleanup();
          res.end();
        }
      };
      agentJobEmitter.subscribe(jobId, listener);

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        if (clientDisconnected) {
          cleanup();
          return;
        }
        res.write(': heartbeat\n\n');
      }, 15000);

      const cleanup = (): void => {
        clearInterval(heartbeat);
        agentJobEmitter.unsubscribe(jobId, listener);
      };

      req.on('close', () => {
        clientDisconnected = true;
        cleanup();
      });
    } catch (error) {
      next(error);
    }
  }
}
