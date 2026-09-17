# NexDrive Automotive OS — production image
# Build:  docker build -t nexdrive .
# Run:    see docker-compose.yml (app + PostgreSQL + Caddy for HTTPS) and DEPLOY.md

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate only needs a URL shape; no database is contacted at build time
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-only-secret"
RUN npx prisma generate && npx next build
# self-contained Prisma CLI (with its own dependency tree) for running migrations at start-up
WORKDIR /app/tools
COPY docker/tools/package.json ./package.json
RUN npm install --no-audit --no-fund --omit=dev
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r nexdrive && useradd -r -g nexdrive -d /app nexdrive
# Next.js standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# bcryptjs is bundled into the server, but docker/create-admin.js needs it as a module
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
# migration tooling
COPY --from=build /app/tools ./tools
COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/create-admin.js ./docker/create-admin.js
RUN chmod +x ./entrypoint.sh && mkdir -p /app/var/uploads && chown -R nexdrive:nexdrive /app
USER nexdrive
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
