// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Router } from 'express';

import { WebhookController } from '../controllers/webhook.controller';
import { verifyGitHubWebhook } from '../middleware/github-webhook.middleware';

const router = Router();
const webhookController = new WebhookController();

router.get('/github-app-callback', (req, res) => webhookController.githubAppCallback(req, res));

// GitHub webhook — signature verified by middleware
router.post('/github', ...verifyGitHubWebhook, (req, res) => webhookController.githubWebhook(req, res));

// Slack OAuth callback (unauthenticated — validates signed state)
router.get('/slack-callback', (req, res) => webhookController.slackOAuthCallback(req, res));

export default router;
