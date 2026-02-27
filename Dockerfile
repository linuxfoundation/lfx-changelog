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

# Copy app-level @prisma/client + generated .prisma client (not hoisted to root by Yarn)
COPY --from=builder /app/apps/lfx-changelog/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/apps/lfx-changelog/node_modules/.prisma ./node_modules/.prisma

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
