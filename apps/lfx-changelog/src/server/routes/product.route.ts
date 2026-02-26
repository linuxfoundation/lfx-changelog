import { UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ProductController } from '../controllers/product.controller';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const productController = new ProductController();

router.get('/', (req, res, next) => productController.list(req, res, next));
router.post('/', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => productController.create(req, res, next));
router.put('/:id', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => productController.update(req, res, next));
router.delete('/:id', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => productController.delete(req, res, next));

export default router;
