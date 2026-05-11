#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-moneyai}"
PORT="${PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
PID_FILE="${LOG_DIR}/server.pid"
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

echo "[deploy] installing dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if [ "${DEPLOY_SKIP_SYNC:-0}" != "1" ]; then
  if [ "${DEPLOY_SKIP_INSPECT:-0}" != "1" ]; then
    echo "[deploy] inspecting upstream catalog coverage"
    npm run inspect:gamsgo
  fi
  echo "[deploy] syncing catalog data"
  npm run sync:products
  npm run check:catalog
else
  echo "[deploy] skipping catalog sync because DEPLOY_SKIP_SYNC=1"
fi

echo "[deploy] building frontend"
npm run build

echo "[deploy] starting service on port ${PORT}"
export PORT
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    pm2 restart "${APP_NAME}" --update-env
  else
    pm2 start server.cjs --name "${APP_NAME}" --update-env
  fi
else
  if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" >/dev/null 2>&1; then
    kill "$(cat "${PID_FILE}")"
    sleep 2
  fi
  nohup npm run server >> "${LOG_DIR}/server.log" 2>&1 &
  echo "$!" > "${PID_FILE}"
fi

if command -v curl >/dev/null 2>&1; then
  echo "[deploy] waiting for health check: ${HEALTHCHECK_URL}"
  for _ in $(seq 1 20); do
    if curl -fsS "${HEALTHCHECK_URL}" >/dev/null; then
      echo "[deploy] health check passed"
      exit 0
    fi
    sleep 1
  done
  echo "[deploy] health check failed" >&2
  exit 1
fi

echo "[deploy] curl not found; skipped health check"
