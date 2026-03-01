// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { auth } from 'express-openid-connect';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { getCorsOrigins } from './server/constants/cors.constants';
import { hybridAuthMiddleware } from './server/middleware/api-key-auth.middleware';
import { noCacheMiddleware } from './server/middleware/cache.middleware';
import { apiErrorHandler } from './server/middleware/error-handler.middleware';
import { requestIdMiddleware } from './server/middleware/request-id.middleware';
import { sameOriginOnly } from './server/middleware/same-origin.middleware';
import aiRouter from './server/routes/ai.route';
import apiKeyRouter from './server/routes/api-key.route';
import changelogRouter from './server/routes/changelog.route';
import chatRouter from './server/routes/chat.route';
import githubRouter from './server/routes/github.route';
import mcpRouter from './server/routes/mcp.route';
import productRouter from './server/routes/product.route';
import publicChangelogRouter from './server/routes/public-changelog.route';
import publicChatRouter from './server/routes/public-chat.route';
import publicProductRouter from './server/routes/public-product.route';
import userRouter from './server/routes/user.route';
import webhookRouter from './server/routes/webhook.route';
import { reqSerializer, resSerializer, serverLogger } from './server/server-logger';
import { disconnectPrisma } from './server/services/prisma.service';
import { UserService } from './server/services/user.service';
import { setupSwagger } from './server/swagger';

import type { AuthContext } from '@lfx-changelog/shared';
import type { Server } from 'node:http';

if (process.env['NODE_ENV'] !== 'production') {
  dotenv.config();
}

const browserDistFolder = import.meta.dirname + '/../browser';

const angularApp = new AngularNodeAppEngine();
const app = express();
const userService = new UserService();

// 1. Request ID (first — tracing for all downstream middleware + handlers)
app.use(requestIdMiddleware);

// 2. Helmet (security headers)
app.use(
  helmet({
    contentSecurityPolicy: false, // Angular SSR manages its own CSP
    crossOriginEmbedderPolicy: false, // Font Awesome kit requires cross-origin loading
  })
);

// 3. Compression
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);

// 4. CORS — public API only (external consumers); protected routes stay same-origin
// Chat routes are excluded — they're same-origin only (served by this app)
app.use('/public/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/chat')) {
    next();
    return;
  }
  cors({
    origin: getCorsOrigins(),
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 86400,
  })(req, res, next);
});

// 4b. CORS — MCP endpoint (AI clients need cross-origin access)
app.use(
  '/mcp',
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })
);

// 4c. CORS — protected API when accessed via API key (programmatic clients)
// Chat routes are excluded — they're same-origin only
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/chat')) {
    next();
    return;
  }

  const hasApiKey =
    req.headers['authorization']?.startsWith('Bearer lfx_') || (typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'].startsWith('lfx_'));

  // Preflight (OPTIONS) requests don't carry the actual Authorization header —
  // they only list it in Access-Control-Request-Headers. Match those too.
  const isPreflight = req.method === 'OPTIONS' && /\b(authorization|x-api-key)\b/i.test(req.headers['access-control-request-headers'] || '');

  if (hasApiKey || isPreflight) {
    cors({
      origin: '*',
      credentials: false,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      maxAge: 86400,
    })(req, res, next);
    return;
  }
  next();
});

// 5. Body parsers (1mb limit — sufficient for changelog API)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Static files
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

// 7. Health check
app.get('/health', (_req: Request, res: Response) => {
  res.send('OK');
});

// 7b. API documentation
app.use('/docs', setupSwagger());

// 8. Rate limiter — 100 req/min per IP on API routes
if (process.env['SKIP_RATE_LIMIT'] !== 'true') {
  const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      return ipKeyGenerator(ip);
    },
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/public/api', apiRateLimiter);
  app.use('/api', apiRateLimiter);
  app.use('/mcp', apiRateLimiter);
}

// 9. Pino HTTP logger (custom serializers to avoid leaking sessions/headers)
app.use(
  pinoHttp({
    logger: serverLogger,
    genReqId: (req) => (req as Request).id,
    serializers: {
      req: reqSerializer,
      res: resSerializer,
    },
    autoLogging: {
      ignore: (req) => {
        const url = (req as Request).originalUrl || (req as Request).url;
        return url === '/health' || url.startsWith('/assets');
      },
    },
  })
);

// 10. OIDC (Auth0)
app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    baseURL: process.env['BASE_URL'] || 'http://localhost:4204',
    clientID: process.env['AUTH0_CLIENT_ID'] || '1234',
    issuerBaseURL: process.env['AUTH0_ISSUER_BASE_URL'] || 'https://example.com',
    secret: process.env['AUTH0_SECRET'] || 'a-long-random-secret-for-dev',
    idTokenSigningAlg: 'HS256',
    authorizationParams: {
      response_type: 'code',
      scope: 'openid email profile offline_access',
    },
    clientSecret: process.env['AUTH0_CLIENT_SECRET'] || 'CHANGE_ME_AUTH0_CLIENT_SECRET',
    routes: {
      login: false,
    },
  })
);

// 11. Custom login route with returnTo
app.get('/login', (req: Request, res: Response) => {
  const returnTo = (req.query['returnTo'] as string) || '/';
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
  (res as any).oidc.login({ returnTo: safeReturnTo });
});

// 11b. Custom logout route
app.get('/logout', (_req: Request, res: Response) => {
  (res as any).oidc.logout({ returnTo: '/' });
});

// 12. Webhook routes (unauthenticated — GitHub App callback)
app.use('/webhooks', webhookRouter);

// 13. Public API routes (no auth required — cache headers set per-route)
app.use('/public/api/chat', sameOriginOnly, publicChatRouter);
app.use('/public/api/changelogs', publicChangelogRouter);
app.use('/public/api/products', publicProductRouter);

// 13b. MCP (Model Context Protocol) endpoint — public, stateless HTTP transport
app.use('/mcp', mcpRouter);

// 14. No-cache middleware for protected routes
app.use('/api', noCacheMiddleware);

// 14. Auth middleware for protected routes (supports both API key + OAuth)
app.use('/api', hybridAuthMiddleware);

// 14b. API key rate limiter — 1000 req/hour per key (separate from IP-based limiter)
if (process.env['SKIP_RATE_LIMIT'] !== 'true') {
  const apiKeyRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req as Request).apiKey!.id,
    message: { error: 'API key rate limit exceeded. Maximum 1000 requests per hour.' },
  });
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.authMethod === 'api_key') {
      apiKeyRateLimiter(req, res, next);
      return;
    }
    next();
  });
}

// 15. Protected API routes
app.use('/api/ai', aiRouter);

// Chat is UI-only — same-origin + session auth only (no API key, no cross-origin)
app.use('/api/chat', sameOriginOnly, (req: Request, res: Response, next: NextFunction) => {
  if (req.authMethod === 'api_key') {
    res.status(403).json({ success: false, error: 'Chat endpoints require session authentication' });
    return;
  }
  next();
});
app.use('/api/chat', chatRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/products', productRouter);
app.use('/api/changelogs', changelogRouter);
app.use('/api/users', userRouter);
app.use('/api/github', githubRouter);

// 16. API error handler
app.use('/api', apiErrorHandler);
app.use('/public/api', apiErrorHandler);

// 17. Angular SSR catch-all
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const authContext: AuthContext = {
    authenticated: false,
    user: null,
    dbUser: null,
  };

  if (req.oidc?.isAuthenticated()) {
    authContext.authenticated = true;
    const oidcUser = req.oidc.user;
    if (oidcUser) {
      authContext.user = {
        sub: oidcUser['sub'],
        email: oidcUser['email'],
        name: oidcUser['name'] || oidcUser['email'],
        picture: oidcUser['picture'] || '',
      };
      try {
        const prismaUser = await userService.findByEmail(authContext.user.email);
        if (prismaUser) {
          authContext.dbUser = {
            id: prismaUser.id,
            auth0Id: prismaUser.auth0Id,
            email: prismaUser.email,
            name: prismaUser.name,
            avatarUrl: prismaUser.avatarUrl || '',
            createdAt: prismaUser.createdAt.toISOString(),
            updatedAt: prismaUser.updatedAt.toISOString(),
            roles: ((prismaUser as any).userRoleAssignments || []).map((r: any) => ({
              id: r.id,
              userId: r.userId,
              productId: r.productId,
              role: r.role,
            })),
          };
        }
      } catch {
        serverLogger.warn('Failed to look up user during SSR, continuing without dbUser');
      }
    }
  }

  angularApp
    .handle(req, { auth: authContext })
    .then((response) => {
      if (response) {
        return writeResponseToNodeResponse(response, res);
      }
      return next();
    })
    .catch(next);
});

// 18. Global error handler
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  serverLogger.error({ err: error }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful shutdown
function gracefulShutdown(server: Server): void {
  const shutdown = (signal: string) => {
    serverLogger.info(`${signal} received — shutting down gracefully`);

    // Safety net: force exit after 10s
    const forceTimer = setTimeout(() => {
      serverLogger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      serverLogger.info('HTTP server closed');
      await disconnectPrisma();
      serverLogger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export function startServer(): void {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, () => {
    serverLogger.info(`Node Express server listening on http://localhost:${port}`);
  });
  gracefulShutdown(server);
}

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  startServer();
}

export const reqHandler = createNodeRequestHandler(app);
