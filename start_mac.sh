#!/bin/bash
set -e

echo ""
echo "========================================"
echo " THE EYE OPENER - Starting up..."
echo "========================================"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python3 not found. Install from python.org"
    exit 1
fi

# Create venv if missing
if [ ! -d ".venv" ]; then
    echo "[SETUP] Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate
source .venv/bin/activate

# Install deps
echo "[SETUP] Checking dependencies..."
pip install -r requirements.txt -q --disable-pip-version-check

# Playwright
python -c "from playwright.sync_api import sync_playwright" 2>/dev/null && \
    playwright install chromium --quiet 2>/dev/null || true

# .env check
if [ ! -f ".env" ]; then
    echo "[SETUP] No .env found. Creating from template..."
    cp .env.example .env
    echo ""
    echo "[ACTION REQUIRED] Add your API keys to .env"
    echo "Opening .env in default editor..."
    open -e .env 2>/dev/null || nano .env
    echo "Press Enter after saving..."
    read
fi

# ChromaDB index
if [ ! -d "chroma_db" ]; then
    echo "[SETUP] Building knowledge base (first run, ~3-5 mins)..."
    python -m services.indexer
fi

# Ollama check
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "[OK] Ollama detected. Using local LLM."
else
    echo "[INFO] Ollama not running. Using cloud LLM fallback."
fi

echo ""
echo "========================================"
echo " Opening http://localhost:5000"
echo "========================================"
echo ""

# Open browser
sleep 3 && open http://localhost:5000 &

python app.py
