# Build multi-stage: la imagen final solo lleva lo que `output: "standalone"`
# de Next.js dice que hace falta en runtime, no el proyecto completo ni
# node_modules sin podar. Las etapas comparten base Debian (bookworm) a
# propósito: el motor de Prisma se genera para el sistema operativo donde
# corre `prisma generate`, así que generarlo en una base y correrlo en otra
# (típicamente Alpine/musl vs Debian/glibc) es la forma más común de romper
# Prisma en Docker. Usando la misma base en todos lados, ese problema no
# puede pasar.
#
# Dos imágenes salen de este mismo archivo (ver docker-compose.prod.yml):
#   --target migrator  → tiene el toolchain completo (TypeScript incluido,
#                         hace falta para que el CLI de Prisma lea
#                         prisma.config.ts). Un job que corre una vez,
#                         aplica las migraciones y termina.
#   --target runner     → (default) el servidor standalone, sin devDependencies
#                         ni el CLI de Prisma: solo el cliente generado, que
#                         ya viaja embebido en el standalone.

FROM node:22-bookworm-slim AS base
# Prisma (motor "classic") necesita OpenSSL en runtime para el binario que
# genera; sin esto el contenedor arranca y explota recién al primer query.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valores dummy: ni `prisma generate` (prisma.config.ts valida que
# DATABASE_URL exista con `env()`, aunque no llegue a conectarse) ni
# `next build` deberían reventar por no encontrar esto al importarse a
# nivel de módulo. Los valores reales los pone docker-compose en runtime,
# nunca quedan grabados en la imagen — por eso son ARG (etapa de build
# nada más) y no ENV (persistiría en la imagen final).
ARG SESSION_SECRET="build-time-placeholder-not-used-at-runtime"
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV SESSION_SECRET=${SESSION_SECRET}
ENV DATABASE_URL=${DATABASE_URL}
# Corre EN esta imagen (no se copia el cliente generado en la máquina de
# desarrollo): así el binario del motor coincide con el Linux del
# contenedor, no con el macOS/Windows de quien está compilando.
RUN npx prisma generate
RUN npm run build

# ── migrator ──────────────────────────────────────────────────────────────
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runner ────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: si algo en la app o en una dependencia logra
# ejecutar código arbitrario, que no corra como root dentro del contenedor.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# El build standalone no incluye `public/` ni `.next/static` por diseño
# (pensado para servirlos desde un CDN aparte) — acá no hay CDN, así que se
# copian a mano al lugar donde `server.js` los espera. El cliente de Prisma
# generado (con su binario de motor) ya viaja adentro de `.next/standalone`
# gracias a `outputFileTracingIncludes` en next.config.ts.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
