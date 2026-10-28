/**
 * Editor Handler: Handles the workflow inside "Editor für physische Exemplare".
 * 
 * Steps:
 * 1. Switch to Notizen (Alt+3 or click)
 * 2. Scan for keyword "Retro" (case-insensitive) across all note fields
 * 3. Switch back to Allgemein (Alt+1 or click)
 * 4. Inspect Inventarnummer & Inventarisierungsdatum:
 *    - If already populated: Clear Exemplarsignatur
 *    - If empty: Cut Exemplarsignatur -> Inventarnummer, set date (Retro: 31.12.1984 vs No-Retro: 11/11/1999)
 * 5. Highlight changes and wait for user's explicit save confirmation (100% manual control)
 */
class AlmaEditorHandler {
  constructor(config = DEFAULT_ALMA_CONFIG) {
    this.config = config;
  }

  /**
   * Switch to Notizen tab via native shortcut or tab button click
   */
  async openNotizenTab() {
    AlmaLogger.info('Switching to "Notizen" tab (Alt+3)...');
    
    // Strategy 1: Try clicking tab button
    const tab = AlmaSelectors.getNotizenTab();
    if (tab) {
      AlmaDomUtils.simulateClick(tab);
    } else {
      // Strategy 2: Alma native shortcut Alt+3
      AlmaDomUtils.simulateShortcut('3', true);
    }

    await AlmaDomUtils.sleep(this.config.domWaitDelayMs);
  }

  /**
   * Switch to Allgemein tab via native shortcut or tab button click
   */
  async openAllgemeinTab() {
    AlmaLogger.info('Switching to "Allgemein" tab (Alt+1)...');

    const tab = AlmaSelectors.getAllgemeinTab();
    if (tab) {
      AlmaDomUtils.simulateClick(tab);
    } else {
      AlmaDomUtils.simulateShortcut('1', true);
    }

    await AlmaDomUtils.sleep(this.config.domWaitDelayMs);
  }

  /**
   * Scans all note inputs/textareas in the Notizen tab for search keyword
   */
  scanNotizenForRetro() {
    const keywordRegex = new RegExp(this.config.searchKeyword, 'i');
    const fields = AlmaSelectors.getNotizenInputFields();
    
    const matches = [];

    for (const field of fields) {
      const val = (field.element.value || field.element.textContent || '').trim();
      if (keywordRegex.test(val)) {
        matches.push({ label: field.label, value: val });
        AlmaDomUtils.highlight(field.element, '#fff3cd', '2px solid #ffeeba');
      }
    }

    const hasRetro = matches.length > 0;
    if (hasRetro) {
      AlmaLogger.warn(`Keyword "${this.config.searchKeyword}" found in: ${matches.map(m => m.label).join(', ')}`);
    } else {
      AlmaLogger.info(`No "${this.config.searchKeyword}" found in Notizen fields.`);
    }

    return { hasRetro, matches };
  }

  /**
   * Executes the complete editor automation flow
   */
  async processCurrentItem() {
    AlmaLogger.info('Starting Physical Item Editor automation...');

    // 1. Switch to Notizen
    await this.openNotizenTab();

    // 2. Scan Notizen for "Retro"
    const { hasRetro, matches } = this.scanNotizenForRetro();

    // 3. Switch back to Allgemein
    await this.openAllgemeinTab();

    // 4. Locate target input fields in Allgemein
    const inventarNummerInput = AlmaSelectors.getInventarnummerInput();
    const inventarDatumInput = AlmaSelectors.getInventarisierungsdatumInput();
    const exemplarSignaturInput = AlmaSelectors.getExemplarsignaturInput();

    if (!exemplarSignaturInput) {
      const errMsg = 'Could not locate "Exemplarsignatur" input field.';
      AlmaLogger.error(errMsg);
      throw new Error(errMsg);
    }

    const currentInventarNummer = (inventarNummerInput?.value || '').trim();
    const currentInventarDatum = (inventarDatumInput?.value || '').trim();
    const currentExemplarSignatur = (exemplarSignaturInput?.value || '').trim();

    const result = {
      hasRetro,
      retroMatches: matches,
      previousSignatur: currentExemplarSignatur,
      dateApplied: null,
      actionTaken: null,
      fieldsModified: []
    };

    // 5. Conditional branching:
    // Case 1: Inventarnummer or Inventarisierungsdatum already have content
    const hasExistingInventoryData = currentInventarNummer.length > 0 || currentInventarDatum.length > 0;

    if (hasExistingInventoryData) {
      AlmaLogger.info(
        `Existing inventory values detected (Nr: "${currentInventarNummer}", Datum: "${currentInventarDatum}"). Clearing Exemplarsignatur.`
      );

      // Clear Exemplarsignatur field
      AlmaDomUtils.clearInputValue(exemplarSignaturInput);
      AlmaDomUtils.highlight(
        exemplarSignaturInput,
        this.config.fieldHighlightColor,
        this.config.fieldHighlightBorder,
        true
      );

      result.actionTaken = 'CLEARED_SIGNATUR_EXISTING_DATA';
      result.fieldsModified.push('Exemplarsignatur (gelehrt)');
      AlmaLogger.success('Exemplarsignatur successfully cleared.');
    } else {
      // Case 2: Inventarnummer and Inventarisierungsdatum are empty (99% standard flow)
      const targetDate = hasRetro ? this.config.dateRetro : this.config.dateNoRetro;

      AlmaLogger.info(
        `Moving Exemplarsignatur "${currentExemplarSignatur}" to Inventarnummer and setting date "${targetDate}".`
      );

      // Cut Exemplarsignatur -> Paste into Inventarnummer
      if (inventarNummerInput) {
        AlmaDomUtils.setInputValue(inventarNummerInput, currentExemplarSignatur);
        AlmaDomUtils.highlight(
          inventarNummerInput,
          this.config.fieldHighlightColor,
          this.config.fieldHighlightBorder,
          true
        );
        result.fieldsModified.push(`Inventarnummer = "${currentExemplarSignatur}"`);
      } else {
        AlmaLogger.warn('Could not locate Inventarnummer input field to paste signature.');
      }

      // Empty Exemplarsignatur
      AlmaDomUtils.clearInputValue(exemplarSignaturInput);
      AlmaDomUtils.highlight(
        exemplarSignaturInput,
        this.config.fieldHighlightColor,
        this.config.fieldHighlightBorder,
        true
      );
      result.fieldsModified.push('Exemplarsignatur (ausgeschnitten/geleert)');

      // Set Inventarisierungsdatum
      if (inventarDatumInput) {
        AlmaDomUtils.setInputValue(inventarDatumInput, targetDate);
        AlmaDomUtils.highlight(
          inventarDatumInput,
          this.config.fieldHighlightColor,
          this.config.fieldHighlightBorder,
          true
        );
        result.dateApplied = targetDate;
        result.fieldsModified.push(`Inventarisierungsdatum = "${targetDate}"`);
      } else {
        AlmaLogger.warn('Could not locate Inventarisierungsdatum input field.');
      }

      result.actionTaken = 'TRANSFERRED_AND_DATED';
      AlmaLogger.success(
        `Fields filled! Signature moved. Date set to ${targetDate} (Retro: ${hasRetro ? 'YES' : 'NO'}).`
      );
    }

    // 6. Save handling (100% user control)
    if (this.config.requireManualSave) {
      AlmaLogger.info(
        'Manual confirmation required: Please inspect the highlighted fields, then press Alt+S or click "Speichern".'
      );
    } else {
      AlmaLogger.info('Auto-save enabled. Triggering save (Alt+S)...');
      await this.saveCurrentItem();
    }

    return result;
  }

  /**
   * Triggers Alma save action
   */
  async saveCurrentItem() {
    const saveBtn = AlmaSelectors.getSaveButton();
    if (saveBtn) {
      AlmaDomUtils.simulateClick(saveBtn);
      AlmaLogger.success('Clicked Alma "Speichern" button.');
    } else {
      AlmaDomUtils.simulateShortcut('s', true);
      AlmaLogger.success('Simulated Alt+S shortcut.');
    }
  }
}

if (typeof window !== 'undefined') {
  window.AlmaEditorHandler = AlmaEditorHandler;
}
