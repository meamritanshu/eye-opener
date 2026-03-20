# The Eye Opener

> AI-powered political claim verification for India, built with Flask, LangGraph, ChromaDB, and SQLite.

![Python](https://img.shields.io/badge/Python-3.13+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-Web%20App-000000?logo=flask&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Orchestrated%20Pipeline-111827)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

The Eye Opener is a local-first fact-checking workspace for Indian political claims. It accepts plain text or a YouTube URL, extracts claims, gathers evidence from local and live sources, and streams the result back to the browser in real time.

### At a glance

| Area | Details |
| --- | --- |
| Input | Plain text claim or YouTube URL |
| Pipeline | preprocessor -> surgeon -> diver -> skeptic -> scorer |
| Output | Verdicts, truth score, sources, and retrieval method |
| Streaming | Server-Sent Events for live stage updates |
| Storage | ChromaDB vector store + SQLite cache |
| UI | HTML, CSS, vanilla JavaScript |

### Runtime profile

- Local-first inference through Ollama when enabled and reachable
- Cloud fallback chain through Cerebras and Groq, with GitHub Models available for quality mode
- Hybrid retrieval with local ChromaDB plus live DuckDuckGo enrichment
- Real-time stream updates via Server-Sent Events

## How It Works

1. The browser submits a claim or YouTube URL.
2. The preprocessor normalizes the input or extracts the transcript.
3. The surgeon extracts verifiable factual claims.
4. The diver retrieves supporting and conflicting evidence.
5. The skeptic challenges missing context and framing.
6. The scorer returns per-claim verdicts and a 0-100 truth score.

### Architecture

| Stage | Responsibility |
| --- | --- |
| preprocessor | Normalize text and fetch YouTube transcripts |
| surgeon | Extract specific, testable claims |
| diver | Collect evidence from RAG and live search |
| skeptic | Flag omissions, selective framing, and weak support |
| scorer | Produce verdicts and the aggregate truth score |
| error_handler | Terminal failure node for handled pipeline errors |

### Retrieval model

- RAG first from the local ChromaDB collection
- Live fallback via DuckDuckGo search
- Extra live enrichment for legal claims through IndianKanoon
- Extra live enrichment for government claims through PIB search

## Features

- Live streaming workflow updates in the browser
- Local-first LLM routing with cloud fallbacks
- YouTube transcript support through the main input box
- Persistent local cache for repeated queries
- Settings drawer for runtime provider configuration
- Source summaries and per-claim explanation cards

## Tech Stack

### Backend

- Flask
- Flask-CORS
- LangGraph

### LLM and embeddings

- Primary: local Ollama when `USE_LOCAL_LLM=true` and Ollama is reachable
- Fallback 1: Cerebras
- Fallback 2: Groq
- Quality mode fallback: GitHub Models when explicitly requested and no other providers are available
- Embeddings: OllamaEmbeddings with `nomic-embed-text`

### Data

- ChromaDB persistent local vector store
- SQLite exact-match cache in `local_cache.db`

### Frontend

- HTML, CSS, and vanilla JavaScript
- Streaming observer console, result panels, and settings drawer

## Quick Start

### Windows
Double-click `start.bat`

### Mac
chmod +x start_mac.sh && ./start_mac.sh

### Something broken?
python setup_check.py

## Operating System Notes

### Windows

- Use `python` in PowerShell if it points to your installed interpreter.
- Activate the virtual environment with `.\.venv\Scripts\Activate.ps1`.
- If script execution is blocked, run PowerShell once with an elevated policy change such as `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### macOS

- Use `python3` instead of `python` if your shell maps `python` to Python 2 or nothing.
- Activate the virtual environment with `source .venv/bin/activate`.
- If you use Homebrew or pyenv, make sure the shell session points to the same interpreter you used to create the environment.

### Ollama on both platforms

- Start Ollama before launching the app if you want local inference.
- Default model: `XianYu_bi/DeepSeek-R1-Distill-Qwen-14B-Q3_K_M:latest`
- Default embedding model: `nomic-embed-text`

## Configuration

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `FLASK_ENV` | Flask runtime mode |
| `FLASK_PORT` | Server port |
| `CHROMA_DB_PATH` | Local vector store location |
| `USE_LOCAL_LLM` | Prefer Ollama when available |
| `OLLAMA_BASE_URL` | Ollama server URL |
| `OLLAMA_MODEL` | Ollama chat model |
| `CEREBRAS_API_KEY` | Cerebras fallback key |
| `CEREBRAS_MODEL` | Cerebras model name |
| `GROQ_API_KEY` | Groq fallback key |
| `GROQ_MODEL` | Groq model name |
| `GITHUB_TOKEN` | GitHub Models access token |
| `GITHUB_QUALITY_MODEL` | Quality-mode model name |

## Repository Map

### Core backend

- [app.py](app.py)
- [config.py](config.py)
- [services/architect.py](services/architect.py)
- [services/runner.py](services/runner.py)
- [services/agents.py](services/agents.py)
- [services/preprocessor.py](services/preprocessor.py)
- [services/retriever.py](services/retriever.py)
- [services/indexer.py](services/indexer.py)
- [services/state.py](services/state.py)
- [services/llm.py](services/llm.py)
- [services/cache.py](services/cache.py)

### Frontend

- [static/index.html](static/index.html)
- [static/css/style.css](static/css/style.css)
- [static/js/main.js](static/js/main.js)
- [static/js/settings.js](static/js/settings.js)

### Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/api.md](docs/api.md)
- [docs/project_overview.md](docs/project_overview.md)
- [docs/agent_orchestration_clarification.md](docs/agent_orchestration_clarification.md)
- [implementation_checklist.md](implementation_checklist.md)
- [implementation_plan.md](implementation_plan.md)
- [phase_wise_implementation_plan.md](phase_wise_implementation_plan.md)
- [NEXT_SESSION.md](NEXT_SESSION.md)

## Project Status

### Implemented

- End-to-end streamed pipeline and UI wiring
- Local-first Ollama routing plus cloud fallbacks
- Expanded source catalog with category metadata
- Source skip controls with explicit skip reasons
- Legal and PIB live retrieval enrichments
- SQLite exact-match query caching to reduce repeated work
- Streaming observer console and structured result panels
- Scorer hardening for think-block stripping and zero-score fallback
- Settings and Ollama model endpoints in the Flask app

### Partially complete

- Source coverage for dynamic or blocked websites remains intentionally limited for static indexing
- Retrieval quality still depends on the strength of local index coverage and live snippets

### Open issues

- Empty-input SSE runs still finish with a terminal `complete` event carrying `state.error` instead of a dedicated terminal `error` event
- Integration and regression coverage is still limited
- Documentation and release notes need to stay in sync with implementation changes

## Troubleshooting

### The UI says the stream failed immediately

- Make sure the Flask server is running at `http://localhost:5000`.
- Make sure the app was started from the project root.
- If you are using local inference, verify that Ollama is running and reachable.

### The app starts but returns no useful verdicts

- Refresh or rebuild the index with `python -m services.indexer`.
- Confirm that your environment variables point to the intended provider.
- Check `config.py` and the settings drawer for the active LLM mode.

### Windows-specific startup issues

- Use PowerShell to activate the virtual environment.
- If the terminal blocks script execution, fix the execution policy for the current user.

### macOS-specific startup issues

- Use `python3` and `pip`/`pip3` consistently in the same environment.
- Ensure the venv is activated before running the indexer or Flask app.

## License

MIT License. Built for educational and research use.
