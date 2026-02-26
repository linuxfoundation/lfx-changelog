import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { AiController } from '../controllers/ai.controller';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const aiController = new AiController();

router.post('/summarize-changes', requireRole(UserRole.EDITOR), (req, res, next) => aiController.summarizeChanges(req, res, next));
router.post('/generate-changelog', requireRole(UserRole.EDITOR), (req, res) => aiController.generateChangelog(req, res));

export default router;
