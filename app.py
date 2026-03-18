import json
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.FLASK_PORT, debug=config.FLASK_ENV == "development")
