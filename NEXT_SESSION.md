# NEXT_SESSION

## Section 1 — Current project status

### Fully working
- Backend app boots and `/api/health` returns OK.
- SSE pipeline runs end-to-end for non-empty claims through: `preprocessor -> surgeon -> diver -> skeptic -> scorer`.
- `retrieval_method` is populated in final output.
- Frontend wiring is in place:
  - `static/index.html` loads the main UI script.
  - Claim submit triggers SSE stream and populates the Live Agent Observer console progressively.
  - Results panel populates on completion.
- The workflow graph renders as a Hub-and-Spoke orchestrator layout, replacing the old D3 graph.
- Local SQLite query caching ensures identical queries execute instantly and bypass all cloud LLMs.

### Partially working
- Full visual sequence from graph node classes is mostly confirmed, but `preprocessor` highlight is fast and not always captured in screenshots.
- Verdict quality is still inconsistent across runs for complex factual claims.
- Source retrieval works, but evidence relevance and coverage are still uneven on claims requiring authoritative government context.

### Broken or incomplete
- Some runs collapse to low-quality final scoring even when the claim is likely verifiable.
- Rate-limit behavior is not fully hardened.
- Some source adapters/selectors are intentionally skipped because they are blocked or JS-heavy.
- Empty-input validation at runner level still emits a terminal `complete` event with `state.error` rather than a dedicated terminal `error` event.

## Section 2 — Known bugs to fix

### Bug 1: LLM rate limits still degrade output quality
- Symptom:
  - Final score drops or runs degrade after upstream 429s.
  - Pipeline can route to `error_handler` instead of recovering.
- Root cause (known/likely):
  - Retry/backoff is present, but the broader pipeline still needs more resilient handling around late-stage failures.
- Files to inspect:
  - `services/llm.py`
  - `services/agents.py`
  - `services/architect.py`
- Current direction:
  1. Preserve retry behavior for 429-like errors.
  2. Keep Cerebras before Groq as the cloud fallback order.
  3. Only route to `error_handler` after retry exhaustion.

### Bug 2: Scorer quality still varies across runs
- Symptom:
  - Final verdict list can still contain weak or ambiguous outputs for hard claims.
- Root cause (known/likely):
  - Evidence quality threshold and prompt robustness still need tuning for sparse evidence cases.
- Files to inspect:
  - `services/agents.py`
  - `services/retriever.py`
- Current direction:
  1. Keep the JSON-based scorer output.
  2. Ensure evidence packaging includes the strongest available snippets and source metadata.
  3. Surface retrieval-quality issues explicitly instead of silently collapsing to poor verdicts.

### Bug 3: PIB source remains skip-only in indexing
- Symptom:
  - PIB pages are not part of static indexing.
- Root cause:
  - The source is intentionally skipped because the static fetch path is unreliable for that site.
- File to inspect:
  - `services/indexer.py`

### Bug 4: Empty input still uses a terminal `complete` event
- Symptom:
  - Empty claim can terminate as `complete` rather than an explicit validation error.
- File to inspect:
  - `services/runner.py`
  - `services/preprocessor.py`
- Current direction:
  1. Keep `state.error` as the current signal.
  2. If contract normalization is desired, add a dedicated terminal error event later.

## Section 3 — Quality improvements to implement

1. Tighten SSE terminal semantics for empty input.
2. Improve scorer prompt stability for sparse evidence.
3. Add more integration coverage for verify/stream and settings flows.
4. Continue to validate source selector coverage for high-value domains.

## Section 4 — Git tasks remaining

1. Create GitHub repository and push current code.
2. Set branch protection rules on `main` and `develop`.
3. Invite teammates Dev B and Dev C.
4. Teammate onboarding steps (each teammate):
   - Clone repository.
   - Create `.env` from `.env.example` with their own keys.
   - Run `python -m services.indexer` to build local vector data.

## Section 5 — How to resume next session

Paste this exact prompt into Copilot Chat at session start:

```text
Read and follow project context from these files first:
1) copilot-instructions.md
2) NEXT_SESSION.md
3) implementation_checklist.md

Then continue from Phase 5 hardening and bug-fix work only.
Priority order:
- Tighten SSE terminal semantics for empty input.
- Improve scorer robustness for sparse evidence.
- Expand integration coverage for verify, stream, and settings.
- Continue to validate source selector coverage for high-value domains.

Constraints:
- Make minimal, targeted edits.
- After each fix, run a quick validation and report exact observed output.
- Do not start new features outside Phase 5 until these are stable.
```
