import { Router } from 'express';

import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
const webhookController = new WebhookController();

router.get('/github-app-callback', (req, res) => webhookController.githubAppCallback(req, res));

export default router;
