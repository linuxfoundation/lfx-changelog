import { Router } from 'express';

import { ProductController } from '../controllers/product.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();
const productController = new ProductController();

// 5min cache (product list rarely changes)
router.get('/', cacheMiddleware({ maxAge: 300, staleWhileRevalidate: 60 }), (req, res, next) => productController.listPublic(req, res, next));

export default router;
