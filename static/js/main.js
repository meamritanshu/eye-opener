(() => {
  const STAGE_LABELS = {
    preprocessor: "Preprocessor",
    surgeon: "Surgeon",
    diver: "Diver",
    skeptic: "Skeptic",
    scorer: "Scorer",
    architect: "Architect (Orchestrator)",
    error_handler: "Error Handler",
    error: "Error",
    claim: "Claim",
  };

  function labelForStage(stageId) {
    return STAGE_LABELS[stageId] || stageId;
  }

  // ── XSS-safe text helper ──────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const inputEl    = document.querySelector("#claim-input");
  const analyzeBtn  = document.getElementById("analyze-btn");
  const clearBtn    = document.getElementById("clear-btn");
  const sampleChip  = document.getElementById("sample-chip");
  const charCounter = document.getElementById("char-counter");
  const stageMeta   = document.getElementById("stage-meta");
  const timelineClearBtn = document.getElementById("timeline-clear");
  const inputPanel  = document.querySelector(".input-panel");
  const streamPanel = document.querySelector(".stream-panel");
  const statusPill  = document.querySelector(".status-pill");
  const resultPanel = document.querySelector(".result-panel");

  const retrievalValueEl = document.querySelector(".result-grid article:nth-child(1) p");
  const truthScoreValueEl = document.querySelector(".result-grid article:nth-child(2) p");
  const verdictValueEl    = document.querySelector(".result-grid article:nth-child(3) p");
  const sourcesPanel      = document.getElementById("sources-panel");
  const sourcesList       = document.getElementById("sources-list");
  const explanationPanel  = document.getElementById("explanation-panel");
  const explanationList   = document.getElementById("explanation-list");

  if (!inputEl || !analyzeBtn || !streamPanel) {
    return;
  }

  let eventSource = null;
  let streamOpened = false;
  const liveOutputContent    = document.getElementById("live-output-content");
  const livePulse            = document.getElementById("live-pulse");
  const liveContainer        = document.getElementById("live-output-container");
  const rawStreamContent     = document.getElementById("raw-stream-content");
  const tabSourcesLabel      = document.getElementById("tab-sources-label");
  const metricVerdictCard    = document.querySelector(".metric-verdict");
  const scoreValueEl         = document.querySelector(".score-value");
  
  let processedItems = {
    claims: 0,
    logs:   0,
    critiques: 0,
    verdicts:  0
  };
  let currentLogAgent = null;

  // ── Tab system ───────────────────────────────────────────────
  const TAB_IDS = ["verdict", "sources", "explanation", "raw"];

  function switchTab(tabId, { moveFocus = false } = {}) {
    TAB_IDS.forEach((id) => {
      const btn   = document.getElementById(`tab-${id}`);
      const panel = document.getElementById(`tabpanel-${id}`);
      const active = id === tabId;
      if (btn) {
        btn.setAttribute("aria-selected", String(active));
        // Roving tabindex: active tab is tabbable, others are not
        btn.tabIndex = active ? 0 : -1;
      }
      if (panel) panel.hidden = !active;
    });
    if (moveFocus) {
      const activeBtn = document.getElementById(`tab-${tabId}`);
      if (activeBtn) activeBtn.focus();
    }
  }

  // Keyboard arrow-key navigation on the tab bar
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("keydown", (e) => {
      const tabs  = [...document.querySelectorAll(".tab-btn")];
      const idx   = tabs.indexOf(e.currentTarget);
      if (e.key === "ArrowRight") {
        const next = tabs[(idx + 1) % tabs.length];
        const id   = next.getAttribute("aria-controls").replace("tabpanel-", "");
        switchTab(id, { moveFocus: true });
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        const id   = prev.getAttribute("aria-controls").replace("tabpanel-", "");
        switchTab(id, { moveFocus: true });
        e.preventDefault();
      }
    });
    // Click
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("aria-controls").replace("tabpanel-", "");
      switchTab(id, { moveFocus: true });
    });
  });

  // Start on Verdict tab
  switchTab("verdict");

  function appendLiveLog(htmlContent) {
    if (!liveOutputContent) return;
    const entry = document.createElement("div");
    entry.className = "live-log-entry";
    entry.innerHTML = htmlContent;
    liveOutputContent.appendChild(entry);
    liveOutputContent.scrollTop = liveOutputContent.scrollHeight;

    // Mirror to raw stream panel
    if (rawStreamContent) {
      const rawEntry = document.createElement("div");
      rawEntry.className = "raw-entry";
      rawEntry.innerHTML = htmlContent;
      rawStreamContent.appendChild(rawEntry);
      rawStreamContent.scrollTop = rawStreamContent.scrollHeight;
    }
  }

  function updateLiveOutput(agent, state) {
    if (!liveOutputContent || !state) return;

    if (agent !== currentLogAgent) {
      const hint = liveOutputContent.querySelector(".hint");
      if (hint) hint.remove();

      currentLogAgent = agent;
      appendLiveLog(`<span class="live-log-strong">[System]</span> Switching to ${labelForStage(agent)} phase...`);
    }

    if (agent === "surgeon" && Array.isArray(state.claims) && state.claims.length > processedItems.claims) {
      const newItems = state.claims.slice(processedItems.claims);
      processedItems.claims = state.claims.length;
      newItems.forEach(c => {
        const text = typeof c === "string" ? c : JSON.stringify(c);
        appendLiveLog(`<span class="live-log-strong">↓ Extracted claim:</span> <div class="live-log-quote">${escapeHtml(text)}</div>`);
      });
    }

    if (agent === "diver" && Array.isArray(state.research_logs) && state.research_logs.length > processedItems.logs) {
      const newItems = state.research_logs.slice(processedItems.logs);
      processedItems.logs = state.research_logs.length;
      newItems.forEach(log => {
        if (!log || typeof log !== "object") return;
        const query   = escapeHtml(log.query || "(no query)");
        const srcCount = Array.isArray(log.sources) ? log.sources.length : 0;
        appendLiveLog(`<span class="live-log-strong">↓ Searched:</span> "${query}" <small>(${srcCount} sources found)</small>`);
      });
    }

    if (agent === "skeptic" && Array.isArray(state.critiques) && state.critiques.length > processedItems.critiques) {
      const newItems = state.critiques.slice(processedItems.critiques);
      processedItems.critiques = state.critiques.length;
      newItems.forEach(crit => {
        const text    = typeof crit === "string" ? crit : escapeHtml(JSON.stringify(crit));
        const preview = text.length > 120 ? text.substring(0, 120) + "…" : text;
        appendLiveLog(`<span class="live-log-strong">↓ Critique insight:</span> <div class="live-log-quote">${escapeHtml(preview)}</div>`);
      });
    }

    if (agent === "scorer" && Array.isArray(state.verdicts) && state.verdicts.length > processedItems.verdicts) {
      const newItems = state.verdicts.slice(processedItems.verdicts);
      processedItems.verdicts = state.verdicts.length;
      newItems.forEach(v => {
        if (!v || typeof v !== "object") return;
        const vText = escapeHtml((v.verdict || "UNKNOWN").toUpperCase());
        const vLower = vText.toLowerCase();
        const badgeColor = vLower.includes("true") ? "#22c55e" :
                           vLower.includes("false") ? "#ef4444" : "#eab308";
        appendLiveLog(`<span class="live-log-strong">↓ Final Verdict:</span> <span style="color: ${badgeColor}; font-weight: 800; letter-spacing: 0.05em;">[${vText}]</span>`);
      });
    }
  }

  const activeAgentEl = document.createElement("p");
  activeAgentEl.className = "hint";
  activeAgentEl.id = "active-agent-display";
  activeAgentEl.textContent = "Active stage: idle";
  activeAgentEl.style.display = "none"; // hidden — stage-meta takes this role now
  streamPanel.appendChild(activeAgentEl);

  const errorEl = document.getElementById("inline-error");

  // ── Char counter ────────────────────────────────────────────
  function updateCharCounter() {
    if (!charCounter || !inputEl) return;
    const len = inputEl.value.length;
    const max = 2000;
    charCounter.textContent = `${len} / ${max}`;
    charCounter.classList.remove("warn", "limit");
    if (len >= max * 0.95) charCounter.classList.add("limit");
    else if (len >= max * 0.80) charCounter.classList.add("warn");
  }
  inputEl.addEventListener("input", updateCharCounter);
  updateCharCounter();

  // ── Quick actions ────────────────────────────────────────────
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      inputEl.value = "";
      clearInlineError();
      updateCharCounter();
      inputEl.focus();
    });
  }

  if (sampleChip) {
    const SAMPLE_CLAIM = "Scientists have discovered that drinking coffee every day reduces the risk of Alzheimer's disease by up to 65%.";
    sampleChip.addEventListener("click", () => {
      inputEl.value = SAMPLE_CLAIM;
      updateCharCounter();
      inputEl.focus();
    });
  }

  if (timelineClearBtn) {
    timelineClearBtn.addEventListener("click", () => {
      if (liveOutputContent) liveOutputContent.innerHTML = "";
    });
  }

  if (resultPanel) {
    resultPanel.hidden = true;
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analyze";

  function setLoadingState(isLoading) {
    analyzeBtn.disabled = isLoading;
    analyzeBtn.textContent = isLoading ? "Analyzing…" : "Analyze";
  }

  function setStatus(text) {
    if (statusPill) {
      statusPill.textContent = text;
    }
  }

  function showInlineError(message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      // Move focus to error for screen readers (role=alert will announce, but
      // programmatic focus ensures keyboard users can see it too)
      errorEl.focus();
    }
    if (stageMeta) {
      stageMeta.textContent = "Pipeline error";
      stageMeta.className = "stage-meta error";
    }
  }

  function clearInlineError() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  function closeStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  // ── resetFlowState ───────────────────────────────────────────
  function resetFlowState() {
    document.querySelectorAll(".flow-node").forEach((el) => {
      el.classList.remove("active");
      el.dataset.state = "idle";
    });
    document.querySelectorAll(".flow-connector").forEach((el) => {
      el.classList.remove("active");
    });
    if (stageMeta) {
      stageMeta.textContent = "Initializing pipeline\u2026";
      stageMeta.className = "stage-meta running";
    }
    processedItems = { claims: 0, logs: 0, critiques: 0, verdicts: 0 };
    currentLogAgent = null;
  }

  // ── finalizeFlowState ────────────────────────────────────────
  function finalizeFlowState() {
    document.querySelectorAll(".flow-node").forEach((el) => {
      el.classList.remove("active");
      if (el.dataset.state !== "error") el.dataset.state = "complete";
    });
    document.querySelectorAll(".flow-connector").forEach((el) => {
      el.classList.remove("active");
    });
    if (stageMeta) {
      stageMeta.textContent = "Pipeline complete \u2713";
      stageMeta.className = "stage-meta done";
    }
    // Focus management: move to Verdict tab so screen readers announce completion
    const verdictTab = document.getElementById("tab-verdict");
    if (verdictTab) verdictTab.focus();
  }

  function updateActiveAgent(activeAgent) {
    if (!activeAgent) return;

    const stageLabel = labelForStage(activeAgent);
    activeAgentEl.textContent = `Active stage: ${stageLabel}`;
    setStatus(`Running: ${stageLabel}`);

    // Update stage-meta strip
    if (stageMeta) {
      stageMeta.textContent = `Running: ${stageLabel}\u2026`;
      stageMeta.className = "stage-meta running";
    }

    // Activate flow-node UI
    document.querySelectorAll(".flow-node, .flow-path").forEach((el) => {
      el.classList.remove("active");
      if (el.dataset.state !== "complete") {
        el.dataset.state = "idle";
      }
    });

    const activeEl = document.getElementById(`node-${activeAgent}`);
    if (activeEl) {
      if (activeAgent === "error") {
        activeEl.hidden = false;
        activeEl.dataset.state = "error";
      } else {
        activeEl.dataset.state = "active";
      }
      activeEl.classList.add("active");

      // Activate the nearest flow-connector preceding this node
      const parentWrapper = activeEl.closest(".worker-wrapper");
      if (parentWrapper) {
        const conn = parentWrapper.querySelector(".flow-connector");
        if (conn) conn.classList.add("active");
      } else {
        // Top-level connectors: activate by agent
        const connMap = {
          architect:    "conn-to-architect",
          preprocessor: "conn-to-workers",
          surgeon:      "conn-to-workers",
          diver:        "conn-to-workers",
          skeptic:      "conn-to-workers",
          scorer:       "conn-to-workers",
        };
        const connId = connMap[activeAgent];
        if (connId) {
          const conn = document.getElementById(connId);
          if (conn) conn.classList.add("active");
        }
      }
    }
  }

  function formatVerdicts(verdicts) {
    if (!Array.isArray(verdicts) || verdicts.length === 0) {
      return "No verdicts returned";
    }

    return verdicts
      .map((v) => {
        const claim = v?.claim || "Unknown claim";
        const verdict = v?.verdict || "Unknown";
        const confidence = typeof v?.confidence === "number" ? ` (${v.confidence}%)` : "";
        return `${claim}: ${verdict}${confidence}`;
      })
      .join(" | ");
  }

  function renderCompleteState(state) {
    // Score value
    const score = typeof state?.truth_score === "number" ? state.truth_score : null;
    if (truthScoreValueEl) {
      truthScoreValueEl.textContent = score !== null ? String(score) : "--";
    }
    // Use the new score-value element if present
    if (scoreValueEl) {
      scoreValueEl.textContent = score !== null ? score + " / 100" : "--";
    }

    if (retrievalValueEl) {
      retrievalValueEl.textContent = state?.retrieval_method || "unknown";
    }

    if (verdictValueEl) {
      verdictValueEl.textContent = formatVerdicts(state?.verdicts);
    }

    // Set semantic verdict color on metric-verdict card
    if (metricVerdictCard && state?.verdicts?.length) {
      const topVerdict = (state.verdicts[0]?.verdict || "").toLowerCase().replace(/\s+/g, "-");
      metricVerdictCard.dataset.verdict = topVerdict;
    }

    if (resultPanel) {
      resultPanel.hidden = false;
    }

    renderSources(state?.research_logs || []);
    renderExplanation(state?.verdicts || [], state?.truth_score);

    // Auto-focus Verdict tab on completion
    switchTab("verdict");
  }

  function renderSources(researchLogs) {
    if (!sourcesPanel || !sourcesList) return;
    if (!Array.isArray(researchLogs)) researchLogs = [];
    sourcesList.innerHTML = "";

    const seen = new Set();
    researchLogs.forEach((log) => {
      if (!log || typeof log !== "object") return;
      const sources = Array.isArray(log.sources) ? log.sources : [];
      sources.forEach((src) => {
        if (!src || typeof src !== "object") return;
        const url   = typeof src.url   === "string" ? src.url.trim()   : "";
        const label = typeof src.title === "string" ? src.title.trim()
                    : typeof src.source === "string" ? src.source.trim()
                    : url || "Unknown source";
        if (!url || seen.has(url)) return;
        seen.add(url);
        const li = document.createElement("li");
        li.className = "source-item";
        const safeLabel  = escapeHtml(label);
        const safeBadge  = escapeHtml(src.source || "web");
        li.innerHTML = url
          ? `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>
             <span class="source-badge">${safeBadge}</span>`
          : `<span>${safeLabel}</span>`;
        sourcesList.appendChild(li);
      });
    });

    if (sourcesList.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No external sources were retrieved for this claim.";
      li.className = "hint";
      sourcesList.appendChild(li);
    }

    // Update Sources tab badge with count
    if (tabSourcesLabel) {
      const count = sourcesList.querySelectorAll("li:not(.hint)").length;
      tabSourcesLabel.innerHTML = count > 0
        ? `Sources <span class="tab-badge">${count}</span>`
        : "Sources";
    }

    // Show sources tab panel (don't auto-switch; user can click)
    const sourcesTabPanel = document.getElementById("tabpanel-sources");
    if (sourcesTabPanel) sourcesTabPanel.hidden = false;
    if (sourcesPanel) sourcesPanel.hidden = false;
  }

  function renderExplanation(verdicts, overallScore) {
    if (!explanationPanel || !explanationList) return;
    explanationList.innerHTML = "";

    // Overall score summary
    const summary = document.createElement("div");
    summary.className = "score-summary";
    summary.innerHTML = `
      <p>The <strong>Truth Score</strong> is the average of individual claim scores, each rated 0–100 by the AI scorer.</p>
      <p>A score of <strong>0</strong> means the claim is clearly false, <strong>100</strong> means it is clearly true.
         Scores around <strong>50</strong> indicate an unverifiable or mixed claim.</p>
      <p>Overall Score: <strong>${typeof overallScore === "number" ? overallScore + " / 100" : "N/A"}</strong></p>
    `;
    explanationList.appendChild(summary);

    // Per-claim breakdown
    verdicts.forEach((v, i) => {
      if (!v || typeof v !== "object") return;
      const card = document.createElement("div");
      card.className = "explanation-card";
      const verdictClass  = escapeHtml((v.verdict || "").toLowerCase().replace(/\s+/g, "-"));
      const verdictText   = escapeHtml(v.verdict || "Unknown");
      const confidenceVal = typeof v.confidence === "number" ? v.confidence : "?";
      const claimText     = escapeHtml(v.claim     || "");
      const reasoningText = escapeHtml(v.reasoning || "No reasoning provided.");
      card.innerHTML = `
        <div class="explanation-card-header">
          <span class="claim-index">#${i + 1}</span>
          <span class="verdict-badge verdict-${verdictClass}">${verdictText}</span>
          <span class="confidence-tag">${confidenceVal}% confidence</span>
        </div>
        <p class="claim-text">${claimText}</p>
        <p class="reasoning-text">${reasoningText}</p>
      `;
      explanationList.appendChild(card);
    });

    if (verdicts.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No claim-level scoring data available.";
      p.className = "hint";
      explanationList.appendChild(p);
    }

    // Show explanation tab panel (don't auto-switch; Verdict is auto-focused)
    const explanationTabPanel = document.getElementById("tabpanel-explanation");
    if (explanationTabPanel) explanationTabPanel.hidden = false;
    if (explanationPanel) explanationPanel.hidden = false;
  }

  function handleSseMessage(rawData) {
    let payload;

    try {
      payload = JSON.parse(rawData);
    } catch {
      // Silently ignore unparseable SSE frames
      return;
    }

    if (!payload || typeof payload !== "object") return;

    const eventType   = payload.event_type  ?? null;
    const state       = (payload.state && typeof payload.state === "object") ? payload.state : {};
    const activeAgent = payload.active_agent ?? state.active_agent ?? null;

    if (activeAgent) {
      updateActiveAgent(activeAgent);
      updateLiveOutput(activeAgent, state);
    }

    // Error embedded in state
    const stateError = state.error ?? null;
    if (stateError) {
      showInlineError(`Pipeline error: ${escapeHtml(String(stateError))}`);
      setStatus("Error");
      if (livePulse) livePulse.classList.remove("active");
      appendLiveLog(`<span style="color: #ef4444; font-weight: bold;">[Error]</span> ${escapeHtml(String(stateError))}`);
      setLoadingState(false);
      closeStream();
      return;
    }

    // Explicit error event
    if (eventType === "error") {
      const errMsg = payload.message ?? payload.error ?? "Unknown error";
      showInlineError(`Pipeline error: ${escapeHtml(String(errMsg))}`);
      setStatus("Error");
      if (livePulse) livePulse.classList.remove("active");
      appendLiveLog(`<span style="color: #ef4444; font-weight: bold;">[Error]</span> ${escapeHtml(String(errMsg))}`);
      setLoadingState(false);
      closeStream();
      return;
    }

    if (eventType === "complete") {
      finalizeFlowState();
      if (livePulse) livePulse.classList.remove("active");
      appendLiveLog(`<span style="color: #2dd4a0; font-weight: bold;">[System]</span> Pipeline complete.`);
      renderCompleteState(state);
      setStatus("Complete");
      setLoadingState(false);
      closeStream();
    }
    // Unknown event types are safely ignored
  }

  function startStream() {
    const claim = inputEl.value.trim();

    if (!claim) {
      showInlineError("Please enter a claim before running analysis.");
      return;
    }

    closeStream();
    clearInlineError();
    setLoadingState(true);
    setStatus("Connecting...");

    if (resultPanel) {
      resultPanel.hidden = true;
    }
    if (sourcesPanel) {
      sourcesPanel.hidden = true;
    }
    if (explanationPanel) {
      explanationPanel.hidden = true;
    }

    resetFlowState();

    // Reset raw stream
    if (rawStreamContent) {
      rawStreamContent.innerHTML = '<div class="raw-entry hint">Pipeline starting…</div>';
    }
    // Reset Sources tab badge and hide tab panels
    if (tabSourcesLabel) tabSourcesLabel.textContent = "Sources";
    const sourcesTabPanel     = document.getElementById("tabpanel-sources");
    const explanationTabPanel = document.getElementById("tabpanel-explanation");
    if (sourcesTabPanel)     sourcesTabPanel.hidden = true;
    if (explanationTabPanel) explanationTabPanel.hidden = true;
    // Reset verdict card
    if (metricVerdictCard) delete metricVerdictCard.dataset.verdict;
    if (scoreValueEl)      scoreValueEl.textContent = "--";
    // Switch to verdict tab for the run
    switchTab("verdict");

    if (liveContainer) liveContainer.hidden = false;
    if (livePulse) livePulse.classList.add("active");
    if (liveOutputContent) {
      liveOutputContent.innerHTML = '<div class="live-log-entry hint">Initializing pipeline...</div>';
    }
    streamOpened = false;

    const url = `/api/stream?input=${encodeURIComponent(claim)}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      streamOpened = true;
    };

    eventSource.onmessage = (evt) => {
      handleSseMessage(evt.data);
    };

    eventSource.onerror = () => {
      // EventSource.onerror also fires when the server closes the connection
      // after a complete SSE stream. Guard against false error reporting:
      // if we already received a 'complete' event and closed the stream ourselves,
      // streamOpened will be true but eventSource will be null — so this guard
      // prevents the error state from appearing after a successful run.
      if (!eventSource) return; // already cleaned up by a complete/error handler
      const msg = streamOpened
        ? "Analysis interrupted \u2014 server restarted. Please try again."
        : "Could not connect to analysis server. Is Flask running?";
      showInlineError(msg);
      setStatus("Error");
      setLoadingState(false);
      closeStream();
    };
  }

  analyzeBtn.addEventListener("click", startStream);

  inputEl.addEventListener("keydown", (evt) => {
    if ((evt.ctrlKey || evt.metaKey) && evt.key === "Enter") {
      startStream();
    }
  });
})();
