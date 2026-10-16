# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
RUN npm install --global pnpm@11.6.0
WORKDIR /app
# Manifests first so the dependency layer is cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN pnpm -r build
# Self-contained production bundle of the server and its workspace deps.
RUN pnpm --filter @competitor-pulse/server deploy --prod --legacy /out/server

FROM node:24-alpine AS server
ENV NODE_ENV=production \
    FIXTURES_PATH=/app/fixtures/listings.json
WORKDIR /app
COPY --from=build /out/server ./
COPY files/fixtures ./fixtures
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/main.js"]

FROM nginx:1-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
