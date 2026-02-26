import { Router } from 'express';

import { ProductController } from '../controllers/product.controller';

const router = Router();
const productController = new ProductController();

router.get('/', (req, res, next) => productController.listPublic(req, res, next));

export default router;
