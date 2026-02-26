import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { GitHubController } from '../controllers/github.controller';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const githubController = new GitHubController();

router.get('/installations', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => githubController.listInstallations(req, res, next));
router.get('/installations/:installationId/repositories', requireRole(UserRole.SUPER_ADMIN), (req, res, next) =>
  githubController.listInstallationRepositories(req, res, next)
);

export default router;
