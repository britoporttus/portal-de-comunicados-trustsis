#!/usr/bin/env bash
# Dev da RAIZ do Portal TrustSis — sobe backend (Node/Express) + frontend (Vite) juntos, ambos em 0.0.0.0.
# Portas vêm do ambiente (Hive injeta PORT/API_PORT); defaults de dev locais.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${PORT:-3000}"

# garante deps do backend
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "[dev] instalando deps do backend..."
  ( cd "$ROOT/server" && npm install --no-audit --no-fund )
fi

# backend em background
( cd "$ROOT/server" && API_PORT="$API_PORT" exec npx tsx watch src/index.ts ) &
API_PID=$!
trap 'kill "$API_PID" "${WEB_PID:-}" 2>/dev/null' EXIT INT TERM

# frontend em foreground (processo principal), proxy /api -> backend
cd "$ROOT"
export BACKEND_INTERNAL_URL="http://127.0.0.1:$API_PORT"
npx vite --host 0.0.0.0 --port "$WEB_PORT" &
WEB_PID=$!
wait "$WEB_PID"
