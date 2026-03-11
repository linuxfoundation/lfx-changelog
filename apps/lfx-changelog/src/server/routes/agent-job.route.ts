// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ApiKeyScope, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { AgentJobController } from '../controllers/agent-job.controller';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();
const agentJobController = new AgentJobController();

router.get('/', authorize({ role: UserRole.SUPER_ADMIN, scope: ApiKeyScope.PRODUCTS_READ }), (req, res, next) => agentJobController.list(req, res, next));
router.get('/:id/stream', authorize({ role: UserRole.SUPER_ADMIN, scope: ApiKeyScope.PRODUCTS_READ }), (req, res, next) =>
  agentJobController.stream(req, res, next)
);
router.get('/:id', authorize({ role: UserRole.SUPER_ADMIN, scope: ApiKeyScope.PRODUCTS_READ }), (req, res, next) => agentJobController.getById(req, res, next));
router.post('/trigger/:productId', authorize({ role: UserRole.SUPER_ADMIN, scope: ApiKeyScope.PRODUCTS_WRITE }), (req, res, next) =>
  agentJobController.trigger(req, res, next)
);
router.post('/trigger-blog/:type', authorize({ role: UserRole.SUPER_ADMIN, scope: ApiKeyScope.BLOGS_WRITE }), (req, res, next) =>
  agentJobController.triggerBlog(req, res, next)
);
router.post('/:id/cancel', authorize({ role: UserRole.SUPER_ADMIN, scope: [ApiKeyScope.PRODUCTS_WRITE, ApiKeyScope.BLOGS_WRITE] }), (req, res, next) =>
  agentJobController.cancel(req, res, next)
);

export default router;
