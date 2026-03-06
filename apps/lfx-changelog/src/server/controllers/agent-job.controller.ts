// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { MAX_PAGE_SIZE } from '@lfx-changelog/shared';

import { NotFoundError } from '../errors';
import { ChangelogAgentService } from '../services/changelog-agent.service';
import { getPrismaClient } from '../services/prisma.service';

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
      if (req.query['status']) where.status = req.query['status'] as Prisma.AgentJobWhereInput['status'];

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
}
