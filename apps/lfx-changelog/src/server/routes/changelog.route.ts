// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  ApiKeyScope,
  CreateChangelogEntryRequestSchema,
  MarkViewedRequestSchema,
  PostToSlackRequestSchema,
  UnseenQuerySchema,
  UpdateChangelogEntryRequestSchema,
  UserRole,
} from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const changelogController = new ChangelogController();

// ── View tracking (must be before /:id to avoid param capture) ───
router.get('/views/unseen', authorize({ scope: ApiKeyScope.CHANGELOGS_READ }), validate({ query: UnseenQuerySchema }), (req, res, next) =>
  changelogController.getUnseenCounts(req, res, next)
);
router.post('/views/mark-viewed', authorize({ scope: ApiKeyScope.CHANGELOGS_READ }), validate({ body: MarkViewedRequestSchema }), (req, res, next) =>
  changelogController.markViewed(req, res, next)
);

router.get('/', authorize({ scope: ApiKeyScope.CHANGELOGS_READ, role: UserRole.EDITOR }), (req, res, next) =>
  changelogController.listAll(req, res, next)
);
router.get('/:id', authorize({ scope: ApiKeyScope.CHANGELOGS_READ, productRole: UserRole.EDITOR, resolveProductId: true }), (req, res, next) =>
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
router.patch('/:id/unpublish', authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.EDITOR, resolveProductId: true }), (req, res, next) =>
  changelogController.unpublish(req, res, next)
);
router.delete('/:id', authorize({ scope: ApiKeyScope.CHANGELOGS_WRITE, productRole: UserRole.PRODUCT_ADMIN, resolveProductId: true }), (req, res, next) =>
  changelogController.delete(req, res, next)
);

// Share to Slack — OAuth only (no API key), EDITOR role with resolved product
router.post(
  '/:id/share/slack',
  authorize({ oauthOnly: true, productRole: UserRole.EDITOR, resolveProductId: true }),
  validate({ body: PostToSlackRequestSchema }),
  (req, res, next) => changelogController.shareToSlack(req, res, next)
);

export default router;
