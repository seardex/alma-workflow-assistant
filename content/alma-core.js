/**
 * Alma Workflow Assistant - Core Controller
 * Coordinates DOM handlers, keyboard shortcuts, UI overlay, and extension messaging.
 */
class AlmaCoreController {
  constructor() {
    this.config = { ...DEFAULT_ALMA_CONFIG };
    this.editorHandler = null;
    this.uiPanel = null;
    this.isProcessing = false;
  }

  async init() {
    // 1. Load user configuration
    this.config = await AlmaConfigManager.getConfig();
    this.editorHandler = new AlmaEditorHandler(this.config);

    // 2. Check and resume any pending workflow decision (handles page reloads across tabs)
    try {
      await this.editorHandler.checkAndResumeWorkflow();
    } catch (e) {
      AlmaLogger.warn('Fehler bei Prüfung auf ausstehende Entscheidungen:', e.message);
    }

    // 3. Initialize in-page HUD if enabled
    if (this.config.showFloatingHud) {
      this.uiPanel = new AlmaUiPanel(this);
      this.uiPanel.init();
    }

    // 4. Register global keyboard listeners
    this.registerHotkeys();

    // 5. Register browser runtime message listeners (for extension popup)
    this.registerMessageListeners();

    AlmaLogger.success('Alma Workflow Assistant bereit. Klicke "Zu Notizen wechseln" oder drücke Alt+X.');
  }

  registerHotkeys() {
    window.addEventListener('keydown', (e) => {
      const page = AlmaSelectors.detectCurrentPage();
      const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || (e.target && e.target.isContentEditable);

      // Hotkey: Alt + X (Switch to Notizen when on Allgemein)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        if (page === 'PHYSICAL_ITEM_EDITOR') {
          if (!AlmaSelectors.isNotizenTabActive()) {
            this.handleGoToNotizen();
          }
        }
        return;
      }

      // Hotkey: Alt + E (Open highlighted exemplar editor when on exemplar list)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        if (page === 'EXEMPLAR_LIST') {
          e.preventDefault();
          e.stopPropagation();
          AlmaNavigationHandler.openHighlightedExemplarEditor();
        }
        return;
      }

      // Quick decision keys on Notizen tab: [J] / [Y] for Yes, [N] for No (only when not typing in input)
      if (!isTyping && page === 'PHYSICAL_ITEM_EDITOR' && AlmaSelectors.isNotizenTabActive() && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'j' || e.key === 'J' || e.key === 'y' || e.key === 'Y' || e.key === '1') {
          e.preventDefault();
          this.handleRetroDecision(true);
        } else if (e.key === 'n' || e.key === 'N' || e.key === '2') {
          e.preventDefault();
          this.handleRetroDecision(false);
        }
      }
    }, true);
  }

  registerMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GOTO_NOTIZEN' || request.action === 'PROCESS_ITEM') {
          this.handleGoToNotizen().then(sendResponse);
          return true; // asynchronous response
        }

        if (request.action === 'RETRO_DECISION') {
          this.handleRetroDecision(request.hasRetro).then(sendResponse);
          return true;
        }

        if (request.action === 'SAVE_ITEM') {
          this.handleSaveItem().then(sendResponse);
          return true;
        }

        if (request.action === 'OPEN_HIGHLIGHTED') {
          AlmaNavigationHandler.openHighlightedExemplarEditor().then(sendResponse);
          return true;
        }

        if (request.action === 'CONFIG_UPDATED') {
          this.config = { ...this.config, ...request.config };
          this.editorHandler.config = this.config;
          sendResponse({ success: true });
        }
      });
    }
  }

  async handleGoToNotizen() {
    if (this.isProcessing) {
      AlmaLogger.warn('Aktion läuft bereits, bitte warten...');
      return;
    }

    const page = AlmaSelectors.detectCurrentPage();
    if (page !== 'PHYSICAL_ITEM_EDITOR') {
      AlmaLogger.warn(`Aktuelle Seite ist "${page}". Bitte zuerst den Exemplar-Editor öffnen.`);
      return;
    }

    this.isProcessing = true;
    try {
      await this.editorHandler.goToNotizenWorkflow();
      this.uiPanel?.updatePageState();
    } catch (err) {
      AlmaLogger.error(`Fehler beim Wechseln zu Notizen: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async handleRetroDecision(hasRetro) {
    if (this.isProcessing) {
      AlmaLogger.warn('Aktion läuft bereits, bitte warten...');
      return;
    }

    this.isProcessing = true;
    try {
      const result = await this.editorHandler.applyRetroDecision(hasRetro);
      this.uiPanel?.updatePageState();
      return result;
    } catch (err) {
      AlmaLogger.error(`Fehler bei Anwendung der Entscheidung: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async handleProcessItem() {
    return this.handleGoToNotizen();
  }

  async handleSaveItem() {
    return this.editorHandler.saveCurrentItem();
  }
}

// Auto-instantiate when DOM is loaded
if (typeof window !== 'undefined') {
  const almaController = new AlmaCoreController();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => almaController.init());
  } else {
    almaController.init();
  }
  window.almaAssistantController = almaController;
}
