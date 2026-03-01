// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ApiKeyScope, CreateChangelogEntryRequestSchema, UpdateChangelogEntryRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const changelogController = new ChangelogController();

router.get('/', authorize({ scope: ApiKeyScope.CHANGELOGS_READ, productRole: UserRole.EDITOR }), (req, res, next) =>
  changelogController.listAll(req, res, next)
);
router.get('/:id', authorize({ scope: ApiKeyScope.CHANGELOGS_READ, productRole: UserRole.EDITOR }), (req, res, next) =>
  changelogController.getById(req, res, next)
);
router.post(
  '/',
  authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.EDITOR }),
  validate({ body: CreateChangelogEntryRequestSchema }),
  (req, res, next) => changelogController.create(req, res, next)
);
router.put(
  '/:id',
  authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.EDITOR, resolveProductId: true }),
  validate({ body: UpdateChangelogEntryRequestSchema }),
  (req, res, next) => changelogController.update(req, res, next)
);
router.patch('/:id/publish', authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.EDITOR, resolveProductId: true }), (req, res, next) =>
  changelogController.publish(req, res, next)
);
router.delete('/:id', authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.PRODUCT_ADMIN, resolveProductId: true }), (req, res, next) =>
  changelogController.delete(req, res, next)
);

export default router;
