// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ReleasableServiceController } from '../controllers/releasable-service.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const releasableServiceController = new ReleasableServiceController();

// ── Releasable services ─────────────────────────────────────────────────
// The service filters to the products the caller administers, so this returns an empty list
// rather than revealing services they cannot release.
router.get('/services', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => releasableServiceController.list(req, res, next));

export default router;
