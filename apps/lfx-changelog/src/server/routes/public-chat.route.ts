// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SendChatMessageRequestSchema } from '@lfx-changelog/shared';
import { Router } from 'express';

import { validate } from '../middleware/validate.middleware';
import { chatController } from './chat.route';

const router = Router();

router.post('/send', validate({ body: SendChatMessageRequestSchema }), (req, res) => chatController.sendPublicMessage(req, res));
router.get('/conversations/:id', (req, res, next) => chatController.getConversation(req, res, next));

export default router;
