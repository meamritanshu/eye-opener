# The Eye Opener: Changelog

This document tracks all the modifications made from the original app environment to successfully debug, fix, and enhance the application structure, backend stability, and frontend UI.

## 1. Environment & Setup Fixes
* **Dependencies:** Added missing `sentence-transformers` and `langchain-huggingface` to `requirements.txt` to fix initial `ModuleNotFoundError` crashes.
* **Port Configuration:** Altered `.env`/`config.py` to launch on port `5001` to bypass macOS's default AirPlay receiver binding on port `5000`.
* **API Keys:** Corrected duplicated and uninitialized entries for `CEREBRAS_API_KEY` and `GROQ_API_KEY` in `.env`.

## 2. Server & Backend Bug Fixes
* **SSE Formatting (`services/runner.py`):** Fixed the `_to_sse` helper function which was incorrectly sending double-escaped newlines (`\\n\\n`), breaking the Server-Sent Events protocol in the browser. Changed this to standard actual `\n\n`.
* **Graceful Exception Handling (`services/runner.py` & `app.py`):** Wrapped both `stream_pipeline` and the `event_stream` Flask generator in `try/except` blocks to ensure exceptions (like missing API keys or API rate limits) get passed down as styled SSE `error` events rather than resulting in raw HTTP `500 Internal Server Errors`.
* **DuckDuckGo API (`services/retriever.py`):** Fixed the import (`duckduckgo_search` -> `ddgs`) and refactored the `live_search` routine to use the newer native `DDGS().text()` instantiation instead of the deprecated context worker block. Also properly captured the `body` payload into a mapped `text` property downstream.
* **ChromaDB Fallbacks (`services/retriever.py`):** Wrapped `rag_search` inside `hybrid_search` with a `try/except` block. Previously, attempting to query an unindexed (empty) native ChromaDB directory threw a raw exception, crashing the pipeline before the fallback `live_search` trigger. It now safely ignores the error and drops back to live web search natively if needed.

## 3. Frontend Features & Analytics
* **Sources & Explanations (`static/index.html`, `main.js`):** Added two new analytic panels that appear dynamically when an analysis run ends:
  * **📰 Sources Used:** Displays a linked list of all references the Diver crawled during retrieval, complete with source domain badges.
  * **🧮 Score Explanation:** Beautifully diagrams each individual extracted claim, showing the Skeptic/Scorer's reasoning, a calculated confidence percentage, and color-coded verdict badges (True, False, Misleading, Unverifiable).

## 4. Frontend Aesthetics & Flowchart Rewrite
* **D3.js Removal:** Completely deleted `truth-graph.js` and stripped the D3 framework dependency out of the app entirely due to styling complexities.
* **Linear Animated Flowchart:** Built a custom HTML/CSS flowchart representing the canonical 6-step timeline (`Claim` → `Architect` → `Preprocessor` → `Surgeon` → `Diver` → `Skeptic` → `Scorer`). 
* **Design Polish (`style.css`):** 
  * Implemented a modern glassmorphism design approach (`backdrop-filter`) for the node containers.
  * Added animated flowing dashed SVG pipes between the modules representing data transferring.
  * Stripped away the default emojis in favor of sleek, bold numeric topology indicators (`01` -> `07`) for a significantly more professional aesthetic.
  * Added auto-clearing CSS tooltips (`.active-note`) surfacing above each node specifying what the active agent is currently doing behind the scenes (e.g. `Sanitizing input...`, `Cross-referencing...`).
