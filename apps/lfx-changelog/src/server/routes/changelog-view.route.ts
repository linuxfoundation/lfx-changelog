// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ApiKeyScope, MarkViewedRequestSchema } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChangelogViewController } from '../controllers/changelog-view.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const changelogViewController = new ChangelogViewController();

// Get unseen changelog counts (any authenticated user)
router.get('/unseen', authorize({ scope: ApiKeyScope.CHANGELOGS_READ }), (req, res, next) => changelogViewController.getUnseenCounts(req, res, next));

// Mark changelogs as viewed (any authenticated user)
router.post('/mark-viewed', authorize({ scope: ApiKeyScope.CHANGELOGS_READ }), validate({ body: MarkViewedRequestSchema }), (req, res, next) =>
  changelogViewController.markViewed(req, res, next)
);

export default router;
