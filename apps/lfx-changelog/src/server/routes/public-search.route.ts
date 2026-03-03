// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SearchQueryParamsSchema } from '@lfx-changelog/shared';
import { Router } from 'express';

import { SearchController } from '../controllers/search.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const searchController = new SearchController();

router.get('/', cacheMiddleware({ maxAge: 30 }), validate({ query: SearchQueryParamsSchema }), (req, res, next) => searchController.search(req, res, next));

export default router;
