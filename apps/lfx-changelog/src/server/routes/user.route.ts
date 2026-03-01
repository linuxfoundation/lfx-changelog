// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AssignRoleRequestSchema, CreateUserRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { UserController } from '../controllers/user.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const userController = new UserController();

router.get('/me', (req, res, next) => userController.me(req, res, next));
router.get('/', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => userController.list(req, res, next));
router.post('/', authorize({ role: UserRole.SUPER_ADMIN }), validate({ body: CreateUserRequestSchema }), (req, res, next) =>
  userController.create(req, res, next)
);
router.post('/:id/roles', authorize({ role: UserRole.PRODUCT_ADMIN }), validate({ body: AssignRoleRequestSchema }), (req, res, next) =>
  userController.assignRole(req, res, next)
);
router.delete('/:id/roles/:roleId', authorize({ role: UserRole.PRODUCT_ADMIN }), (req, res, next) => userController.removeRole(req, res, next));

export default router;
