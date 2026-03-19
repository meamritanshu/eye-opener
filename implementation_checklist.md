# The Eye Opener - Master Implementation Checklist

Date created: March 18, 2026
Last reviewed: March 19, 2026 (deep repo + runtime audit)

Note: status updates below are based on repository code inspection, not full runtime QA.

## Phase 0 - Project Bootstrap and Guardrails

### Scope
- [x] Initialize repository structure.
- [x] Add core config and dependency files.
- [x] Set up minimal Flask server and health route.

### Deliverables
- [x] `.gitignore`
- [x] `.env.example`
- [x] `requirements.txt`
- [x] `config.py`
- [x] `app.py` with `/api/health`
- [x] `services/` directory
- [x] `static/css/` directory
- [x] `static/js/` directory

### Exit criteria
- [x] App boots successfully.
- [x] Health endpoint returns success JSON.
- [x] Missing critical env vars surface warnings without crashing import.

## Phase 1 - State Contract and Input Preprocessing

### Scope
- [x] Define canonical `AgentState` used across all agents.
- [x] Build preprocessing for plain text and YouTube URLs.

### Deliverables
- [x] `services/state.py`
- [x] `services/preprocessor.py`

### Implementation checks
- [x] Preserve `raw_input` for traceability.
- [x] Populate `cleaned_text` after normalization/transcript extraction.
- [x] On transcript/input failure, set `error` in state instead of crashing.

### Exit criteria
- [x] Deterministic preprocessing output for valid text input.
- [x] Graceful failure path for invalid/unavailable YouTube transcripts.

## Phase 2 - LangGraph Core Pipeline and SSE Bridge

### Scope
- [x] Implement the 4 worker agents plus preprocessing stage in an Architect-orchestrated graph.
- [x] Add execution runner that streams transitions to frontend.

### Deliverables
- [x] `services/agents.py`
- [x] `services/architect.py`
- [x] `services/runner.py`
- [x] `app.py` SSE endpoint integration

### Implementation checks
- [x] Each node updates `active_agent`.
- [x] SSE payload includes `event_type` and `active_agent`.
- [x] Error state routes to dedicated terminal node.

### Exit criteria
- [x] End-to-end text claim run succeeds.
- [x] SSE emits ordered progression events through pipeline.
- [x] Final payload includes verdicts and `truth_score`.

## Phase 3 - RAG Indexing and Hybrid Retrieval

### Scope
- [x] Build offline indexer for trusted Indian sources.
- [x] Implement hybrid search policy: RAG-first, live fallback.

### Deliverables
- [x] `services/indexer.py`
- [x] `services/retriever.py`
- [x] `services/agents.py` updated so Diver uses hybrid retrieval

### Implementation checks
- [x] Trusted source catalog expanded with category metadata and selector validation helper.
- [x] Skip controls added for blocked/dynamic sources with explicit `skip_reason`.
- [x] If RAG confidence is below threshold, fallback to live search.
- [x] Persist retrieval path to `retrieval_method` (`rag`, `live_search`, `hybrid`).

### Exit criteria
- [ ] Indexed claims resolve through RAG path.
- [x] Novel claims trigger fallback successfully.
- [x] Dual-channel failure sets clear `error` and exits safely.

## Phase 4 - Frontend Dashboard and Interactive Features

### Scope
- [x] Implement user input UI, SSE client, results rendering, and the Live Agent Observer console.

### Deliverables
- [x] `static/index.html`
- [x] `static/css/style.css`
- [x] `static/js/main.js`
- [x] (Deleted) Legacy `static/js/truth-graph.js`

### Implementation checks
- [x] Accept a single input box for text claims and YouTube URLs.
- [x] Render active node glow based on streamed `active_agent`.
- [x] Display truth score, verdict cards, evidence summary, and retrieval badges.
- [x] Show inline error state when backend pipeline fails.

### Exit criteria
- [x] User can submit claim and see real-time graph progression.
- [x] Results panel correctly renders final output.
- [x] UI is responsive enough for desktop and mobile breakpoints.

## Phase 5 - Integration Testing and Hardening

### Scope
- [ ] Validate all critical user flows and failure scenarios.
- [ ] Improve logging, resilience, and release readiness.

### Verification matrix
- [x] Env loading and secret handling
- [x] Flask health route and API stability
- [x] Plain text claim pipeline
- [x] YouTube transcript pipeline
- [x] RAG-first retrieval behavior
- [x] Live fallback behavior
- [x] Error-route behavior
- [ ] Empty-input SSE terminal event uses `event_type: error` (still emits terminal `complete` with error state)
- [x] SSE/CORS behavior from separate origin
- [x] Frontend render consistency

### Exit criteria
- [ ] All critical tests pass.
- [ ] Failure modes are visible and actionable.
- [ ] Repository is clean and ready for team development/release.

## Phase 6 - Post-MVP Optimization (Optional)

### Scope
- [ ] Apply quality and performance improvements after MVP baseline is stable.

### Candidate tasks
- [ ] Tune RAG confidence threshold.
- [ ] Improve prompt quality for claim extraction/scoring.
- [ ] Add regression tests for state schema and retrieval decisions.
- [ ] Optimize frontend rendering for large claim sets.
- [ ] Normalize SSE terminal contract so empty input ends with `event_type: error`.
- [ ] Add automated integration tests for SSE event semantics and fallback routing.

## Cross-Phase Verification (from implementation plan)

### Backend skeleton
- [x] SSE route streams state transitions.
- [x] CORS allows cross-origin SSE during development.

### LLM routing
- [x] `services/llm.py` used by workers.
- [x] Surgeon/Diver/Skeptic use `get_llm_with_retry()`.
- [x] Scorer uses `get_llm_with_retry(prefer_quality=True)`.
- [x] Local Ollama is primary provider with cloud fallback chain.
- [x] 429 retry/backoff wrapper is implemented.

### Retrieval behavior
- [x] Deep Diver uses RAG first when available.
- [x] Deep Diver falls back to live search for low-confidence/novel claims.
- [x] Live sources split into RAG-backed and live-only domains.
- [x] Legal (IndianKanoon) and PIB dedicated live-search enrichments are implemented.

### Results and UX
- [x] Results panel shows score, verdicts, evidence summary.
- [x] Retrieval method badges are displayed correctly.
- [x] Error state is visible and understandable in UI.

## Recent hardening updates (March 19, 2026)

- [x] Switched to local-first Ollama LLM routing with cloud fallbacks.
- [x] Migrated embeddings to local `OllamaEmbeddings` (`nomic-embed-text`) in indexer and retriever.
- [x] Added scorer parsing safety fallback: if verdicts exist but computed score is 0, derive from average confidence.
- [x] Added `_safe_model_text` stripping of DeepSeek `<think>...</think>` blocks.
- [x] Added explicit SQLite Answer Caching to save tokens and prevent repeat queries (`services/cache.py`).
- [x] Centralized CSS Hub-and-Spoke Orchestrator flow diagram, superseding old D3 graph.
- [x] Built Live Agent Observer terminal to stream active analytical events progressively.

## Milestone sequence tracker
- [x] Milestone 1: Bootstrap repo and run health check.
- [x] Milestone 2: Lock `AgentState` and preprocessing behavior.
- [x] Milestone 3: Run first end-to-end pipeline without hybrid retrieval.
- [x] Milestone 4: Add RAG index + hybrid fallback and re-test pipeline.
- [x] Milestone 5: Connect frontend to live SSE updates.
- [ ] Milestone 6: Execute integration test matrix and fix defects.
- [ ] Milestone 7: Start optimization cycle from observed bottlenecks.
