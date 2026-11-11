# Build multi-stage, igual criterio que el Dockerfile del cliente web (ver
# su comentario), pero más simple: esta app no tiene Prisma ni base de datos
# propia (ver next.config.ts), así que no hace falta una etapa `migrator`
# ni generar ningún cliente antes del build.

FROM node:22-bookworm-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Los dos hacen falta en BUILD time: NEXT_PUBLIC_BASE_PATH porque Next lo
# inlinea en el bundle del cliente, y WEB_APP_ORIGIN porque los rewrites de
# next.config.ts se resuelven al compilar y quedan fijos en
# .next/routes-manifest.json — pasarlo recién al `docker run` no sirve (bug
# real: el destino quedó horneado como el default http://localhost:3000, que
# dentro del contenedor es esta misma app, y todo /m/api/* daba 404).
ARG NEXT_PUBLIC_BASE_PATH=""
ARG WEB_APP_ORIGIN=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV WEB_APP_ORIGIN=${WEB_APP_ORIGIN}
RUN test -n "$WEB_APP_ORIGIN" || (echo "falta --build-arg WEB_APP_ORIGIN" >&2; exit 1)
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
