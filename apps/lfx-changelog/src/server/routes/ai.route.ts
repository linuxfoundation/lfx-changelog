// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { GenerateChangelogRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { AiController } from '../controllers/ai.controller';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const aiController = new AiController();

router.post('/summarize-changes', requireRole(UserRole.EDITOR), (req, res, next) => aiController.summarizeChanges(req, res, next));
router.post('/generate-changelog', validate({ body: GenerateChangelogRequestSchema }), requireRole(UserRole.EDITOR), (req, res) =>
  aiController.generateChangelog(req, res)
);

export default router;
