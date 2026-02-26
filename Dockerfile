# Build stage
FROM node:22-alpine AS builder

ARG BUILD_ENV=prod

RUN corepack enable

WORKDIR /app

# Copy source
COPY . .

# Install dependencies
RUN yarn install --immutable

# Generate Prisma client
RUN yarn workspace lfx-changelog prisma generate

# Build application (build:dev or build:prod via turbo)
RUN yarn turbo run build:${BUILD_ENV} --filter=lfx-changelog

# Production stage
FROM node:22-alpine

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
