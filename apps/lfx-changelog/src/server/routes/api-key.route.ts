// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateApiKeyRequestSchema } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ApiKeyController } from '../controllers/api-key.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const apiKeyController = new ApiKeyController();

router.use(authorize({ oauthOnly: true }));

router.get('/', (req, res, next) => apiKeyController.list(req, res, next));
router.post('/', validate({ body: CreateApiKeyRequestSchema }), (req, res, next) => apiKeyController.create(req, res, next));
router.delete('/:id', (req, res, next) => apiKeyController.revoke(req, res, next));

export default router;
