# syntax=docker/dockerfile:1
#
# ModaFlow Admin Web (Next.js, standalone output). Build context: repository root.
#   docker build -f apps/admin-web/Dockerfile -t modaflow-admin-web .
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
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------- deps (cached by lockfile) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/admin-web/package.json apps/admin-web/
COPY packages/ui/package.json packages/ui/
RUN npm ci --workspace @modaflow/admin-web --include-workspace-root=false \
 && mkdir -p apps/admin-web/node_modules

# ---------- dev (hot reload; source is bind-mounted by compose) ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/ui packages/ui
COPY apps/admin-web apps/admin-web
WORKDIR /app/apps/admin-web
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------- build ----------
FROM deps AS build
COPY packages/ui packages/ui
COPY apps/admin-web apps/admin-web
RUN npm run build --workspace @modaflow/admin-web

# ---------- runner ----------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone output mirrors the monorepo layout: server lives at apps/admin-web/server.js
COPY --from=build --chown=node:node /app/apps/admin-web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=build --chown=node:node /app/apps/admin-web/public ./apps/admin-web/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin-web/server.js"]
