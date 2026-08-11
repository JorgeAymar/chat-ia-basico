#!/usr/bin/env bash
# Despliegue sin caída (blue/green) para el VPS. Se corre DESDE el VPS,
# parado en el checkout del repo, con .env.production ya armado al lado
# (ver DEPLOY.md para la primera vez).
#
# Cómo logra el "sin caída": nunca para el contenedor viejo antes de tener
# el nuevo respondiendo. Arranca el nuevo en el puerto que esté libre
# (3001 o 3002, el que no sea el activo), espera a que conteste 200, recién
# ahí reescribe a qué puerto apunta nginx y le pide un reload — que es
# gracioso: los requests en vuelo en los workers viejos de nginx terminan
# normal, los nuevos ya entran por el puerto nuevo. El contenedor viejo se
# apaga último, cuando ya nadie le está mandando tráfico nuevo.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_PROJECT="orion"
NETWORK="${COMPOSE_PROJECT}_default"
STATE_FILE="/etc/orion/active_port"
NGINX_UPSTREAM_FILE="/etc/nginx/orion-active-upstream.conf"
HEALTH_PATH="/api/models"
HEALTH_RETRIES=30
HEALTH_DELAY=2

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE — copiá .env.production.example y completá los valores reales." >&2
  exit 1
fi

echo "==> Levantando postgres/searxng (si no estaban) y aplicando migraciones…"
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d postgres searxng
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" build migrate
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" run --rm migrate

echo "==> Construyendo la imagen de la app…"
docker build -t orion-app:latest --target runner .

mkdir -p "$(dirname "$STATE_FILE")"
CURRENT_PORT="$(cat "$STATE_FILE" 2>/dev/null || echo "")"
if [ "$CURRENT_PORT" = "3001" ]; then
  NEW_PORT=3002
elif [ "$CURRENT_PORT" = "3002" ]; then
  NEW_PORT=3001
else
  # Primer despliegue: no hay contenedor previo corriendo.
  NEW_PORT=3001
fi
NEW_NAME="orion-app-${NEW_PORT}"
OLD_NAME="orion-app-${CURRENT_PORT}"

echo "==> Activo hoy: puerto ${CURRENT_PORT:-ninguno (primer deploy)}. Nuevo: $NEW_PORT ($NEW_NAME)"

# --env-file le pasa al contenedor TODO lo que hay en .env.production tal
# cual (incluida la DATABASE_URL, que ahí adentro ya usa el hostname interno
# `postgres`, no localhost): no hace falta reconstruir nada acá.
docker rm -f "$NEW_NAME" >/dev/null 2>&1 || true
docker run -d --name "$NEW_NAME" \
  --network "$NETWORK" \
  -p "127.0.0.1:${NEW_PORT}:3000" \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  orion-app:latest

echo "==> Esperando a que ${NEW_NAME} conteste en :${NEW_PORT}${HEALTH_PATH}…"
ok=""
for _ in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sf "http://127.0.0.1:${NEW_PORT}${HEALTH_PATH}" >/dev/null; then
    ok=1
    break
  fi
  sleep "$HEALTH_DELAY"
done

if [ -z "$ok" ]; then
  echo "!! ${NEW_NAME} no contestó a tiempo. No se toca nginx ni se apaga nada viejo." >&2
  echo "!! Revisá los logs: docker logs ${NEW_NAME}" >&2
  exit 1
fi

echo "==> ${NEW_NAME} está sano. Apuntando nginx a :${NEW_PORT}…"
echo "server 127.0.0.1:${NEW_PORT};" > "$NGINX_UPSTREAM_FILE"
nginx -t
systemctl reload nginx

echo "$NEW_PORT" > "$STATE_FILE"

if [ -n "$CURRENT_PORT" ] && [ "$OLD_NAME" != "$NEW_NAME" ]; then
  echo "==> Apagando el contenedor anterior (${OLD_NAME})…"
  docker rm -f "$OLD_NAME" >/dev/null 2>&1 || true
fi

echo "==> Listo. orion.labshub.cc sirve desde ${NEW_NAME} (:${NEW_PORT})."
