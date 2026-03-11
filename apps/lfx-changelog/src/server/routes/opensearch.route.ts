// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ApiKeyScope, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { SearchController } from '../controllers/search.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const searchController = new SearchController();

// POST /reindex?target=changelogs|blogs|all (default: all)
router.post('/reindex', authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, role: UserRole.SUPER_ADMIN }), (req, res, next) =>
  searchController.reindex(req, res, next)
);

export default router;
