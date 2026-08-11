#!/usr/bin/env bash
# Despliegue sin caída (blue/green) para el VPS. Se corre DESDE el VPS,
# parado en el checkout del repo, con .env.production ya armado al lado
# (ver DEPLOY.md para la primera vez).
#
# Cómo logra el "sin caída": nunca para el contenedor viejo antes de tener
# el nuevo respondiendo. Arranca el nuevo en el puerto que esté libre
# (BLUE_PORT o GREEN_PORT, el que no sea el activo), espera a que conteste
# 200, recién ahí reescribe a qué puerto apunta nginx y le pide un reload —
# que es gracioso: los requests en vuelo en los workers viejos de nginx
# terminan normal, los nuevos ya entran por el puerto nuevo. El contenedor
# viejo se apaga último, cuando ya nadie le está mandando tráfico nuevo.
#
# Los puertos NO están fijos en el código: este VPS es compartido con
# muchos otros sitios, así que cuáles están libres varía por servidor.
# Configurálos en el entorno (ver .env.production.example) antes de correr
# esto la primera vez en una máquina nueva.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_PROJECT="orion"
NETWORK="${COMPOSE_PROJECT}_default"

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE — copiá .env.production.example y completá los valores reales." >&2
  exit 1
fi

# Trae ORION_BLUE_PORT/ORION_GREEN_PORT (y cualquier otra var de $ENV_FILE)
# a este shell — hasta acá solo se los pasábamos al contenedor con
# --env-file, no estaban disponibles para la lógica del script. Tiene que
# pasar ANTES de resolver STATE_FILE/NGINX_UPSTREAM_FILE/HEALTH_* de abajo:
# si se resuelven primero con `${ORION_STATE_FILE:-default}`, la variable
# todavía no existe en este shell y el override del .env se ignora en
# silencio (bug real: pasó en un despliegue con rutas custom, que terminó
# escribiendo en las rutas por defecto mientras nginx seguía apuntando al
# archivo custom con el puerto viejo).
set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

: "${ORION_BLUE_PORT:?falta ORION_BLUE_PORT en $ENV_FILE (ver .env.production.example)}"
: "${ORION_GREEN_PORT:?falta ORION_GREEN_PORT en $ENV_FILE (ver .env.production.example)}"
BLUE_PORT="$ORION_BLUE_PORT"
GREEN_PORT="$ORION_GREEN_PORT"

STATE_FILE="${ORION_STATE_FILE:-/etc/orion/active_port}"
NGINX_UPSTREAM_FILE="${ORION_NGINX_UPSTREAM_FILE:-/etc/nginx/orion-active-upstream.conf}"
HEALTH_PATH="${ORION_HEALTH_PATH:-/api/health}"
HEALTH_RETRIES="${ORION_HEALTH_RETRIES:-30}"
HEALTH_DELAY="${ORION_HEALTH_DELAY:-2}"

echo "==> Levantando postgres/searxng (si no estaban) y aplicando migraciones…"
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d postgres searxng
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" build migrate
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.prod.yml --env-file "$ENV_FILE" run --rm migrate

echo "==> Construyendo la imagen de la app…"
docker build -t orion-app:latest --target runner .

mkdir -p "$(dirname "$STATE_FILE")"
CURRENT_PORT="$(cat "$STATE_FILE" 2>/dev/null || echo "")"
if [ "$CURRENT_PORT" = "$BLUE_PORT" ]; then
  NEW_PORT="$GREEN_PORT"
elif [ "$CURRENT_PORT" = "$GREEN_PORT" ]; then
  NEW_PORT="$BLUE_PORT"
else
  # Primer despliegue: no hay contenedor previo corriendo.
  NEW_PORT="$BLUE_PORT"
fi
NEW_NAME="orion-app-${NEW_PORT}"
OLD_NAME="orion-app-${CURRENT_PORT}"

echo "==> Activo hoy: puerto ${CURRENT_PORT:-ninguno (primer deploy)}. Nuevo: $NEW_PORT ($NEW_NAME)"

# NO usamos `docker run --env-file "$ENV_FILE"` acá: a diferencia de
# `docker compose --env-file` (que sí lo hace), el `docker run` de la CLI de
# Docker NO saca las comillas de un archivo con líneas `VAR="valor"` — las
# deja como parte literal del valor. Como $ENV_FILE tiene que poder
# `source`-arse más arriba (para ORION_BLUE_PORT etc., algunos valores como
# SMTP_FROM necesitan comillas por los espacios/`<>`), en vez de eso le
# pasamos cada variable con `-e NOMBRE` (sin `=valor`): así Docker toma el
# valor ya correcto que `source` dejó en el entorno de este script.
ENV_FLAGS=()
while IFS='=' read -r key _; do
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  ENV_FLAGS+=(-e "$key")
done < <(grep -vE '^\s*(#|$)' "$ENV_FILE")

docker rm -f "$NEW_NAME" >/dev/null 2>&1 || true
docker run -d --name "$NEW_NAME" \
  --network "$NETWORK" \
  -p "127.0.0.1:${NEW_PORT}:3000" \
  "${ENV_FLAGS[@]}" \
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

echo "==> Listo. ${APP_URL:-la app} sirve desde ${NEW_NAME} (:${NEW_PORT})."
