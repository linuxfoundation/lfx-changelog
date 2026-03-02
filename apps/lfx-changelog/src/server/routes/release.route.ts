// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ReleaseController } from '../controllers/release.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const releaseController = new ReleaseController();

// List releases (any authenticated user)
router.get('/', (req, res, next) => releaseController.listPublic(req, res, next));

// List all repositories with release counts (admin only)
router.get('/repositories', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => releaseController.listRepositories(req, res, next));

// Sync releases for a product (admin only)
router.post('/sync/:productId', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => releaseController.sync(req, res, next));

// Sync releases for a single repository (admin only)
router.post('/sync/repo/:repoId', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => releaseController.syncRepository(req, res, next));

export default router;
