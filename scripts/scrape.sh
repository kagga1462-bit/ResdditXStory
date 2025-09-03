#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# No explicit .env sourcing here; python-dotenv will load it in the script

# Create venv if missing
if [ ! -d .venv ]; then
	python3 -m venv .venv
fi

# Install requirements if needed
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt" >/dev/null

# Run scraper
"$PROJECT_DIR/.venv/bin/python" "$PROJECT_DIR/scraper/fetch_reddit.py"


