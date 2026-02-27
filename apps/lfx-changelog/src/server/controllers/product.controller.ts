// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ProductService } from '../services/product.service';

export class ProductController {
  private readonly productService = new ProductService();

  public async listPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await this.productService.findAllPublic();
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  public async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await this.productService.findAll();
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.findById(req.params['id'] as string);
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, description, iconUrl, faIcon } = req.body;
      const product = await this.productService.create({ name, slug, description, iconUrl, faIcon });
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.productService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
