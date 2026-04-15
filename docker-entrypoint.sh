#!/bin/sh
set -e

export GATEWAY_HOST="${GATEWAY_HOST:-host.docker.internal}"
export GATEWAY_WS_PORT="${GATEWAY_WS_PORT:-8787}"
export GATEWAY_REST_PORT="${GATEWAY_REST_PORT:-18790}"

envsubst '${GATEWAY_HOST} ${GATEWAY_WS_PORT} ${GATEWAY_REST_PORT}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

rm -f /etc/nginx/conf.d/default.conf.template

exec nginx -g 'daemon off;'
