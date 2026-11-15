# syntax=docker/dockerfile:1
#
# ModaFlow API (NestJS + Prisma). Build context: repository root.
#   docker build -f apps/api/Dockerfile -t modaflow-api .
#
# Targets:
#   dev    -> hot reload (deploy/development/compose.yaml)
#   runner -> production image (deploy/production/compose.yaml)

ARG NODE_IMAGE=node:24-alpine

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
# npm 11 is required: npm 10 fails to resolve this workspace tree and does not
# understand the "allowScripts" policy in the root package.json.
RUN npm install -g npm@11.21.2 && npm cache clean --force
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app

# ---------- deps (all dependencies, cached by lockfile) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @modaflow/api --include-workspace-root=false \
 && mkdir -p apps/api/node_modules

# ---------- dev (hot reload; source is bind-mounted by compose) ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/api apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]

# ---------- build ----------
FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace @modaflow/api

# ---------- production dependencies only ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Note: @prisma/client declares the Prisma CLI as a peer dependency, so npm keeps
# it even with --omit=dev. That is intentional here: it allows running
# `npx prisma migrate deploy` inside the production container once models exist.
RUN npm ci --workspace @modaflow/api --include-workspace-root=false --omit=dev \
 && mkdir -p apps/api/node_modules \
 && npm cache clean --force

# ---------- runner ----------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    PORT=3001 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
# Schema + config so `npx prisma migrate deploy` can run in this container.
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma7.config.ts ./apps/api/prisma7.config.ts
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
