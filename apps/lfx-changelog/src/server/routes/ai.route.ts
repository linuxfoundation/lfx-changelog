// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { GenerateChangelogRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { AiController } from '../controllers/ai.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const aiController = new AiController();

router.post('/summarize-changes', authorize({ role: UserRole.EDITOR }), (req, res, next) => aiController.summarizeChanges(req, res, next));
router.post('/generate-changelog', authorize({ role: UserRole.EDITOR }), validate({ body: GenerateChangelogRequestSchema }), (req, res) =>
  aiController.generateChangelog(req, res)
);

export default router;
