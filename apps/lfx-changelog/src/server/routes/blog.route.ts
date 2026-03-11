// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  ApiKeyScope,
  CreateBlogPostRequestSchema,
  LinkBlogPostChangelogsRequestSchema,
  LinkBlogPostProductsRequestSchema,
  UpdateBlogPostRequestSchema,
  UserRole,
} from '@lfx-changelog/shared';
import { Router } from 'express';

import { BlogController } from '../controllers/blog.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const blogController = new BlogController();

// List all blog posts (admin)
router.get('/', authorize({ scope: ApiKeyScope.BLOGS_READ, role: UserRole.EDITOR }), (req, res, next) => blogController.listAll(req, res, next));

// Get single blog post by ID
router.get('/:id', authorize({ scope: ApiKeyScope.BLOGS_READ, role: UserRole.EDITOR }), (req, res, next) => blogController.getById(req, res, next));

// Create blog post
router.post(
  '/',
  authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: CreateBlogPostRequestSchema }),
  (req, res, next) => blogController.create(req, res, next)
);

// Update blog post
router.put('/:id', authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.EDITOR }), validate({ body: UpdateBlogPostRequestSchema }), (req, res, next) =>
  blogController.update(req, res, next)
);

// Publish / Unpublish
router.patch('/:id/publish', authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.EDITOR }), (req, res, next) => blogController.publish(req, res, next));
router.patch('/:id/unpublish', authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.EDITOR }), (req, res, next) =>
  blogController.unpublish(req, res, next)
);

// Delete blog post
router.delete('/:id', authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.SUPER_ADMIN }), (req, res, next) => blogController.delete(req, res, next));

// Link products and changelogs
router.post(
  '/:id/link-products',
  authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: LinkBlogPostProductsRequestSchema }),
  (req, res, next) => blogController.linkProducts(req, res, next)
);
router.post(
  '/:id/link-changelogs',
  authorize({ scope: ApiKeyScope.BLOGS_WRITE, role: UserRole.PRODUCT_ADMIN }),
  validate({ body: LinkBlogPostChangelogsRequestSchema }),
  (req, res, next) => blogController.linkChangelogs(req, res, next)
);

export default router;
