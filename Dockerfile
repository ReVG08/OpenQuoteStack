FROM node:24-bookworm-slim AS base
WORKDIR /app
ARG OQS_BUILD_ID=local
ENV NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1 OQS_VERSION=0.2.0-alpha.1 OQS_BUILD_ID=$OQS_BUILD_ID
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.34.6

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/sdk/package.json ./packages/sdk/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM build AS service-files
RUN pnpm --filter @openquotestack/database deploy --prod --legacy /app/services

FROM base AS services
ENV NODE_ENV=production OQS_TEMPLATE_DIR=/app/templates
COPY --from=build --chown=node:node /app/templates ./templates
COPY --from=service-files --chown=node:node /app/services ./
COPY --from=build --chown=node:node /app/scripts/worker.ts /app/scripts/worker-health.ts ./scripts/
RUN mkdir -p /app/data/assets && chown -R node:node /app/data
USER node

FROM services AS migration
CMD ["pnpm", "migrate"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ARG OQS_BUILD_ID=local
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 OQS_VERSION=0.2.0-alpha.1 OQS_BUILD_ID=$OQS_BUILD_ID
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
RUN mkdir -p /app/data/assets && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM services AS worker
CMD ["node", "--import", "tsx", "scripts/worker.ts"]
