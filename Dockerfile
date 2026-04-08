# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/rtf/package.json ./packages/rtf/
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY turbo.json ./
COPY packages/rtf ./packages/rtf
COPY packages/core ./packages/core
COPY packages/web ./packages/web
COPY packages/server ./packages/server

# Build the application
RUN pnpm build

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS production

# Install build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

# Install pnpm (needed to resolve workspace dependencies)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Set up workspace structure so pnpm can link @emdzej/tisx-core
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy built rtf package (core depends on it at runtime)
COPY --from=builder /app/packages/rtf/package.json ./packages/rtf/
COPY --from=builder /app/packages/rtf/dist ./packages/rtf/dist

# Copy built core package (server depends on it at runtime)
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist

# Copy built server
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Copy web package.json (needed for pnpm workspace resolution) and built web app
COPY --from=builder /app/packages/web/package.json ./packages/web/
COPY --from=builder /app/packages/web/build ./packages/server/web/build

# Install production dependencies only (workspace-aware)
RUN pnpm install --prod --frozen-lockfile

# Create data directory mount point
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV TIS_DB_PATH=/data/tis.sqlite

EXPOSE 3000

WORKDIR /app/packages/server

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
