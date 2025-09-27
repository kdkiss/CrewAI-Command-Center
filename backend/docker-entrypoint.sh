#!/usr/bin/env bash
set -euo pipefail

APP_USER=${APP_USER:-appuser}
APP_GROUP=${APP_GROUP:-appgroup}
APP_UID=${APP_UID:-}
APP_GID=${APP_GID:-}
CREWS_PATH=${CREWS_PATH:-/app/crews}
CMD=("$@")

# Ensure the application group exists and matches the requested GID when set.
if [[ -n "${APP_GID}" ]]; then
    if getent group "${APP_GROUP}" >/dev/null 2>&1; then
        CURRENT_GID=$(getent group "${APP_GROUP}" | cut -d: -f3)
        if [[ "${CURRENT_GID}" != "${APP_GID}" ]]; then
            groupmod -o -g "${APP_GID}" "${APP_GROUP}"
        fi
    else
        groupadd -o -g "${APP_GID}" "${APP_GROUP}"
    fi
fi

# Ensure the application user exists and matches the requested UID when set.
if id "${APP_USER}" >/dev/null 2>&1; then
    if [[ -n "${APP_UID}" ]]; then
        CURRENT_UID=$(id -u "${APP_USER}")
        if [[ "${CURRENT_UID}" != "${APP_UID}" ]]; then
            usermod -o -u "${APP_UID}" "${APP_USER}"
        fi
    fi
else
    if [[ -n "${APP_UID}" ]]; then
        useradd -o -M -N -u "${APP_UID}" -g "${APP_GROUP}" "${APP_USER}"
    else
        useradd -r -g "${APP_GROUP}" "${APP_USER}"
    fi
fi

# Ensure the crews directory exists so we can test permissions below.
mkdir -p "${CREWS_PATH}"

# Attempt to align ownership for application directories. These operations are
# best-effort and may legitimately fail on bind mounts depending on the host
# filesystem. We swallow the errors to keep the startup path resilient.
chown "${APP_USER}:${APP_GROUP}" /app 2>/dev/null || true
chown "${APP_USER}:${APP_GROUP}" "${CREWS_PATH}" 2>/dev/null || true

# When the crews directory is writable we drop to the unprivileged user. If not,
# we log a warning and continue as root so the API remains reachable (the
# documentation covers the steps required to fix host permissions).
if gosu "${APP_USER}" test -w "${CREWS_PATH}"; then
    exec gosu "${APP_USER}" "${CMD[@]}"
else
    echo "[crew-backend] WARN: ${CREWS_PATH} is not writable by ${APP_USER}; starting as root. Set APP_UID/APP_GID to match your host to silence this warning." >&2
    exec "${CMD[@]}"
fi
