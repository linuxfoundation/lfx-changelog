// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ZodError } from 'zod';

import type { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ZodSchema } from 'zod';

type ValidateOptions = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      // req.query is read-only in Express 5 — validate but don't assign back.
      // Controllers must re-parse req.query with the schema to get coerced/defaulted values.
      if (schemas.query) schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params) as ParamsDictionary;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
