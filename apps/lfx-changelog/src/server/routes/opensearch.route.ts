// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { SearchController } from '../controllers/search.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const searchController = new SearchController();

router.post('/reindex', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => searchController.reindex(req, res, next));

export default router;
