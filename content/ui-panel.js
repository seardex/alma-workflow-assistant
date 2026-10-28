/**
 * Floating HUD / In-Page Assistant Widget.
 * Gives the user 100% visible control, real-time feedback, and one-click manual triggers.
 */
class AlmaUiPanel {
  constructor(controller) {
    this.controller = controller;
    this.container = null;
    this.logBox = null;
    this.statusBadge = null;
    this.pageText = null;
    this.actionArea = null;
    this.infoBox = null;
    this.isCollapsed = false;
  }

  init() {
    if (document.getElementById('alma-assistant-hud')) {
      return;
    }

    this.createHudElement();
    this.setupDraggable();
    this.setupEventListeners();
    this.updatePageState();

    // Observe Alma SPA navigation changes to update context automatically
    const observer = new MutationObserver(() => {
      this.updatePageStateDebounced();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  createHudElement() {
    this.container = document.createElement('div');
    this.container.id = 'alma-assistant-hud';

    this.container.innerHTML = `
      <div class="alma-hud-container">
        <div class="alma-hud-header" id="alma-hud-header">
          <div class="alma-hud-title">
            <span>Alma Assistant</span>
            <span class="alma-hud-title-badge">v1.0</span>
          </div>
          <div class="alma-hud-header-actions">
            <button class="alma-hud-btn-icon" id="alma-hud-toggle-btn" title="Minimieren / Erweitern">−</button>
          </div>
        </div>
        <div class="alma-hud-body">
          <div class="alma-hud-page-indicator">
            <span id="alma-hud-page-name">Erkenne Seite...</span>
            <span class="alma-hud-status-badge status-idle" id="alma-hud-badge">Bereit</span>
          </div>

          <div id="alma-hud-info-box" class="alma-hud-info-box">
            Drücke <b>Alt+X</b> oder den Button unten, um die Felder automatisch zu prüfen und auszufüllen.
          </div>

          <div id="alma-hud-action-area" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Contextual action buttons injected here -->
          </div>

          <div class="alma-hud-toggle-row">
            <span>Manuelles Speichern (Sicherheitsstopp)</span>
            <label class="alma-switch">
              <input type="checkbox" id="alma-hud-toggle-save" checked>
              <span class="alma-slider"></span>
            </label>
          </div>

          <div class="alma-hud-log-box" id="alma-hud-logs">
            <div class="alma-hud-log-line info">Alma Assistant bereit. Drücke Alt+X.</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.logBox = this.container.querySelector('#alma-hud-logs');
    this.statusBadge = this.container.querySelector('#alma-hud-badge');
    this.pageText = this.container.querySelector('#alma-hud-page-name');
    this.actionArea = this.container.querySelector('#alma-hud-action-area');
    this.infoBox = this.container.querySelector('#alma-hud-info-box');

    // Subscribe to logger
    AlmaLogger.addListener((entry) => this.appendLog(entry));
  }

  appendLog(entry) {
    if (!this.logBox) return;
    const line = document.createElement('div');
    line.className = `alma-hud-log-line ${entry.level}`;
    line.textContent = `[${entry.timestamp}] ${entry.message}`;
    this.logBox.appendChild(line);
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }

  setupEventListeners() {
    const toggleBtn = this.container.querySelector('#alma-hud-toggle-btn');
    const hudContainer = this.container.querySelector('.alma-hud-container');

    toggleBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      hudContainer.classList.toggle('collapsed', this.isCollapsed);
      toggleBtn.textContent = this.isCollapsed ? '+' : '−';
    });

    const manualSaveCheckbox = this.container.querySelector('#alma-hud-toggle-save');
    manualSaveCheckbox.addEventListener('change', (e) => {
      this.controller.config.requireManualSave = e.target.checked;
      AlmaConfigManager.saveConfig({ requireManualSave: e.target.checked });
      AlmaLogger.info(`Manuelles Speichern: ${e.target.checked ? 'AKTIVIERT' : 'DEAKTIVIERT'}`);
    });
  }

  setupDraggable() {
    const header = this.container.querySelector('#alma-hud-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      // Switch to left positioning
      this.container.style.right = 'auto';
      this.container.style.left = `${initialLeft}px`;
      this.container.style.top = `${initialTop}px`;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        this.container.style.left = `${Math.max(10, initialLeft + dx)}px`;
        this.container.style.top = `${Math.max(10, initialTop + dy)}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  updatePageStateDebounced() {
    if (this._updateTimer) clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => this.updatePageState(), 250);
  }

  updatePageState() {
    const page = AlmaSelectors.detectCurrentPage();
    if (page === this._lastPage) return;
    this._lastPage = page;

    if (page === 'PHYSICAL_ITEM_EDITOR') {
      this.pageText.textContent = 'Exemplar-Editor';
      this.statusBadge.className = 'alma-hud-status-badge status-editor';
      this.statusBadge.textContent = 'Editor aktiv';
      this.infoBox.innerHTML = 'Im <b>Editor für physische Exemplare</b>.<br>Klicke unten oder drücke <b>Alt+X</b>.';

      this.actionArea.innerHTML = `
        <button class="alma-hud-action-btn" id="alma-hud-btn-process">
          <span>⚡</span> Exemplar bearbeiten (Alt+X)
        </button>
        <button class="alma-hud-action-btn btn-save" id="alma-hud-btn-save">
          <span>💾</span> Jetzt Speichern (Alt+S)
        </button>
        <button class="alma-hud-action-btn btn-secondary" id="alma-hud-btn-inspect">
          <span>🔍</span> Felder überprüfen
        </button>
      `;

      this.container.querySelector('#alma-hud-btn-process')?.addEventListener('click', () => {
        this.controller.handleProcessItem();
      });

      this.container.querySelector('#alma-hud-btn-save')?.addEventListener('click', () => {
        this.controller.handleSaveItem();
      });

      this.container.querySelector('#alma-hud-btn-inspect')?.addEventListener('click', () => {
        this.inspectAndHighlightFields();
      });

    } else if (page === 'EXEMPLAR_LIST') {
      this.pageText.textContent = 'Liste der Exemplare';
      this.statusBadge.className = 'alma-hud-status-badge status-list';
      this.statusBadge.textContent = 'Liste aktiv';
      this.infoBox.innerHTML = 'Finde das markierte Exemplar und öffne den Editor.';

      this.actionArea.innerHTML = `
        <button class="alma-hud-action-btn" id="alma-hud-btn-open-editor">
          <span>✏️</span> Markiertes Exemplar bearbeiten
        </button>
      `;

      this.container.querySelector('#alma-hud-btn-open-editor')?.addEventListener('click', () => {
        AlmaNavigationHandler.openHighlightedExemplarEditor();
      });

    } else if (page === 'SEARCH_RESULTS') {
      this.pageText.textContent = 'Suchergebnisse';
      this.statusBadge.className = 'alma-hud-status-badge status-search';
      this.statusBadge.textContent = 'Suche aktiv';
      this.infoBox.innerHTML = 'Klicke auf <b>Alle Exemplare</b>, um zur Liste zu gelangen.';

      this.actionArea.innerHTML = `
        <button class="alma-hud-action-btn" id="alma-hud-btn-open-exemplare">
          <span>📚</span> Alle Exemplare öffnen
        </button>
      `;

      this.container.querySelector('#alma-hud-btn-open-exemplare')?.addEventListener('click', () => {
        AlmaNavigationHandler.openAlleExemplare();
      });

    } else {
      this.pageText.textContent = 'Alma Hauptseite';
      this.statusBadge.className = 'alma-hud-status-badge status-idle';
      this.statusBadge.textContent = 'Warte...';
      this.infoBox.innerHTML = 'Navigiere zu einem Titel oder Exemplar in Alma.';
      this.actionArea.innerHTML = `
        <button class="alma-hud-action-btn btn-secondary" id="alma-hud-btn-rescan">
          <span>🔄</span> Seite neu scannen
        </button>
      `;
      this.container.querySelector('#alma-hud-btn-rescan')?.addEventListener('click', () => {
        this._lastPage = null;
        this.updatePageState();
      });
    }
  }

  inspectAndHighlightFields() {
    const invNr = AlmaSelectors.getInventarnummerInput();
    const invDat = AlmaSelectors.getInventarisierungsdatumInput();
    const exSig = AlmaSelectors.getExemplarsignaturInput();
    const saveBtn = AlmaSelectors.getSaveButton();

    AlmaLogger.info('--- Feldinspektion ---');
    AlmaLogger.info(`Inventarnummer: ${invNr ? 'GEFUNDEN' : 'NICHT GEFUNDEN'}`);
    AlmaLogger.info(`Inventarisierungsdatum: ${invDat ? 'GEFUNDEN' : 'NICHT GEFUNDEN'}`);
    AlmaLogger.info(`Exemplarsignatur: ${exSig ? 'GEFUNDEN' : 'NICHT GEFUNDEN'}`);
    AlmaLogger.info(`Speichern-Button: ${saveBtn ? 'GEFUNDEN' : 'NICHT GEFUNDEN'}`);

    if (invNr) AlmaDomUtils.highlight(invNr, '#e0f2fe');
    if (invDat) AlmaDomUtils.highlight(invDat, '#e0f2fe');
    if (exSig) AlmaDomUtils.highlight(exSig, '#fef9c3');
  }
}

if (typeof window !== 'undefined') {
  window.AlmaUiPanel = AlmaUiPanel;
}
