(() => {
  const inputEl = document.querySelector("#claim-input");
  const analyzeBtn = document.querySelector(".action-row button");
  const inputPanel = document.querySelector(".input-panel");
  const streamPanel = document.querySelector(".stream-panel");
  const statusPill = document.querySelector(".status-pill");
  const resultPanel = document.querySelector(".result-panel");

  const retrievalValueEl = document.querySelector(".result-grid article:nth-child(1) p");
  const truthScoreValueEl = document.querySelector(".result-grid article:nth-child(2) p");
  const verdictValueEl = document.querySelector(".result-grid article:nth-child(3) p");
  const sourcesPanel = document.getElementById("sources-panel");
  const sourcesList = document.getElementById("sources-list");
  const explanationPanel = document.getElementById("explanation-panel");
  const explanationList = document.getElementById("explanation-list");

  if (!inputEl || !analyzeBtn || !streamPanel) {
    return;
  }

  let eventSource = null;

  const activeAgentEl = document.createElement("p");
  activeAgentEl.className = "hint";
  activeAgentEl.id = "active-agent-display";
  activeAgentEl.textContent = "Active agent: idle";
  streamPanel.appendChild(activeAgentEl);

  const errorEl = document.createElement("p");
  errorEl.id = "inline-error";
  errorEl.style.color = "#aa2e2e";
  errorEl.style.margin = "10px 0 0";
  errorEl.hidden = true;
  inputPanel.appendChild(errorEl);

  if (resultPanel) {
    resultPanel.hidden = true;
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analyze";

  function setLoadingState(isLoading) {
    analyzeBtn.disabled = isLoading;
    analyzeBtn.textContent = isLoading ? "Analyzing..." : "Analyze";
  }

  function setStatus(text) {
    if (statusPill) {
      statusPill.textContent = text;
    }
  }

  function showInlineError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearInlineError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function closeStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function updateActiveAgent(activeAgent) {
    if (!activeAgent) {
      return;
    }

    activeAgentEl.textContent = `Active agent: ${activeAgent}`;
    setStatus(`Running: ${activeAgent}`);
    // Remove active class from all nodes and paths
    document.querySelectorAll(".flow-node, .flow-path").forEach((el) => {
      el.classList.remove("active");
    });

    const activeEl = document.getElementById(`node-${activeAgent}`);
    if (activeEl) {
      if (activeAgent === "error") {
        activeEl.hidden = false;
      }
      
      activeEl.classList.add("active");

      // Activate the path immediately preceding this node
      const pathEl = activeEl.previousElementSibling;
      if (pathEl && pathEl.classList.contains("flow-path")) {
        pathEl.classList.add("active");
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
    if (truthScoreValueEl) {
      truthScoreValueEl.textContent =
        typeof state?.truth_score === "number" ? String(state.truth_score) : "--";
    }

    if (retrievalValueEl) {
      retrievalValueEl.textContent = state?.retrieval_method || "unknown";
    }

    if (verdictValueEl) {
      verdictValueEl.textContent = formatVerdicts(state?.verdicts);
    }

    if (resultPanel) {
      resultPanel.hidden = false;
    }

    renderSources(state?.research_logs || []);
    renderExplanation(state?.verdicts || [], state?.truth_score);
  }

  function renderSources(researchLogs) {
    if (!sourcesPanel || !sourcesList) return;
    sourcesList.innerHTML = "";

    const seen = new Set();
    researchLogs.forEach((log) => {
      (log.sources || []).forEach((src) => {
        const url = src.url || "";
        const label = src.title || src.source || url || "Unknown source";
        if (!url || seen.has(url)) return;
        seen.add(url);
        const li = document.createElement("li");
        li.className = "source-item";
        li.innerHTML = url
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>
             <span class="source-badge">${src.source || "web"}</span>`
          : `<span>${label}</span>`;
        sourcesList.appendChild(li);
      });
    });

    if (sourcesList.children.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No external sources were retrieved for this claim.";
      li.className = "hint";
      sourcesList.appendChild(li);
    }

    sourcesPanel.hidden = false;
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
      const card = document.createElement("div");
      card.className = "explanation-card";
      const verdictClass = (v.verdict || "").toLowerCase().replace(/\s+/g, "-");
      card.innerHTML = `
        <div class="explanation-card-header">
          <span class="claim-index">#${i + 1}</span>
          <span class="verdict-badge verdict-${verdictClass}">${v.verdict || "Unknown"}</span>
          <span class="confidence-tag">${v.confidence ?? "?"}% confidence</span>
        </div>
        <p class="claim-text">${v.claim || ""}</p>
        <p class="reasoning-text">${v.reasoning || "No reasoning provided."}</p>
      `;
      explanationList.appendChild(card);
    });

    if (verdicts.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No claim-level scoring data available.";
      p.className = "hint";
      explanationList.appendChild(p);
    }

    explanationPanel.hidden = false;
  }

  function handleSseMessage(rawData) {
    let payload;

    try {
      payload = JSON.parse(rawData);
    } catch {
      return;
    }

    const eventType = payload?.event_type;
    const state = payload?.state || {};
    const activeAgent = payload?.active_agent || state?.active_agent;

    if (activeAgent) {
      updateActiveAgent(activeAgent);
    }

    if (state?.error) {
      showInlineError(`Pipeline error: ${state.error}`);
      setStatus("Error");
      setLoadingState(false);
      closeStream();
      return;
    }

    if (eventType === "complete") {
      document.querySelectorAll(".flow-node, .flow-path").forEach((el) => {
        el.classList.remove("active");
      });
      activeAgentEl.textContent = "Pipeline complete";
      renderCompleteState(state);
      setStatus("Complete");
      setLoadingState(false);
      closeStream();
    }
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

    const url = `/api/stream?input=${encodeURIComponent(claim)}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (evt) => {
      handleSseMessage(evt.data);
    };

    eventSource.onerror = () => {
      showInlineError("Stream connection failed. Please try again.");
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
