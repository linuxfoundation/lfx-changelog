// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { GitHubController } from '../controllers/github.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const githubController = new GitHubController();

router.get('/install-url', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.getInstallUrl(req, res, next));
router.get('/installations', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.listInstallations(req, res, next));
router.get('/installations/:installationId/repositories', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) =>
  githubController.listInstallationRepositories(req, res, next)
);

// ── Release routes (mounted at /api/releases) ───────────────────────────
const releaseRouter = Router();

releaseRouter.get('/', authorize({ role: UserRole.EDITOR }), (req, res, next) => githubController.listPublicReleases(req, res, next));
releaseRouter.get('/repositories', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.listRepositoriesWithCounts(req, res, next));
releaseRouter.post('/sync/:productId', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.syncReleases(req, res, next));
releaseRouter.post('/sync/repo/:repoId', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) =>
  githubController.syncRepositoryReleases(req, res, next)
);

export { releaseRouter };
export default router;
