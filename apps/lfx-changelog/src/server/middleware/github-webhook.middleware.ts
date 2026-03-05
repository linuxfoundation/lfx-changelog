// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import express, { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

import { serverLogger } from '../server-logger';

/**
 * Middleware pipeline that:
 * 1. Parses the raw body (needed for HMAC signature verification)
 * 2. Verifies the X-Hub-Signature-256 header using HMAC-SHA256
 * 3. Parses the raw Buffer into JSON on req.body
 *
 * Apply this to any route that receives GitHub webhook events.
 */
export const verifyGitHubWebhook = [
  // Step 1: Parse body as raw Buffer (overrides the global express.json() parser)
  express.raw({ type: 'application/json', limit: '1mb' }),

  // Step 2: Verify signature + parse JSON
  (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const GITHUB_WEBHOOK_SECRET = process.env['GITHUB_WEBHOOK_SECRET'] || '';

    if (!GITHUB_WEBHOOK_SECRET) {
      serverLogger.warn('GITHUB_WEBHOOK_SECRET is not configured — rejecting webhook');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    if (!signature) {
      serverLogger.warn('GitHub webhook missing X-Hub-Signature-256 header');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      res.status(400).json({ error: 'Empty or invalid request body' });
      return;
    }

    const signaturePrefix = 'sha256=';
    if (!signature.startsWith(signaturePrefix)) {
      serverLogger.warn('GitHub webhook signature missing sha256= prefix');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const providedHmac = Buffer.from(signature.slice(signaturePrefix.length), 'hex');
    const expectedHmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET).update(rawBody).digest();

    if (providedHmac.length !== expectedHmac.length || !crypto.timingSafeEqual(providedHmac, expectedHmac)) {
      serverLogger.warn('GitHub webhook signature mismatch');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Signature valid — parse JSON and continue
    try {
      req.body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    next();
  },
];
