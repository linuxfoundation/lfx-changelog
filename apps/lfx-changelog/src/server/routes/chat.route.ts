// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SendChatMessageRequestSchema } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ChatController } from '../controllers/chat.controller';
import { validate } from '../middleware/validate.middleware';

const router = Router();

/** Shared controller instance — also exported for public routes. */
export const chatController = new ChatController();

router.post('/send', validate({ body: SendChatMessageRequestSchema }), (req, res) => chatController.sendMessage(req, res));
router.get('/conversations', (req, res, next) => chatController.listConversations(req, res, next));
router.get('/conversations/:id', (req, res, next) => chatController.getConversation(req, res, next));
router.delete('/conversations/:id', (req, res, next) => chatController.deleteConversation(req, res, next));

export default router;
