// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UpdateServiceMappingRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ReleasableServiceController } from '../controllers/releasable-service.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const controller = new ReleasableServiceController();

router.get('/', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.list(req, res, next));
router.get('/:key/plan', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.plan(req, res, next));
router.post('/:key/notes', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.notes(req, res, next));
router.put(
  '/:key/mapping',
  authorize({ oauthOnly: true, role: UserRole.SUPER_ADMIN }),
  validate({ body: UpdateServiceMappingRequestSchema }),
  (req, res, next) => controller.updateMapping(req, res, next)
);

export default router;
