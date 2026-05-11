#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
LOCK_DIR="${ROOT_DIR}/.tmp/product-sync.lock"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

cd "${ROOT_DIR}"
mkdir -p "${LOG_DIR}" .tmp data

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[$(timestamp)] another product sync is still running; exit"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}"' EXIT

echo "[$(timestamp)] product sync started"
if [ "${SYNC_SKIP_INSPECT:-0}" != "1" ]; then
  npm run inspect:gamsgo
fi
npm run sync:products
npm run check:catalog
npm run build

if [ -n "${HEALTHCHECK_URL}" ] && command -v curl >/dev/null 2>&1; then
  curl -fsS "${HEALTHCHECK_URL}" >/dev/null
  echo "[$(timestamp)] health check passed: ${HEALTHCHECK_URL}"
fi

echo "[$(timestamp)] product sync finished"
