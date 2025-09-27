#!/usr/bin/env sh
set -eu

# Preserve backwards compatibility with the previous BACKEND_HOST/BACKEND_PORT
# environment variables. If the new service-scoped variables are unset we fall
# back to the legacy names so existing deployments do not break.
if [ "${BACKEND_SERVICE_HOST:-}" = "" ] && [ "${BACKEND_HOST:-}" != "" ]; then
  export BACKEND_SERVICE_HOST="$BACKEND_HOST"
fi

if [ "${BACKEND_SERVICE_PORT:-}" = "" ] && [ "${BACKEND_PORT:-}" != "" ]; then
  export BACKEND_SERVICE_PORT="$BACKEND_PORT"
fi

exec /docker-entrypoint.sh "$@"
