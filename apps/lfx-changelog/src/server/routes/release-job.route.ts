// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { StartReleaseRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ReleaseJobController } from '../controllers/release-job.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const controller = new ReleaseJobController();

router.get('/', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.list(req, res, next));
router.post('/', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), validate({ body: StartReleaseRequestSchema }), (req, res, next) =>
  controller.create(req, res, next)
);
router.get('/:id/stream', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.stream(req, res, next));
router.get('/:id', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.getById(req, res, next));
router.post('/:id/cancel', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.cancel(req, res, next));
router.post('/:id/retry', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) => controller.retry(req, res, next));
router.post('/:id/refresh-sync', authorize({ oauthOnly: true, role: UserRole.PRODUCT_ADMIN }), (req, res, next) =>
  controller.refreshSync(req, res, next)
);

export default router;
