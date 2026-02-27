// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CreateProductRequestSchema, LinkRepositoryRequestSchema, UpdateProductRequestSchema, UserRole } from '@lfx-changelog/shared';
import { Router } from 'express';

import { ProductRepositoryController } from '../controllers/product-repository.controller';
import { ProductController } from '../controllers/product.controller';
import { noCacheMiddleware } from '../middleware/cache.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const productController = new ProductController();
const productRepositoryController = new ProductRepositoryController();

router.get('/', requireRole(UserRole.EDITOR), (req, res, next) => productController.list(req, res, next));
router.get('/:id', requireRole(UserRole.EDITOR), (req, res, next) => productController.getById(req, res, next));
router.post('/', requireRole(UserRole.SUPER_ADMIN), validate({ body: CreateProductRequestSchema }), (req, res, next) =>
  productController.create(req, res, next)
);
router.put('/:id', requireRole(UserRole.SUPER_ADMIN), validate({ body: UpdateProductRequestSchema }), (req, res, next) =>
  productController.update(req, res, next)
);
router.delete('/:id', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => productController.delete(req, res, next));

router.get('/:id/repositories', requireRole(UserRole.EDITOR), (req, res, next) => productRepositoryController.list(req, res, next));
router.post('/:id/repositories', requireRole(UserRole.SUPER_ADMIN), validate({ body: LinkRepositoryRequestSchema }), (req, res, next) =>
  productRepositoryController.link(req, res, next)
);
router.delete('/:id/repositories/:repoId', requireRole(UserRole.SUPER_ADMIN), (req, res, next) => productRepositoryController.unlink(req, res, next));
router.get('/:id/activity', requireRole(UserRole.SUPER_ADMIN), noCacheMiddleware, (req, res, next) => productRepositoryController.getActivity(req, res, next));

export default router;
