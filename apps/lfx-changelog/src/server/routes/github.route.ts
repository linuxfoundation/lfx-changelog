// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateReleaseRequestSchema, GenerateReleaseNotesRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { GitHubController } from '../controllers/github.controller';
import { ReleaseController } from '../controllers/release.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const githubController = new GitHubController();
const releaseController = new ReleaseController();

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

// ── Release creation (product-scoped; OAuth sessions only) ──────────────
// Publishing a release creates a public tag, so API keys are rejected and the service
// checks the caller administers the product that owns the repository.
releaseRouter.get('/repositories/:repoId/target', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) =>
  releaseController.getReleaseTarget(req, res, next)
);
releaseRouter.post(
  '/repositories/:repoId/notes',
  authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: GenerateReleaseNotesRequestSchema }),
  (req, res, next) => releaseController.previewNotes(req, res, next)
);
releaseRouter.post(
  '/repositories/:repoId',
  authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: CreateReleaseRequestSchema }),
  (req, res, next) => releaseController.createRelease(req, res, next)
);

export { releaseRouter };
export default router;
