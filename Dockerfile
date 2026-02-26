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
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY turbo.json ./
COPY packages/web ./packages/web
COPY packages/server ./packages/server

# Build the application
RUN pnpm build

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS production

# Install pandoc for markdown conversion
RUN apk add --no-cache pandoc

WORKDIR /app

# Copy built server
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./

# Copy built web app
COPY --from=builder /app/packages/web/build ./web/build

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate && \
    pnpm install --prod --frozen-lockfile || npm install --omit=dev

# Create data directory mount point
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV TIS_DB_PATH=/data/tis.sqlite
ENV DOCS_DB_PATH=/data/docs.sqlite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
