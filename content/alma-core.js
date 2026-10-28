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

    // 2. Initialize in-page HUD if enabled
    if (this.config.showFloatingHud) {
      this.uiPanel = new AlmaUiPanel(this);
      this.uiPanel.init();
    }

    // 3. Register global keyboard listeners
    this.registerHotkeys();

    // 4. Register browser runtime message listeners (for extension popup)
    this.registerMessageListeners();

    AlmaLogger.success('Alma Workflow Assistant loaded and ready! Press Alt+X to process items.');
  }

  registerHotkeys() {
    window.addEventListener('keydown', (e) => {
      // Hotkey: Alt + X (Process item)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        this.handleProcessItem();
      }

      // Hotkey: Alt + E (Open highlighted exemplar editor when on exemplar list)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        const page = AlmaSelectors.detectCurrentPage();
        if (page === 'EXEMPLAR_LIST') {
          e.preventDefault();
          e.stopPropagation();
          AlmaNavigationHandler.openHighlightedExemplarEditor();
        }
      }
    }, true);
  }

  registerMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'PROCESS_ITEM') {
          this.handleProcessItem().then(sendResponse);
          return true; // asynchronous response
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

  async handleProcessItem() {
    if (this.isProcessing) {
      AlmaLogger.warn('Automation already in progress, please wait...');
      return;
    }

    const page = AlmaSelectors.detectCurrentPage();
    if (page !== 'PHYSICAL_ITEM_EDITOR') {
      AlmaLogger.warn(`Aktuelle Seite ist "${page}". Bitte zuerst den Exemplar-Editor öffnen.`);
      return;
    }

    this.isProcessing = true;
    try {
      const result = await this.editorHandler.processCurrentItem();
      return result;
    } catch (err) {
      AlmaLogger.error(`Error during processing: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
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
