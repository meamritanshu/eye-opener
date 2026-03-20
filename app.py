import importlib
import json
import os
import re
from pathlib import Path

import requests

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

import config


app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


def _llm_config_error_response() -> tuple[Response, int]:
    return (
        jsonify(
            {
                "status": "error",
                "error": "Server configuration is incomplete.",
                "details": config.CONFIG_ERRORS,
            }
        ),
        503,
    )


@app.get("/")
def index() -> Response:
    try:
        return send_from_directory("static", "index.html")
    except Exception as exc:
        return jsonify({"error": f"Failed to load index page: {exc}"}), 500


@app.get("/api/health")
def health() -> Response:
    try:
        return jsonify(
            {
                "status": "ok",
                "config_ok": len(config.CONFIG_ERRORS) == 0,
                "config_errors": config.CONFIG_ERRORS,
                "config_warnings": config.CONFIG_WARNINGS,
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Health check failed: {exc}"}), 500


@app.post("/api/verify")
def verify() -> Response:
    try:
        if config.CONFIG_ERRORS:
            return _llm_config_error_response()

        from services.runner import run_pipeline_once

        payload = request.get_json(silent=True) or {}
        raw_input = str(payload.get("input", "")).strip()

        state = run_pipeline_once(raw_input)

        if state.get("error"):
            return jsonify({"status": "error", "state": state}), 400

        return jsonify({"status": "ok", "state": state})
    except Exception as exc:
        return jsonify({"error": f"Verify route failed: {exc}"}), 500


@app.get("/api/stream")
def stream() -> Response:
    try:
        if config.CONFIG_ERRORS:
            return _llm_config_error_response()

        from services.runner import stream_pipeline

        raw_input = request.args.get("input", "").strip()

        def event_stream():
            try:
                for payload in stream_pipeline(raw_input):
                    yield f"data: {json.dumps(payload)}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'event_type': 'error', 'message': str(exc)})}\n\n"

        return Response(event_stream(), mimetype="text/event-stream")
    except Exception as exc:
        return jsonify({"error": f"Stream route failed: {exc}"}), 500


# ── Ollama Models API ─────────────────────────────────────────────────────────

@app.get("/api/ollama-models")
def ollama_models() -> Response:
    """Proxy Ollama's /api/tags to list locally available models."""
    try:
        base = config.OLLAMA_BASE_URL.rstrip("/")
        resp = requests.get(f"{base}/api/tags", timeout=4)
        resp.raise_for_status()
        models = resp.json().get("models", [])
        names = [m.get("name", "") for m in models if m.get("name")]
        return jsonify({"status": "ok", "models": sorted(names)})
    except requests.ConnectionError:
        return jsonify({"status": "error", "error": "Cannot reach Ollama. Is it running?", "models": []}), 502
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc), "models": []}), 500


# ── Settings API ──────────────────────────────────────────────────────────────

SETTINGS_KEYS = {
    "USE_LOCAL_LLM",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
    "CEREBRAS_API_KEY",
    "CEREBRAS_MODEL",
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "GITHUB_TOKEN",
    "GITHUB_QUALITY_MODEL",
}

ENV_PATH = Path(__file__).parent / ".env"


def _write_env(updates: dict) -> None:
    """Merge *updates* into the .env file, preserving unrelated lines."""
    # Read existing lines (or start fresh)
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()

    written_keys: set[str] = set()
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=', stripped)
        if m and m.group(1) in updates:
            key = m.group(1)
            new_lines.append(f'{key}={updates[key]}')
            written_keys.add(key)
        else:
            new_lines.append(line)

    # Append any keys that weren't already in the file
    for key, value in updates.items():
        if key not in written_keys:
            new_lines.append(f'{key}={value}')

    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@app.get("/api/settings")
def get_settings() -> Response:
    try:
        return jsonify({"status": "ok", "settings": config.get_settings_dict()})
    except Exception as exc:
        return jsonify({"error": f"Failed to read settings: {exc}"}), 500


@app.post("/api/settings")
def save_settings() -> Response:
    try:
        payload = request.get_json(silent=True) or {}
        # Filter to only known keys
        updates: dict[str, str] = {}
        for key in SETTINGS_KEYS:
            if key in payload:
                updates[key] = str(payload[key])

        if not updates:
            return jsonify({"status": "error", "error": "No valid settings keys provided."}), 400

        _write_env(updates)

        # Reload environment variables so the running process reflects changes
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=ENV_PATH, override=True)
        importlib.reload(config)

        return jsonify({"status": "ok", "updated": list(updates.keys())})
    except Exception as exc:
        return jsonify({"error": f"Failed to save settings: {exc}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", config.FLASK_PORT))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=not config.IS_PRODUCTION,
        use_reloader=False,
    )
