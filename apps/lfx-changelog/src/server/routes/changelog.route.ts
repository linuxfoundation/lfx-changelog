// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateChangelogEntryRequestSchema, UpdateChangelogEntryRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';
import { requireProductRole, resolveChangelogProductId } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const changelogController = new ChangelogController();

router.get('/', (req, res, next) => changelogController.listAll(req, res, next));
router.get('/:id', (req, res, next) => changelogController.getById(req, res, next));
router.post('/', validate({ body: CreateChangelogEntryRequestSchema }), requireProductRole(UserRole.EDITOR), (req, res, next) =>
  changelogController.create(req, res, next)
);
router.put('/:id', resolveChangelogProductId, validate({ body: UpdateChangelogEntryRequestSchema }), requireProductRole(UserRole.EDITOR), (req, res, next) =>
  changelogController.update(req, res, next)
);
router.patch('/:id/publish', resolveChangelogProductId, requireProductRole(UserRole.EDITOR), (req, res, next) => changelogController.publish(req, res, next));
router.delete('/:id', resolveChangelogProductId, requireProductRole(UserRole.PRODUCT_ADMIN), (req, res, next) => changelogController.delete(req, res, next));

export default router;
