// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  CreateBlogPostRequestSchema,
  LinkBlogPostChangelogsRequestSchema,
  LinkBlogPostProductsRequestSchema,
  UpdateBlogPostRequestSchema,
  UserRole,
} from '@lfx-changelog/shared';
import { Router } from 'express';

import { BlogPostController } from '../controllers/blog-post.controller';
import { authorize } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const blogPostController = new BlogPostController();

// List all blog posts (admin)
router.get('/', authorize({ role: UserRole.EDITOR }), (req, res, next) => blogPostController.listAll(req, res, next));

// Get changelogs for a period (helper for blog editor)
router.get('/changelogs-for-period', authorize({ role: UserRole.EDITOR }), (req, res, next) => blogPostController.getChangelogsForPeriod(req, res, next));

// Get single blog post by ID
router.get('/:id', authorize({ role: UserRole.EDITOR }), (req, res, next) => blogPostController.getById(req, res, next));

// Create blog post
router.post('/', authorize({ role: UserRole.PRODUCT_ADMIN }), validate({ body: CreateBlogPostRequestSchema }), (req, res, next) =>
  blogPostController.create(req, res, next)
);

// Update blog post
router.put('/:id', authorize({ role: UserRole.PRODUCT_ADMIN }), validate({ body: UpdateBlogPostRequestSchema }), (req, res, next) =>
  blogPostController.update(req, res, next)
);

// Publish / Unpublish
router.patch('/:id/publish', authorize({ role: UserRole.PRODUCT_ADMIN }), (req, res, next) => blogPostController.publish(req, res, next));
router.patch('/:id/unpublish', authorize({ role: UserRole.PRODUCT_ADMIN }), (req, res, next) => blogPostController.unpublish(req, res, next));

// Delete blog post
router.delete('/:id', authorize({ role: UserRole.SUPER_ADMIN }), (req, res, next) => blogPostController.delete(req, res, next));

// Link products and changelogs
router.post('/:id/link-products', authorize({ role: UserRole.PRODUCT_ADMIN }), validate({ body: LinkBlogPostProductsRequestSchema }), (req, res, next) =>
  blogPostController.linkProducts(req, res, next)
);
router.post('/:id/link-changelogs', authorize({ role: UserRole.PRODUCT_ADMIN }), validate({ body: LinkBlogPostChangelogsRequestSchema }), (req, res, next) =>
  blogPostController.linkChangelogs(req, res, next)
);

export default router;
