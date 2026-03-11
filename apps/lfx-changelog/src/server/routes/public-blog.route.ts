// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Router } from 'express';

import { BlogPostController } from '../controllers/blog-post.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();
const blogPostController = new BlogPostController();

// List published blog posts: 2min cache
router.get('/', cacheMiddleware({ maxAge: 120, staleWhileRevalidate: 60 }), (req, res, next) => blogPostController.listPublished(req, res, next));

// Get published blog post by slug: 5min cache
router.get('/:slug', cacheMiddleware({ maxAge: 300, staleWhileRevalidate: 60 }), (req, res, next) => blogPostController.getPublishedBySlug(req, res, next));

export default router;
