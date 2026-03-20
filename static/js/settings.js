(() => {
  // ── Element refs ──────────────────────────────────────────
  const overlay     = document.getElementById('settings-overlay');
  const openBtn     = document.getElementById('settings-btn');
  const closeBtn    = document.getElementById('settings-close');
  const saveBtn     = document.getElementById('settings-save');
  const saveLabel   = document.getElementById('settings-save-label');
  const saveIcon    = document.getElementById('settings-save-icon');
  const hint        = document.getElementById('settings-hint');
  const dirtyDot    = document.getElementById('settings-dirty-dot');
  const portEl      = document.getElementById('flask-port');

  const themeLight  = document.getElementById('theme-light');
  const themeDark   = document.getElementById('theme-dark');

  const providerRadios   = document.querySelectorAll('input[name="llm-provider"]');
  const providerFields   = document.querySelectorAll('.provider-fields');

  const ollamaModelSelect = document.getElementById('ollama-model');
  const ollamaRefreshBtn  = document.getElementById('ollama-refresh');

  if (!overlay || !openBtn) return;

  // ── Theme ─────────────────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('eo-theme', theme);
    if (themeLight) themeLight.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    if (themeDark)  themeDark.setAttribute('aria-pressed',  theme === 'dark'  ? 'true' : 'false');
  }

  applyTheme(document.documentElement.dataset.theme || 'light');

  themeLight?.addEventListener('click', () => { applyTheme('light'); markDirty(); });
  themeDark?.addEventListener('click',  () => { applyTheme('dark');  markDirty(); });

  // ── Provider field visibility ─────────────────────────────
  function showProviderFields(provider) {
    providerFields.forEach(el => {
      if (el.dataset.for === provider) {
        el.classList.add('visible');
      } else {
        el.classList.remove('visible');
      }
    });
  }

  providerRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      showProviderFields(radio.value);
      clearAllValidation();
      markDirty();
      if (radio.value === 'ollama') fetchOllamaModels();
    });
  });

  // ── Ollama model fetching ─────────────────────────────────
  async function fetchOllamaModels(currentModel) {
    if (!ollamaModelSelect || !ollamaRefreshBtn) return;

    ollamaRefreshBtn.classList.add('spinning');
    ollamaRefreshBtn.disabled = true;

    try {
      const res = await fetch('/api/ollama-models');
      const data = await res.json();

      ollamaModelSelect.innerHTML = '';

      if (!res.ok || data.status === 'error') {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = `⚠ ${data.error || 'Failed to load models'}`;
        ollamaModelSelect.appendChild(opt);
        return;
      }

      const models = data.models || [];
      if (models.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No models found — pull one with ollama pull';
        ollamaModelSelect.appendChild(opt);
        return;
      }

      models.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        ollamaModelSelect.appendChild(opt);
      });

      if (currentModel && models.includes(currentModel)) {
        ollamaModelSelect.value = currentModel;
      } else if (currentModel) {
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.textContent = `${currentModel} (configured)`;
        ollamaModelSelect.insertBefore(opt, ollamaModelSelect.firstChild);
        ollamaModelSelect.value = currentModel;
      }
    } catch (err) {
      ollamaModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = `⚠ Connection error: ${err.message}`;
      ollamaModelSelect.appendChild(opt);
    } finally {
      ollamaRefreshBtn.classList.remove('spinning');
      ollamaRefreshBtn.disabled = false;
    }
  }

  ollamaRefreshBtn?.addEventListener('click', () => {
    fetchOllamaModels(ollamaModelSelect?.value);
  });

  // ── Detect active provider from loaded settings ───────────
  function detectProvider(settings) {
    if (settings.USE_LOCAL_LLM === true || settings.USE_LOCAL_LLM === 'true') return 'ollama';
    if (settings.CEREBRAS_API_KEY) return 'cerebras';
    if (settings.GROQ_API_KEY)     return 'groq';
    if (settings.GITHUB_TOKEN)     return 'github';
    return 'ollama';
  }

  // ── Load settings from API ────────────────────────────────
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data.settings || {};

      setValue('ollama-url',      s.OLLAMA_BASE_URL);
      setValue('cerebras-key',    s.CEREBRAS_API_KEY);
      setValue('cerebras-model',  s.CEREBRAS_MODEL);
      setValue('groq-key',        s.GROQ_API_KEY);
      setValue('groq-model',      s.GROQ_MODEL);
      setValue('github-token',    s.GITHUB_TOKEN);
      setValue('github-model',    s.GITHUB_QUALITY_MODEL);
      if (portEl) portEl.textContent = s.FLASK_PORT || '5000';

      const provider = detectProvider(s);
      providerRadios.forEach(r => { r.checked = r.value === provider; });
      showProviderFields(provider);

      if (provider === 'ollama') {
        fetchOllamaModels(s.OLLAMA_MODEL);
      } else if (ollamaModelSelect && s.OLLAMA_MODEL) {
        ollamaModelSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = s.OLLAMA_MODEL;
        opt.textContent = s.OLLAMA_MODEL;
        ollamaModelSelect.appendChild(opt);
        ollamaModelSelect.value = s.OLLAMA_MODEL;
      }

      // After load, capture baseline and mark clean
      markClean();
    } catch (err) {
      setHint(`Could not load settings: ${err.message}`, 'error');
    }
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
      el.value = String(value);
    }
  }

  // ── Dirty-state tracking ──────────────────────────────────
  let isDirty = false;
  let successTimer = null;

  function markDirty() {
    if (isDirty) return;
    isDirty = true;
    if (dirtyDot) dirtyDot.hidden = false;
    if (saveLabel) saveLabel.textContent = 'Save Changes';
    setSaveState('idle');
  }

  function markClean() {
    isDirty = false;
    if (dirtyDot) dirtyDot.hidden = true;
  }

  // Watch all text/password inputs in settings for changes
  document.querySelectorAll('.settings-body input[type="text"], .settings-body input[type="password"], .settings-body input[type="url"], .settings-body select').forEach(el => {
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);
    // Clear invalid on input
    el.addEventListener('input', () => clearFieldError(el));
  });

  // ── Save state machine ────────────────────────────────────
  // States: 'idle' | 'saving' | 'success' | 'error'
  function setSaveState(state) {
    if (!saveBtn || !saveLabel) return;
    clearTimeout(successTimer);
    saveBtn.classList.remove('is-saving', 'is-success', 'is-error');
    saveBtn.disabled = false;

    switch (state) {
      case 'saving':
        saveBtn.classList.add('is-saving');
        saveBtn.disabled = true;
        if (saveIcon) saveIcon.textContent = '';
        if (saveLabel) saveLabel.textContent = 'Saving…';
        break;
      case 'success':
        saveBtn.classList.add('is-success');
        if (saveIcon) saveIcon.textContent = '✓';
        if (saveLabel) saveLabel.textContent = 'Saved';
        successTimer = setTimeout(() => setSaveState('idle'), 2500);
        break;
      case 'error':
        saveBtn.classList.add('is-error');
        if (saveIcon) saveIcon.textContent = '✗';
        if (saveLabel) saveLabel.textContent = 'Failed';
        break;
      default: // idle
        if (saveIcon) saveIcon.textContent = '';
        if (saveLabel) saveLabel.textContent = isDirty ? 'Save Changes' : 'Save Settings';
        break;
    }
  }

  // ── Inline validation ─────────────────────────────────────
  const REQUIRED_FIELDS = {
    cerebras: ['cerebras-key'],
    groq:     ['groq-key'],
    github:   ['github-token'],
    ollama:   [], // no required API key for local
  };

  function validateForProvider(provider) {
    const required = REQUIRED_FIELDS[provider] || [];
    let valid = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value.trim() === '') {
        setFieldError(el, 'This field is required to use this provider.');
        valid = false;
      }
    });
    return valid;
  }

  function setFieldError(el, message) {
    el.classList.add('invalid');
    // Remove existing error
    const existing = el.parentElement.querySelector('.field-error');
    if (existing) existing.remove();
    const err = document.createElement('span');
    err.className = 'field-error';
    err.textContent = message;
    el.parentElement.appendChild(err);
  }

  function clearFieldError(el) {
    el.classList.remove('invalid');
    const err = el.parentElement?.querySelector('.field-error');
    if (err) err.remove();
  }

  function clearAllValidation() {
    document.querySelectorAll('.settings-body input.invalid').forEach(el => clearFieldError(el));
  }

  // ── Open / Close ──────────────────────────────────────────
  function openSettings() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    clearHint();
    clearAllValidation();
    setSaveState('idle');
    loadSettings();
    setTimeout(() => closeBtn?.focus(), 350);
  }

  function closeSettings() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus();
  }

  openBtn.addEventListener('click', openSettings);
  closeBtn?.addEventListener('click', closeSettings);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSettings();
  });

  // ── Hint helpers ──────────────────────────────────────────
  function setHint(msg, type = '') {
    if (!hint) return;
    hint.textContent = msg;
    hint.className = `settings-hint ${type}`;
  }

  function clearHint() {
    if (!hint) return;
    hint.textContent = '';
    hint.className = 'settings-hint';
  }

  // ── Save settings via POST ────────────────────────────────
  saveBtn?.addEventListener('click', async () => {
    clearHint();
    clearAllValidation();

    const selectedProvider = [...providerRadios].find(r => r.checked)?.value || 'ollama';

    // Inline validation
    if (!validateForProvider(selectedProvider)) {
      setHint('Please fill in the required fields.', 'error');
      setSaveState('error');
      return;
    }

    setSaveState('saving');

    const useLocalLLM = selectedProvider === 'ollama' ? 'true' : 'false';
    const ollamaModel = ollamaModelSelect?.value?.trim() || '';

    const payload = {
      USE_LOCAL_LLM:        useLocalLLM,
      OLLAMA_BASE_URL:      getVal('ollama-url'),
      OLLAMA_MODEL:         ollamaModel,
      CEREBRAS_API_KEY:     getVal('cerebras-key'),
      CEREBRAS_MODEL:       getVal('cerebras-model'),
      GROQ_API_KEY:         getVal('groq-key'),
      GROQ_MODEL:           getVal('groq-model'),
      GITHUB_TOKEN:         getVal('github-token'),
      GITHUB_QUALITY_MODEL: getVal('github-model'),
    };

    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v.trim() !== '')
    );
    filtered.USE_LOCAL_LLM = useLocalLLM;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtered),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setHint('Settings saved. LLM changes take effect on the next request.', 'success');
      setSaveState('success');
      markClean();
    } catch (err) {
      setHint(`Failed to save: ${err.message}`, 'error');
      setSaveState('error');
    }
  });

  function getVal(id) {
    return document.getElementById(id)?.value?.trim() ?? '';
  }
})();
