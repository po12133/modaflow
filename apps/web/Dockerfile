# syntax=docker/dockerfile:1
#
# ModaFlow Web (Next.js, standalone output). Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t modaflow-web .
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
RUN npm ci --workspace @modaflow/web --include-workspace-root=false \
 && mkdir -p apps/web/node_modules

# ---------- dev (hot reload; source is bind-mounted by compose) ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------- build ----------
FROM deps AS build
# Public variables are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY apps/web apps/web
RUN npm run build --workspace @modaflow/web

# ---------- runner ----------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone output mirrors the monorepo layout: server lives at apps/web/server.js
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
