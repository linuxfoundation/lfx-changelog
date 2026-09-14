// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  ContributorQueryParamsSchema,
  LinkContributorSlackRequestSchema,
  SlackUserSearchParamsSchema,
  SyncContributorsRequestSchema,
  UserRole,
} from '@lfx-changelog/shared';
import { Router } from 'express';

import { ContributorController } from '../controllers/contributor.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const contributorController = new ContributorController();

// Contributor data is derived from Slack tokens and GitHub App installations — OAuth sessions only.
router.use(authorize({ oauthOnly: true, role: UserRole.SUPER_ADMIN }));

// Static paths must be declared before /:id so they aren't swallowed by the param route.
router.get('/slack-users', validate({ query: SlackUserSearchParamsSchema }), (req, res, next) => contributorController.listSlackWorkspaceUsers(req, res, next));
router.post('/sync', validate({ body: SyncContributorsRequestSchema }), (req, res, next) => contributorController.sync(req, res, next));

router.get('/', validate({ query: ContributorQueryParamsSchema }), (req, res, next) => contributorController.list(req, res, next));
router.get('/:id', (req, res, next) => contributorController.getById(req, res, next));
router.put('/:id/slack', validate({ body: LinkContributorSlackRequestSchema }), (req, res, next) => contributorController.linkSlack(req, res, next));
router.delete('/:id/slack', (req, res, next) => contributorController.unlinkSlack(req, res, next));
router.delete('/:id', (req, res, next) => contributorController.delete(req, res, next));

export default router;
