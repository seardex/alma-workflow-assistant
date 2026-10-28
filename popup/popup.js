/**
 * Popup Controller for Alma Assistant.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const dateRetroInput = document.getElementById('cfg-date-retro');
  const dateNoRetroInput = document.getElementById('cfg-date-no-retro');
  const keywordInput = document.getElementById('cfg-keyword');
  const manualSaveCheckbox = document.getElementById('cfg-manual-save');
  const showHudCheckbox = document.getElementById('cfg-show-hud');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const saveStatus = document.getElementById('save-status');

  const btnProcess = document.getElementById('btn-process-item');
  const btnSave = document.getElementById('btn-save-item');
  const btnOpenHighlighted = document.getElementById('btn-open-highlighted');

  // Load current configuration
  const config = await AlmaConfigManager.getConfig();
  dateRetroInput.value = config.dateRetro;
  dateNoRetroInput.value = config.dateNoRetro;
  keywordInput.value = config.searchKeyword;
  manualSaveCheckbox.checked = config.requireManualSave;
  showHudCheckbox.checked = config.showFloatingHud;

  // Send message to active Alma tab
  async function sendTabMessage(action, payload = {}) {
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!tabs || tabs.length === 0) {
        showStatus('Kein aktiver Tab gefunden.', 'error');
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Konnte Alma-Tab nicht erreichen. Bitte Seite neu laden.', 'error');
        }
      });
    } catch (err) {
      showStatus('Fehler bei Kommunikation mit Tab', 'error');
    }
  }

  function showStatus(text, type = 'success') {
    saveStatus.textContent = text;
    saveStatus.style.color = type === 'error' ? '#dc2626' : '#16a34a';
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2800);
  }

  // Quick action buttons
  btnProcess.addEventListener('click', () => {
    sendTabMessage('PROCESS_ITEM');
    window.close();
  });

  btnSave.addEventListener('click', () => {
    sendTabMessage('SAVE_ITEM');
    window.close();
  });

  btnOpenHighlighted.addEventListener('click', () => {
    sendTabMessage('OPEN_HIGHLIGHTED');
    window.close();
  });

  // Save settings
  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      dateRetro: dateRetroInput.value.trim() || '31.12.1984',
      dateNoRetro: dateNoRetroInput.value.trim() || '11/11/1999',
      searchKeyword: keywordInput.value.trim() || 'retro',
      requireManualSave: manualSaveCheckbox.checked,
      showFloatingHud: showHudCheckbox.checked
    };

    await AlmaConfigManager.saveConfig(updated);
    sendTabMessage('CONFIG_UPDATED', { config: updated });
    showStatus('Einstellungen erfolgreich gespeichert!');
  });
});
