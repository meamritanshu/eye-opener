# The Eye Opener

AI-powered political claim verification for India, built with Flask, LangGraph, ChromaDB, and SQLite.

Current runtime profile:
- Local-first inference through Ollama when it is enabled and reachable
- Cloud fallback chain through Cerebras and Groq, with GitHub Models available for quality mode
- Hybrid retrieval with local ChromaDB plus live DuckDuckGo enrichment
- Real-time stream updates via Server-Sent Events

## What it does

Input:
- Plain text claim
- YouTube URL handled through the same input box and transcript extraction in the preprocessor

Pipeline:
- preprocessor
- surgeon
- diver
- skeptic
- scorer

Output:
- Per-claim verdicts
- Aggregate truth score from 0 to 100
- Retrieval method (`rag`, `live_search`, or `hybrid`)

## Canonical architecture

Execution stages:
- preprocessor -> surgeon -> diver -> skeptic -> scorer

Graph orchestration:
- Architect compiles and routes the LangGraph state machine
- error_handler is the terminal failure node

Retrieval model:
- RAG first from the local ChromaDB collection
- Live fallback via DuckDuckGo search
- Extra live enrichment for legal claims through IndianKanoon and government claims through PIB search

## Tech stack

Backend:
- Flask
- Flask-CORS
- LangGraph

LLM:
- Primary: local Ollama when `USE_LOCAL_LLM=true` and Ollama is reachable
- Fallback 1: Cerebras
- Fallback 2: Groq
- Quality mode fallback: GitHub Models when explicitly requested and no other providers are available

Embeddings:
- OllamaEmbeddings with `nomic-embed-text`

Data:
- ChromaDB persistent local vector store
- SQLite local exact-match caching layer (`local_cache.db`) for bypassing LLMs on repeated queries

Frontend:
- HTML, CSS, vanilla JavaScript
- Hub-and-Spoke orchestrator workflow tree, Live Agent Observer console, result panels, and settings drawer

## Quick start

1. Create and activate venv

Windows PowerShell:
- python -m venv .venv
- .\.venv\Scripts\Activate.ps1

2. Install dependencies
- pip install -r requirements.txt

3. Create env file
- copy .env.example .env

4. Ensure local Ollama is running if you want local inference and embeddings:
- LLM model: XianYu_bi/DeepSeek-R1-Distill-Qwen-14B-Q3_K_M:latest
- Embedding model: nomic-embed-text

5. Build or refresh index
- python -m services.indexer

6. Start server
- python app.py

7. Open app
- http://localhost:5000/

## Environment variables

Core:
- FLASK_ENV
- FLASK_PORT
- CHROMA_DB_PATH

Local-first LLM:
- USE_LOCAL_LLM=true
- OLLAMA_BASE_URL=http://localhost:11434
- OLLAMA_MODEL=XianYu_bi/DeepSeek-R1-Distill-Qwen-14B-Q3_K_M:latest

Cloud fallbacks:
- CEREBRAS_API_KEY
- GROQ_API_KEY
- GITHUB_TOKEN
- GITHUB_QUALITY_MODEL

## Project status

Implemented:
- End-to-end streamed pipeline and UI wiring
- Local-first Ollama routing plus cloud fallbacks
- Expanded source catalog with category metadata
- Source skip controls with explicit skip reasons
- Legal and PIB live retrieval enrichments
- SQLite robust exact-match query caching to prevent rate-limiting on dupe queries
- Hub-and-Spoke semantic UI and streaming Observer console (replacing bloated D3 graph)
- Scorer hardening for DeepSeek think-block stripping and zero-score fallback
- Settings and Ollama model endpoints in the Flask app

Partially complete:
- Source coverage for dynamic or blocked websites remains intentionally limited for static indexing
- Retrieval quality still depends on the strength of local index coverage and live snippets

Open issues:
- Empty-input SSE runs still finish with a terminal `complete` event carrying `state.error` instead of a dedicated terminal `error` event
- Integration and regression coverage is still limited
- Documentation and release notes need to stay in sync with implementation changes

## Repository map

Core backend:
- app.py
- config.py
- services/architect.py
- services/runner.py
- services/agents.py
- services/preprocessor.py
- services/retriever.py
- services/indexer.py
- services/state.py
- services/llm.py
- services/cache.py

Frontend:
- static/index.html
- static/css/style.css
- static/js/main.js

Docs:
- docs/architecture.md
- docs/api.md
- docs/agent_orchestration_clarification.md
- implementation_checklist.md
- implementation_plan.md
- phase_wise_implementation_plan.md
- NEXT_SESSION.md

## License

MIT License. Built for educational and research use.
