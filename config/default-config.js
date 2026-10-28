/**
 * Default configuration and user settings for Alma Workflow Assistant.
 */
const DEFAULT_ALMA_CONFIG = {
  // Dates to populate based on Notizen inspection
  dateRetro: '31.12.1984',
  dateNoRetro: '11/11/1999',

  // Word to look for in Notizen fields (case-insensitive)
  searchKeyword: 'retro',

  // Safety settings: Do not auto-save unless explicitly enabled by user
  requireManualSave: true,

  // Delay in milliseconds after tab switching to allow Alma DOM to render
  domWaitDelayMs: 400,

  // Highlight color applied to modified fields for rapid visual review
  fieldHighlightColor: '#d4edda', // subtle light green
  fieldHighlightBorder: '2px solid #28a745',

  // Keyboard shortcut description (handled in content script)
  shortcutTrigger: 'Alt+X',

  // Show floating HUD widget inside Alma UI
  showFloatingHud: true
};

/**
 * Configuration manager supporting WebExtension storage API with localStorage fallback
 */
class AlmaConfigManager {
  static async getConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get(DEFAULT_ALMA_CONFIG, (stored) => {
            resolve({ ...DEFAULT_ALMA_CONFIG, ...stored });
          });
        });
      }
    } catch (e) {
      console.warn('[Alma Assistant] Storage API unavailable, using fallback', e);
    }

    try {
      const raw = localStorage.getItem('alma_assistant_config');
      if (raw) {
        return { ...DEFAULT_ALMA_CONFIG, ...JSON.parse(raw) };
      }
    } catch (_) {}

    return { ...DEFAULT_ALMA_CONFIG };
  }

  static async saveConfig(newConfig) {
    const merged = { ...DEFAULT_ALMA_CONFIG, ...newConfig };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise((resolve) => {
          chrome.storage.local.set(merged, resolve);
        });
      }
    } catch (e) {
      console.warn('[Alma Assistant] Could not save via storage API', e);
    }

    try {
      localStorage.setItem('alma_assistant_config', JSON.stringify(merged));
    } catch (_) {}

    return merged;
  }
}

// Export for ES and browser global scope
if (typeof window !== 'undefined') {
  window.DEFAULT_ALMA_CONFIG = DEFAULT_ALMA_CONFIG;
  window.AlmaConfigManager = AlmaConfigManager;
}
