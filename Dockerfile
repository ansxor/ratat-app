# syntax=docker/dockerfile:1.7-labs

FROM oven/bun:1.3-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --parents package.json bun.lock apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --production

COPY packages/common ./packages/common
COPY packages/db ./packages/db
COPY packages/lexicon ./packages/lexicon
COPY apps/xrpc-server ./apps/xrpc-server
COPY apps/ingester ./apps/ingester

EXPOSE 3001
CMD ["bun", "apps/xrpc-server/src/main.ts"]
