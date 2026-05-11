#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-moneyai}"
PORT="${PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:${PORT}/api/health}"

cd "${ROOT_DIR}"
mkdir -p "${LOG_DIR}" data

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command node
require_command npm

if [ "${UPDATE_PULL:-0}" = "1" ]; then
  if [ -d .git ]; then
    echo "[update] pulling latest git changes"
    git pull --ff-only
  else
    echo "[update] UPDATE_PULL=1 set but this directory is not a git repository; skipping git pull"
  fi
fi

if [ "${UPDATE_SKIP_INSTALL:-0}" != "1" ]; then
  echo "[update] installing dependencies"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

if [ "${UPDATE_SKIP_SYNC:-0}" != "1" ]; then
  if [ "${UPDATE_SKIP_INSPECT:-0}" != "1" ]; then
    echo "[update] inspecting upstream catalog coverage"
    npm run inspect:gamsgo
  fi
  echo "[update] syncing catalog data"
  npm run sync:products
  npm run check:catalog
else
  echo "[update] skipping catalog sync because UPDATE_SKIP_SYNC=1"
fi

echo "[update] building frontend"
npm run build

if [ "${UPDATE_SKIP_RESTART:-0}" = "1" ]; then
  echo "[update] skipping service restart because UPDATE_SKIP_RESTART=1"
  HEALTHCHECK_URL=""
elif command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    echo "[update] reloading PM2 app ${APP_NAME}"
    pm2 reload "${APP_NAME}" --update-env
  else
    echo "[update] PM2 app ${APP_NAME} not found; starting server.cjs"
    pm2 start server.cjs --name "${APP_NAME}" --update-env
  fi
else
  echo "[update] pm2 not found; build completed, service restart skipped"
fi

if [ -n "${HEALTHCHECK_URL}" ] && command -v curl >/dev/null 2>&1; then
  echo "[update] waiting for health check: ${HEALTHCHECK_URL}"
  for _ in $(seq 1 20); do
    if curl -fsS "${HEALTHCHECK_URL}" >/dev/null; then
      echo "[update] health check passed"
      exit 0
    fi
    sleep 1
  done
  echo "[update] health check failed" >&2
  exit 1
fi

echo "[update] finished"
