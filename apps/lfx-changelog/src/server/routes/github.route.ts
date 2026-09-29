// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateReleaseRequestSchema, GenerateReleaseNotesRequestSchema, ReleaseChangesQuerySchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { GitHubController } from '../controllers/github.controller';
import { ReleaseController } from '../controllers/release.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const githubController = new GitHubController();
const releaseController = new ReleaseController();

// ── App installation ────────────────────────────────────────────────────

router.get('/install-url', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.getInstallUrl(req, res, next));
router.get('/installations', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.listInstallations(req, res, next));
router.get('/installations/:installationId/repositories', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) =>
  githubController.listInstallationRepositories(req, res, next)
);

// ── Stored releases ─────────────────────────────────────────────────────

router.get('/releases', authorize({ role: UserRole.EDITOR }), (req, res, next) => githubController.listPublicReleases(req, res, next));

// The service filters to the products the caller administers, so this returns an empty list
// rather than revealing services they cannot release.
router.get('/releases/services', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) =>
  releaseController.listReleasableServices(req, res, next)
);

// ── Tracked repositories ────────────────────────────────────────────────

router.get('/repositories', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.listRepositoriesWithCounts(req, res, next));
router.post('/products/:productId/sync', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => githubController.syncReleases(req, res, next));

// Product-scoped: the service checks the caller administers the product that owns the repository,
// so a product admin can refresh their own repositories without super admin rights. oauthOnly
// matches the release routes below — it also checks Origin on mutations, which matters more now
// that every product admin can reach this rather than only super admins.
router.post('/repositories/:repoId/sync', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) =>
  releaseController.syncRepository(req, res, next)
);

// ── Publishing a release (product-scoped; OAuth sessions only) ──────────
// Publishing creates a public tag, so API keys are rejected and the service checks the caller
// administers the product that owns the repository.

router.get('/repositories/:repoId/release-target', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) =>
  releaseController.getReleaseTarget(req, res, next)
);
router.get(
  '/repositories/:repoId/changes',
  authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }),
  validate({ query: ReleaseChangesQuerySchema }),
  (req, res, next) => releaseController.getChanges(req, res, next)
);
router.post(
  '/repositories/:repoId/release-notes',
  authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: GenerateReleaseNotesRequestSchema }),
  (req, res, next) => releaseController.previewNotes(req, res, next)
);
router.post(
  '/repositories/:repoId/releases',
  authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: CreateReleaseRequestSchema }),
  (req, res, next) => releaseController.createRelease(req, res, next)
);

export default router;
