#!/usr/bin/env bash
set -euo pipefail

# Deployment script for VPS or generic Linux host
# - Loads .env (for DATABASE_URL, PORT, etc.)
# - Installs Node dependencies (production)
# - Applies DB schema (idempotent)
# - Preps Python venv and scraper deps
# - Optionally seeds once
# - Starts Node server via pm2 if available, else with nohup

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "[deploy] Project: $PROJECT_DIR"

if [ -f .env ]; then
	echo "[deploy] Loading .env"
	set -a
	. ./.env
	set +a
fi

echo "[deploy] Installing Node dependencies (production)"
if command -v npm >/dev/null 2>&1; then
	# Prefer clean install with production-only deps
	if [ -f package-lock.json ]; then
		npm ci --omit=dev
	else
		npm install --omit=dev
	fi
else
	echo "[deploy] ERROR: npm not found" >&2
	exit 1
fi


echo "[deploy] Ensuring Python venv and scraper requirements"
if ! command -v python3 >/dev/null 2>&1; then
	echo "[deploy] WARNING: python3 not found; skipping scraper setup"
else
	if [ ! -d .venv ]; then
		python3 -m venv .venv
	fi
	"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt" >/dev/null
fi

if [ "${SEED_ON_DEPLOY:-false}" = "true" ]; then
	echo "[deploy] Seeding recent stories (one-time)"
	"$PROJECT_DIR/.venv/bin/python" "$PROJECT_DIR/scraper/fetch_reddit.py" || true
fi

START_CMD=("node" "backend/server.js")

echo "[deploy] Starting server"
if command -v pm2 >/dev/null 2>&1; then
	APP_NAME="redditxstory"
	# Stop existing
	pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
	# Start with env
	pm2 start "${START_CMD[@]}" --name "$APP_NAME" --update-env
	pm2 save || true
	pm2 status "$APP_NAME"
else
	echo "[deploy] pm2 not found; starting with nohup (background)"
	nohup "${START_CMD[@]}" > server.out 2>&1 &
	echo $! > server.pid
	echo "[deploy] Server PID $(cat server.pid)"
fi

echo "[deploy] Done."


