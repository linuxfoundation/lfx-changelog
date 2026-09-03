// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NotFoundError } from '../errors';
import { getPrismaClient } from '../services/prisma.service';
import { releasableCatalogService } from '../services/releasable-catalog.service';
import { releaseAuthService } from '../services/release-auth.service';
import { computeNextTag, releaseGitHubAuditService } from '../services/release-github-audit.service';
import { releaseNotesService } from '../services/release-notes.service';
import { isArgocdSyncEnabled } from '../services/release-sync.service';

import type { ReleasableService, ReleasePlan } from '@lfx-changelog/shared';
import type { NextFunction, Request, Response } from 'express';

const PLAN_STEPS = [
  'Generate or accept release notes',
  'Publish the GitHub version',
  'Notify the team that work started',
  'Wait for the image build',
  'Wait for the GitOps version-bump job and pull request',
  'Wait for @lfx-one, then add the pull request to the merge queue',
  'Wait until the merge queue finishes the merge',
  isArgocdSyncEnabled() ? 'Request a deploy sync per environment' : 'Argo CD applies the merged pins. Changelog does not request sync',
  'Send the summary notice',
];

export class ReleasableServiceController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      releaseAuthService.assertCanSeeReleases(req.dbUser);
      const visible = await releaseAuthService.visibleServiceKeys(req.dbUser);
      const catalog = releasableCatalogService.list().filter((service) => visible === 'all' || visible.includes(service.key));

      const prisma = getPrismaClient();
      const mappings = await prisma.releasableServiceMapping.findMany();
      const mappingByKey = new Map(mappings.map((row) => [row.serviceKey, row.productId]));

      const data: ReleasableService[] = [];
      for (const service of catalog) {
        const productId = mappingByKey.get(service.key) ?? null;
        if (visible !== 'all' && !productId) {
          continue;
        }
        const audit = await releaseGitHubAuditService.audit(service.githubRepo);
        const active = await releaseAuthService.findActiveJob(service.key);
        const canRelease = audit.pending.length > 0 && !audit.error && !active;
        data.push({
          key: service.key,
          displayName: service.displayName,
          githubRepo: service.githubRepo,
          productId,
          latestTag: audit.latestTag,
          pendingCount: audit.pending.length,
          environments: service.environments,
          canRelease,
          auditError: audit.error,
          activeJobId: active?.id ?? null,
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async plan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params['key'] as string;
      await releaseAuthService.assertCanReleaseService(req.dbUser, key);
      const service = releasableCatalogService.get(key);
      if (!service) {
        throw new NotFoundError(`Unknown service: ${key}`, { operation: 'plan', service: 'releasable-service' });
      }

      const active = await releaseAuthService.findActiveJob(key);
      if (active) {
        res.status(409).json({
          success: false,
          error: 'An active release job already exists for this service',
          data: { jobId: active.id, status: active.status },
        });
        return;
      }

      const prisma = getPrismaClient();
      const mapping = await prisma.releasableServiceMapping.findUnique({ where: { serviceKey: key } });
      const audit = await releaseGitHubAuditService.audit(service.githubRepo);
      if (audit.error) {
        res.status(422).json({ success: false, error: audit.error });
        return;
      }
      if (audit.pending.length === 0) {
        res.status(422).json({ success: false, error: 'Nothing to release' });
        return;
      }

      const tags = computeNextTag(audit.latestTag);
      const payload: ReleasePlan = {
        service: {
          key: service.key,
          displayName: service.displayName,
          githubRepo: service.githubRepo,
          productId: mapping?.productId ?? null,
          latestTag: audit.latestTag,
          pendingCount: audit.pending.length,
          environments: service.environments,
          canRelease: true,
          auditError: null,
          activeJobId: null,
        },
        latestTag: audit.latestTag,
        newTag: tags.newTag,
        argocdTag: tags.argocdTag,
        headSha: audit.headSha,
        pending: audit.pending,
        environments: service.environments,
        steps: PLAN_STEPS,
      };
      res.json({ success: true, data: payload });
    } catch (error) {
      next(error);
    }
  }

  public async notes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params['key'] as string;
      await releaseAuthService.assertCanReleaseService(req.dbUser, key);
      const service = releasableCatalogService.get(key);
      if (!service) {
        throw new NotFoundError(`Unknown service: ${key}`, { operation: 'notes', service: 'releasable-service' });
      }
      const audit = await releaseGitHubAuditService.audit(service.githubRepo);
      const tags = computeNextTag(audit.latestTag);
      const notes = await releaseNotesService.generate(service.githubRepo, tags.newTag, audit.latestTag, audit.pending);
      res.json({ success: true, data: { notes } });
    } catch (error) {
      next(error);
    }
  }

  public async updateMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params['key'] as string;
      if (!releasableCatalogService.get(key)) {
        throw new NotFoundError(`Unknown service: ${key}`, { operation: 'updateMapping', service: 'releasable-service' });
      }
      const productId = (req.body as { productId?: string | null }).productId ?? null;
      const prisma = getPrismaClient();
      if (productId === null) {
        await prisma.releasableServiceMapping.deleteMany({ where: { serviceKey: key } });
        res.json({ success: true, data: { serviceKey: key, productId: null } });
        return;
      }
      const saved = await prisma.releasableServiceMapping.upsert({
        where: { serviceKey: key },
        create: { serviceKey: key, productId },
        update: { productId },
      });
      res.json({ success: true, data: saved });
    } catch (error) {
      next(error);
    }
  }
}
