// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Router } from 'express';

import { RoadmapController } from '../controllers/roadmap.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();
const roadmapController = new RoadmapController();

// 5min cache — roadmap data changes infrequently
router.get('/', cacheMiddleware({ maxAge: 300, staleWhileRevalidate: 60 }), (req, res, next) => roadmapController.getBoard(req, res, next));
router.get('/:jiraKey', cacheMiddleware({ maxAge: 300, staleWhileRevalidate: 60 }), (req, res, next) => roadmapController.getIdea(req, res, next));
router.get('/:jiraKey/comments', cacheMiddleware({ maxAge: 120, staleWhileRevalidate: 30 }), (req, res, next) => roadmapController.getComments(req, res, next));

export default router;
