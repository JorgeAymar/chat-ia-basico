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
# WEB_APP_ORIGIN solo importa en runtime (la URL real del backend puede no
# existir todavía durante el build de CI); NEXT_PUBLIC_BASE_PATH en cambio sí
# hace falta en build time — Next lo inlinea en el bundle del cliente, y
# basePath es un valor de build (ver next.config.ts) — por eso es ARG acá
# Y ENV más abajo en runner, a diferencia de WEB_APP_ORIGIN que alcanza con
# pasarlo recién al `docker run`.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
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
