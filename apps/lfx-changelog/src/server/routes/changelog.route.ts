// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateChangelogEntryRequestSchema, UpdateChangelogEntryRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';
import { requireProductRole, resolveChangelogProductId } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const changelogController = new ChangelogController();

router.get('/', requireProductRole(UserRole.EDITOR), (req, res, next) => changelogController.listAll(req, res, next));
router.get('/:id', requireProductRole(UserRole.EDITOR), (req, res, next) => changelogController.getById(req, res, next));
router.post('/', requireProductRole(UserRole.EDITOR), validate({ body: CreateChangelogEntryRequestSchema }), (req, res, next) =>
  changelogController.create(req, res, next)
);
router.put('/:id', resolveChangelogProductId, requireProductRole(UserRole.EDITOR), validate({ body: UpdateChangelogEntryRequestSchema }), (req, res, next) =>
  changelogController.update(req, res, next)
);
router.patch('/:id/publish', resolveChangelogProductId, requireProductRole(UserRole.EDITOR), (req, res, next) => changelogController.publish(req, res, next));
router.delete('/:id', resolveChangelogProductId, requireProductRole(UserRole.PRODUCT_ADMIN), (req, res, next) => changelogController.delete(req, res, next));

export default router;
