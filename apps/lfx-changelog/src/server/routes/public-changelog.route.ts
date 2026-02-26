// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();
const changelogController = new ChangelogController();

// List: 1min cache (changelogs update frequently)
router.get('/', cacheMiddleware({ maxAge: 60, staleWhileRevalidate: 30 }), (req, res, next) => changelogController.listPublished(req, res, next));

// Detail: 5min cache (individual entries are stable once published)
router.get('/:id', cacheMiddleware({ maxAge: 300, staleWhileRevalidate: 60 }), (req, res, next) => changelogController.getPublishedById(req, res, next));

export default router;
