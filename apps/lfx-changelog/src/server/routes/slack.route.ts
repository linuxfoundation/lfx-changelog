// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SaveSlackChannelRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { SlackController } from '../controllers/slack.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const slackController = new SlackController();

// All Slack API routes are OAuth-only (no API key access)
router.get('/connect', authorize({ oauthOnly: true }), (req, res, next) => slackController.connect(req, res, next));

router.get('/integrations', authorize({ oauthOnly: true }), (req, res, next) => slackController.getIntegrations(req, res, next));

router.get('/integrations/:id/channels', authorize({ oauthOnly: true }), (req, res, next) => slackController.getChannels(req, res, next));

router.post('/integrations/:id/channels', authorize({ oauthOnly: true }), validate({ body: SaveSlackChannelRequestSchema }), (req, res, next) =>
  slackController.saveChannel(req, res, next)
);

router.delete('/integrations/:id', authorize({ oauthOnly: true }), (req, res, next) => slackController.disconnect(req, res, next));

router.get('/bot-connect', authorize({ oauthOnly: true, role: UserRole.SUPER_ADMIN }), (req, res, next) => slackController.getBotConnect(req, res, next));
router.get('/bot-installation', authorize({ oauthOnly: true, role: UserRole.SUPER_ADMIN }), (req, res, next) =>
  slackController.getBotInstallation(req, res, next)
);

export default router;
