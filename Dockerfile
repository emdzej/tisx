FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @tisx/server build
RUN pnpm --filter web build
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV TIS_DB_PATH=/data/tis.sqlite
ENV DOCS_DB_PATH=/data/docs.sqlite
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/package.json /app/packages/server/package.json
COPY --from=build /app/packages/server/node_modules /app/packages/server/node_modules
COPY --from=build /app/packages/server/dist /app/packages/server/dist
COPY --from=build /app/packages/server/assets /app/packages/server/assets
COPY --from=build /app/packages/web/build /app/packages/web/build

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
