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
    this.lastCompletedResult = null;
    this._lastStateKey = null;
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

    // Listen for operation completion events to display verification state
    window.addEventListener('alma-operation-completed', (e) => {
      this.lastCompletedResult = e.detail;
      this._lastStateKey = null;
      this.updatePageState();
    });
  }

  createHudElement() {
    this.container = document.createElement('div');
    this.container.id = 'alma-assistant-hud';

    this.container.innerHTML = `
      <div class="alma-hud-container">
        <div class="alma-hud-header" id="alma-hud-header">
          <div class="alma-hud-title">
            <span>Alma Assistant</span>
            <span class="alma-hud-title-badge">v1.2</span>
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
            Initialisiere...
          </div>

          <div id="alma-hud-action-area" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Contextual action buttons injected here -->
          </div>

          <div class="alma-hud-log-header">
            <span>Protokoll (Größe anpassbar ↘)</span>
            <button class="alma-hud-btn-text" id="alma-hud-btn-clear-log" title="Protokoll leeren">Leeren</button>
          </div>
          <div class="alma-hud-log-box" id="alma-hud-logs">
            <div class="alma-hud-log-line alma-log-info">Alma Assistant bereit.</div>
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
    line.className = `alma-hud-log-line alma-log-${entry.level}`;
    line.textContent = `[${entry.timestamp}] ${entry.message}`;
    this.logBox.appendChild(line);
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }

  setupEventListeners() {
    const toggleBtn = this.container.querySelector('#alma-hud-toggle-btn');
    const hudContainer = this.container.querySelector('.alma-hud-container');
    const clearLogBtn = this.container.querySelector('#alma-hud-btn-clear-log');

    toggleBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      hudContainer.classList.toggle('collapsed', this.isCollapsed);
      toggleBtn.textContent = this.isCollapsed ? '+' : '−';
    });

    clearLogBtn?.addEventListener('click', () => {
      if (this.logBox) {
        this.logBox.innerHTML = '<div class="alma-hud-log-line alma-log-info">Protokoll geleert.</div>';
      }
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
    this._updateTimer = setTimeout(() => this.updatePageState(), 200);
  }

  updatePageState() {
    const page = AlmaSelectors.detectCurrentPage();
    let currentTab = null;
    if (page === 'PHYSICAL_ITEM_EDITOR') {
      currentTab = AlmaSelectors.detectCurrentEditorTab();
    }

    const stateKey = `${page}_${currentTab}_${this.lastCompletedResult ? 'DONE' : 'IDLE'}`;
    if (stateKey === this._lastStateKey) return;
    this._lastStateKey = stateKey;

    if (page === 'PHYSICAL_ITEM_EDITOR') {
      if (currentTab === 'NOTIZEN') {
        // STATE: Inside Exemplar -> Notizen Tab
        this.lastCompletedResult = null;
        this.pageText.textContent = 'Notizen-Prüfung';
        this.statusBadge.className = 'alma-hud-status-badge alma-status-notes';
        this.statusBadge.textContent = 'Notizen';
        this.infoBox.innerHTML = 'Manuelle Prüfung: Bitte überprüfe, ob auf diesem Bildschirm <b>RETRO</b> vermerkt ist.';

        this.actionArea.innerHTML = `
          <div class="alma-hud-question-box">
            <div class="alma-hud-question-title">Ist RETRO vorhanden?</div>
            <div class="alma-hud-decision-grid">
              <button class="alma-hud-action-btn alma-btn-yes" id="alma-hud-btn-retro-yes">
                <span>✅</span> Ja (Retro)
              </button>
              <button class="alma-hud-action-btn alma-btn-no" id="alma-hud-btn-retro-no">
                <span>❌</span> Nein (Kein Retro)
              </button>
            </div>
            <div class="alma-hud-hint-text">Taste [J] für Ja &bull; Taste [N] für Nein</div>
            <button class="alma-hud-btn-text" id="alma-hud-btn-cancel-notes" style="margin-top: 4px; text-align: center; color: #64748b; font-size: 11px;">Zurück zu Allgemein (Alt+1)</button>
          </div>
        `;

        this.container.querySelector('#alma-hud-btn-retro-yes')?.addEventListener('click', async () => {
          const btn = this.container.querySelector('#alma-hud-btn-retro-yes');
          if (btn) btn.textContent = 'Speichere Ja & gehe zu Allgemein...';
          await this.controller.handleRetroDecision(true);
          this._lastStateKey = null;
          this.updatePageState();
        });

        this.container.querySelector('#alma-hud-btn-retro-no')?.addEventListener('click', async () => {
          const btn = this.container.querySelector('#alma-hud-btn-retro-no');
          if (btn) btn.textContent = 'Speichere Nein & gehe zu Allgemein...';
          await this.controller.handleRetroDecision(false);
          this._lastStateKey = null;
          this.updatePageState();
        });

        this.container.querySelector('#alma-hud-btn-cancel-notes')?.addEventListener('click', async () => {
          await this.controller.editorHandler.openAllgemeinTab();
          this._lastStateKey = null;
          this.updatePageState();
        });

      } else {
        // STATE: Inside Exemplar -> Allgemein Tab (where fields are shown)
        this.pageText.textContent = 'Exemplar-Editor';
        this.statusBadge.className = 'alma-hud-status-badge alma-status-editor';
        this.statusBadge.textContent = 'Allgemein';

        if (this.lastCompletedResult) {
          // Operation just executed, waiting for manual check & save
          this.infoBox.innerHTML = 'Felder wurden aktualisiert. <b>Bitte prüfen und speichern.</b>';
          this.actionArea.innerHTML = `
            <div class="alma-hud-completion-banner">
              <b>✅ Operation ausgeführt!</b><br>
              Datum gesetzt: <b>${this.lastCompletedResult.dateApplied}</b> (${this.lastCompletedResult.hasRetro ? 'Retro: Ja' : 'Retro: Nein'})<br>
              <span style="font-size: 11px; color: #475569;">Warte auf manuelle Prüfung. Drücke <b>Speichern</b> (Alt+S).</span>
            </div>
            <button class="alma-hud-action-btn alma-btn-save" id="alma-hud-btn-save">
              <span>💾</span> Jetzt Speichern (Alt+S)
            </button>
            <button class="alma-hud-action-btn alma-btn-secondary" id="alma-hud-btn-goto-notes">
              <span>📝</span> Zu Notizen gehen (Alt+3)
            </button>
          `;

          this.container.querySelector('#alma-hud-btn-save')?.addEventListener('click', () => {
            this.controller.handleSaveItem();
          });

          this.container.querySelector('#alma-hud-btn-goto-notes')?.addEventListener('click', async () => {
            this.lastCompletedResult = null;
            await this.controller.handleGoToNotizen();
            this._lastStateKey = null;
            this.updatePageState();
          });

        } else {
          // Standard state inside Exemplar (Allgemein): Single button takes user to Notizen
          this.infoBox.innerHTML = 'Im <b>Editor für physische Exemplare</b> (Allgemein).<br>Klicke unten, um Notizen zu prüfen.';
          this.actionArea.innerHTML = `
            <button class="alma-hud-action-btn" id="alma-hud-btn-goto-notes">
              <span>📝</span> Zu Notizen gehen (Alt+3)
            </button>
          `;

          this.container.querySelector('#alma-hud-btn-goto-notes')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#alma-hud-btn-goto-notes');
            if (btn) btn.textContent = 'Wechsle zu Notizen (Alt+3)...';
            await this.controller.handleGoToNotizen();
            this._lastStateKey = null;
            this.updatePageState();
          });
        }
      }

    } else if (page === 'EXEMPLAR_LIST') {
      this.lastCompletedResult = null;
      this.pageText.textContent = 'Liste der Exemplare';
      this.statusBadge.className = 'alma-hud-status-badge alma-status-list';
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
      this.lastCompletedResult = null;
      this.pageText.textContent = 'Suchergebnisse';
      this.statusBadge.className = 'alma-hud-status-badge alma-status-search';
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
      this.lastCompletedResult = null;
      this.pageText.textContent = 'Alma Hauptseite';
      this.statusBadge.className = 'alma-hud-status-badge alma-status-idle';
      this.statusBadge.textContent = 'Warte...';
      this.infoBox.innerHTML = 'Navigiere zu einem Titel oder Exemplar in Alma.';
      this.actionArea.innerHTML = `
        <button class="alma-hud-action-btn alma-btn-secondary" id="alma-hud-btn-rescan">
          <span>🔄</span> Seite neu scannen
        </button>
      `;
      this.container.querySelector('#alma-hud-btn-rescan')?.addEventListener('click', () => {
        this._lastStateKey = null;
        this.updatePageState();
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.AlmaUiPanel = AlmaUiPanel;
}
