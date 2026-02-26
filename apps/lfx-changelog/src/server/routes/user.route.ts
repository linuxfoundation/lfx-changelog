import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { UserController } from '../controllers/user.controller';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const userController = new UserController();

router.get('/me', (req, res, next) => userController.me(req, res, next));
router.get('/', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => userController.list(req, res, next));
router.post('/:id/roles', requireRole(UserRole.PRODUCT_ADMIN), (req, res, next) => userController.assignRole(req, res, next));
router.delete('/:id/roles/:roleId', requireRole(UserRole.PRODUCT_ADMIN), (req, res, next) => userController.removeRole(req, res, next));

export default router;
