# The Eye Opener - Phase-Wise Implementation Plan

Date: March 18, 2026

## Objective
Build The Eye Opener as an AI-powered fact-checking platform for Indian political discourse using Flask, LangGraph, hybrid retrieval, and a live D3.js visualization frontend.

## Phase 0 - Project Bootstrap and Guardrails

### Scope
- Initialize repository structure.
- Add core config and dependency files.
- Set up minimal Flask server and health route.

### Deliverables
- `.gitignore`
- `.env.example`
- `requirements.txt`
- `config.py`
- `app.py` with `/api/health`
- Directories: `services/`, `static/css/`, `static/js/`

### Exit Criteria
- App boots successfully.
- Health endpoint returns success JSON.
- Missing critical env vars surface warnings without crashing import.

## Phase 1 - State Contract and Input Preprocessing

### Scope
- Define canonical `AgentState` used across all agents.
- Build preprocessing for plain text and YouTube URLs.

### Deliverables
- `services/state.py`
- `services/preprocessor.py`

### Implementation Notes
- Preserve `raw_input` for traceability.
- Populate `cleaned_text` after normalization/transcript extraction.
- On transcript/input failure, set `error` in state instead of crashing.

### Exit Criteria
- Deterministic preprocessing output for valid text input.
- Graceful failure path for invalid/unavailable YouTube transcripts.

## Phase 2 - LangGraph Core Pipeline and SSE Bridge

### Scope
- Implement the 4 worker agents plus preprocessing stage in an Architect-orchestrated graph.
- Add execution runner that streams transitions to frontend.

### Deliverables
- `services/agents.py`
- `services/architect.py`
- `services/runner.py`
- `app.py` SSE endpoint integration

### Implementation Notes
- Ensure each node updates `active_agent`.
- SSE event payload must include `event_type` and `active_agent`.
- Error state should route to dedicated terminal node.

### Exit Criteria
- End-to-end text claim run succeeds.
- SSE emits ordered progression events through pipeline.
- Final payload includes verdicts and `truth_score`.

## Phase 3 - RAG Indexing and Hybrid Retrieval

### Scope
- Build offline indexer for trusted Indian sources.
- Implement hybrid search policy: RAG-first, live fallback.

### Deliverables
- `services/indexer.py`
- `services/retriever.py`
- `services/agents.py` update: Diver uses hybrid retrieval

### Implementation Notes
- Trusted sources include fact-checking, journalism, legal, economic, and government domains.
- If RAG confidence is below threshold, fallback to live search.
- Persist retrieval path to `retrieval_method` (`rag`, `live_search`, `hybrid`).

### Exit Criteria
- Indexed claims resolve through RAG path.
- Novel claims trigger fallback successfully.
- Dual-channel failure sets clear `error` and exits safely.

## Phase 4 - Frontend Dashboard and Observer UI

### Scope
- Implement user input UI, SSE client, results rendering, and Hub-and-Spoke diagram.

### Deliverables
- `static/index.html`
- `static/css/style.css`
- `static/js/main.js`

### Implementation Notes
- Include a single input area that accepts text claims or YouTube URLs.
- Render active node glow based on streamed `active_agent`.
- Display truth score, verdict cards, evidence summary, retrieval badges, and source references.
- Show inline error state when backend pipeline fails.

### Exit Criteria
- User can submit claim and see real-time graph progression.
- Results panel correctly renders final output.
- UI works on desktop and mobile breakpoints.

## Phase 5 - Integration Testing and Hardening

### Scope
- Validate all critical user flows and failure scenarios.
- Improve logging, resilience, and release readiness.

### Verification Matrix
- Env loading and secret handling
- Flask health route and API stability
- Plain text claim pipeline
- YouTube transcript pipeline
- RAG-first retrieval behavior
- Live fallback behavior
- Error-route behavior
- SSE/CORS behavior from separate origin
- Frontend render consistency

### Exit Criteria
- All critical tests pass.
- Failure modes are visible and actionable.
- Repository is clean and ready for team development/release.

## Phase 6 - Post-MVP Optimization (Optional)

### Scope
- Quality and performance improvements after baseline MVP is stable.

### Candidate Tasks
- Tune RAG confidence threshold.
- Improve prompt quality for claim extraction/scoring.
- Add regression tests for state schema and retrieval decisions.
- Optimize frontend rendering for large claim sets.

## Dependency Order and Parallel Work

1. Phase 1 depends on Phase 0.
2. Phase 2 depends on Phase 1.
3. Phase 3 depends on Phase 2.
4. Phase 4 can begin after Phase 2 contracts are stable; full verification needs Phase 3.
5. Phase 5 depends on Phases 2, 3, and 4.
6. Phase 6 starts after Phase 5 baseline sign-off.

## Suggested Milestone Sequence

1. Bootstrap repo and run health check.
2. Lock `AgentState` and preprocessing behavior.
3. Run first end-to-end pipeline without hybrid retrieval.
4. Add RAG index + hybrid fallback and re-test pipeline.
5. Connect frontend to live SSE updates.
6. Execute integration test matrix and fix defects.
7. Start optimization cycle based on observed bottlenecks.
