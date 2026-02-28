# Copyright The Linux Foundation and each contributor to LFX.
# SPDX-License-Identifier: MIT

# Build stage
FROM node:22-alpine AS builder

ARG BUILD_ENV=prod

RUN corepack enable

WORKDIR /app

# Copy package files ONLY for dependency installation (better layer caching)
COPY package.json yarn.lock turbo.json .yarnrc.yml ./
COPY apps/lfx-changelog/package.json ./apps/lfx-changelog/
COPY packages/shared/package.json ./packages/shared/
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install dependencies (this layer is cached when deps don't change)
RUN yarn install --immutable

# NOW copy source code (changes here won't invalidate the dependency layer)
COPY . .

# Prisma generate only reads the schema (never connects), but prisma.config.ts
# still loads buildConnectionString() which requires DB env vars. Provide
# harmless defaults so the config resolves without error.
ENV DB_HOST=localhost DB_PORT=5432 DB_NAME=placeholder DB_USER=placeholder DB_PASSWORD=placeholder

# Generate Prisma client
RUN yarn workspace lfx-changelog prisma generate

# Build application (build:dev or build:prod via turbo)
RUN yarn turbo run build:${BUILD_ENV} --filter=lfx-changelog

# Production stage
FROM node:22-alpine

# OCI image labels
LABEL org.opencontainers.image.title="LFX Changelog"
LABEL org.opencontainers.image.description="Linux Foundation LFX Changelog application"
LABEL org.opencontainers.image.vendor="The Linux Foundation"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/linuxfoundation/lfx-changelog"

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy root node_modules (runtime deps: @prisma/adapter-pg, pg + transitive deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy app-level Prisma packages (not hoisted to root by Yarn)
# - @prisma/client + .prisma: generated client for the app
# - prisma: CLI needed for prisma migrate deploy in k8s
COPY --from=builder /app/apps/lfx-changelog/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/apps/lfx-changelog/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/lfx-changelog/node_modules/prisma ./node_modules/prisma

# Copy Prisma schema, migrations, and config (needed for prisma migrate deploy in k8s)
COPY --from=builder /app/apps/lfx-changelog/prisma ./prisma
COPY --from=builder /app/apps/lfx-changelog/prisma.config.ts ./prisma.config.ts

# Copy source files required by prisma.config.ts import chain:
# prisma.config.ts → build-connection-string → server-logger → error-serializer
COPY --from=builder /app/apps/lfx-changelog/src/server/helpers/build-connection-string.ts ./src/server/helpers/build-connection-string.ts
COPY --from=builder /app/apps/lfx-changelog/src/server/helpers/error-serializer.ts ./src/server/helpers/error-serializer.ts
COPY --from=builder /app/apps/lfx-changelog/src/server/server-logger.ts ./src/server/server-logger.ts

# Copy workspace packages required at runtime (symlinked from node_modules).
# BuildKit preserves symlinks, so node_modules/@lfx-changelog/* point to
# ../../packages/*. Both shared and mcp-server must exist at their symlink targets.
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/mcp-server/package.json ./packages/mcp-server/package.json
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

# Copy built application
COPY --from=builder /app/apps/lfx-changelog/dist/lfx-changelog ./dist/lfx-changelog

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/lfx-changelog/server/server.mjs"]
