/**
 * Editor Handler: Handles the workflow inside "Editor für physische Exemplare".
 * 
 * Bulletproof Workflow:
 * 1. When inside Exemplar (Allgemein): show single button to navigate to Notizen (Alt+3 / Alt+X).
 * 2. User manually audits the Notizen tab for retro presence.
 * 3. Text prompt asks if RETRO is written on screen with simple Yes / No buttons (or hotkey J/N).
 * 4. Answering Yes or No immediately returns to Allgemein and performs field operations:
 *    - If Inventarnummer already populated: Clear Exemplarsignatur, assign target date
 *    - If empty: Cut Exemplarsignatur -> Inventarnummer, assign target date (Yes -> dateRetro, No -> dateNoRetro)
 * 5. Highlight changes and wait for user to review and press save (Alt+S).
 */
class AlmaEditorHandler {
  constructor(config = DEFAULT_ALMA_CONFIG) {
    this.config = config;
  }

  /**
   * Switch to Notizen tab via Alma submit button or native shortcut,
   * dynamically awaiting tab render.
   */
  async openNotizenTab() {
    if (AlmaSelectors.isNotizenTabActive()) {
      AlmaLogger.info('"Notizen"-Tab ist bereits aktiv.');
      return true;
    }

    AlmaLogger.info('Wechsle zum "Notizen"-Tab (Alt+3)...');
    
    // In Alma, tabs navigate via hidden submit inputs or parent li clicks
    const submitBtn = document.getElementById('cresource_editornotes') ||
                      document.querySelector('#cresource_editornotes_span input[type="submit"]');
    
    if (submitBtn) {
      submitBtn.click();
    } else {
      const tab = AlmaSelectors.getNotizenTab();
      if (tab) {
        AlmaDomUtils.simulateClick(tab);
      } else {
        AlmaDomUtils.simulateShortcut('3', true);
      }
    }

    // Wait until Alma renders the Notizen page
    let ok = await AlmaDomUtils.waitForCondition(() => AlmaSelectors.isNotizenTabActive(), 3000, 150);
    if (!ok) {
      AlmaLogger.info('Warte noch... Simuliere Alt+3...');
      AlmaDomUtils.simulateShortcut('3', true);
      ok = await AlmaDomUtils.waitForCondition(() => AlmaSelectors.isNotizenTabActive(), 4000, 150);
    }

    if (ok) {
      AlmaLogger.info('Notizen-Tab geladen. Bitte prüfe, ob "RETRO" vermerkt ist.');
    } else {
      AlmaLogger.warn('Wartezeit auf Notizen-Tab abgelaufen.');
    }

    await AlmaDomUtils.sleep(250);
    return ok;
  }

  /**
   * Switch to Allgemein tab via Alma submit button or native shortcut,
   * dynamically awaiting tab render.
   */
  async openAllgemeinTab() {
    if (AlmaSelectors.isAllgemeinTabActive()) {
      AlmaLogger.info('"Allgemein"-Tab ist bereits aktiv.');
      return true;
    }

    AlmaLogger.info('Wechsle zurück zum "Allgemein"-Tab (Alt+1)...');

    const submitBtn = document.getElementById('cresource_editorgeneral') ||
                      document.querySelector('#cresource_editorgeneral_span input[type="submit"]');

    if (submitBtn) {
      submitBtn.click();
    } else {
      const tab = AlmaSelectors.getAllgemeinTab();
      if (tab) {
        AlmaDomUtils.simulateClick(tab);
      } else {
        AlmaDomUtils.simulateShortcut('1', true);
      }
    }

    // Wait until Alma renders the Allgemein page AND target form fields exist in DOM
    let ok = await AlmaDomUtils.waitForCondition(() => AlmaSelectors.isAllgemeinTabActive(), 3000, 150);
    if (!ok) {
      AlmaLogger.info('Warte noch... Simuliere Alt+1...');
      AlmaDomUtils.simulateShortcut('1', true);
      ok = await AlmaDomUtils.waitForCondition(() => AlmaSelectors.isAllgemeinTabActive(), 4000, 150);
    }

    if (ok) {
      AlmaLogger.info('Allgemein-Tab erfolgreich geladen.');
    } else {
      AlmaLogger.warn('Wartezeit auf Allgemein-Tab abgelaufen.');
    }

    // Settling pause to allow Alma's post-AJAX scripts to finish
    await AlmaDomUtils.sleep(300);
    return ok;
  }

  /**
   * Workflow step 1: Navigate to Notizen from Allgemein
   */
  async goToNotizenWorkflow() {
    try {
      sessionStorage.setItem('alma_workflow_step', 'awaiting_retro_choice');
      await this.openNotizenTab();
    } catch (err) {
      AlmaLogger.error(`Fehler beim Wechseln zu Notizen: ${err.message}`);
    }
  }

  /**
   * Workflow step 2: User answered Yes or No to the retro question.
   * Immediately navigates back to Allgemein and executes the operation.
   */
  async applyRetroDecision(hasRetro) {
    AlmaLogger.info(`Entscheidung: Retro = ${hasRetro ? 'JA' : 'NEIN'}. Kehre zur Allgemein-Seite zurück...`);

    // Store in sessionStorage in case Alma performs a full-page reload on tab switch
    sessionStorage.setItem('alma_retro_decision', hasRetro ? 'yes' : 'no');
    sessionStorage.removeItem('alma_workflow_step');

    // Switch back to Allgemein
    await this.openAllgemeinTab();

    // If still in same JS execution context, execute transformation immediately
    if (sessionStorage.getItem('alma_retro_decision')) {
      sessionStorage.removeItem('alma_retro_decision');
      return await this.executeFieldTransformations(hasRetro);
    }
  }

  /**
   * Checks for any pending decision stored in sessionStorage
   * (handles Alma page reloads during tab switching)
   */
  async checkAndResumeWorkflow() {
    const pendingDecision = sessionStorage.getItem('alma_retro_decision');
    if (pendingDecision && AlmaSelectors.isAllgemeinTabActive()) {
      sessionStorage.removeItem('alma_retro_decision');
      AlmaLogger.info(`Setze Operation nach Tab-Wechsel fort (Retro: ${pendingDecision.toUpperCase()})...`);
      return await this.executeFieldTransformations(pendingDecision === 'yes');
    }
  }

  /**
   * Executes the field transformations on the Allgemein tab
   */
  async executeFieldTransformations(hasRetro) {
    AlmaLogger.info('Führe Feldoperationen auf Allgemein-Seite aus...');
    AlmaDomUtils.suppressDatepicker(true);

    try {
      // Ensure target fields are rendered
      await AlmaDomUtils.waitForCondition(() => AlmaSelectors.isAllgemeinTabReady(), 5000, 100);

      const inventarNummerInput = AlmaSelectors.getInventarnummerInput();
      const inventarDatumInput = AlmaSelectors.getInventarisierungsdatumInput();
      const exemplarSignaturInput = AlmaSelectors.getExemplarsignaturInput();

      if (!exemplarSignaturInput && !inventarNummerInput && !inventarDatumInput) {
        const errMsg = 'Konnte Formularfelder in "Allgemein" nicht finden.';
        AlmaLogger.error(errMsg);
        throw new Error(errMsg);
      }

      const targetDate = hasRetro ? this.config.dateRetro : this.config.dateNoRetro;
      const currentInventarNummer = (inventarNummerInput?.value || '').trim();
      const currentExemplarSignatur = (exemplarSignaturInput?.value || '').trim();

      const result = {
        hasRetro,
        dateApplied: targetDate,
        fieldsModified: [],
        actionTaken: null
      };

      const isAlreadyMigrated = currentInventarNummer.length > 0;

      if (isAlreadyMigrated) {
        AlmaLogger.info(
          `Bereits vorhandene Inventarnummer erkannt ("${currentInventarNummer}"). Leere Exemplarsignatur.`
        );

        if (exemplarSignaturInput && currentExemplarSignatur.length > 0) {
          AlmaDomUtils.clearInputValue(exemplarSignaturInput);
          AlmaDomUtils.highlight(
            exemplarSignaturInput,
            this.config.fieldHighlightColor,
            this.config.fieldHighlightBorder,
            true
          );
          result.fieldsModified.push('Exemplarsignatur (geleert)');
          AlmaLogger.success('Exemplarsignatur geleert.');
        }

        if (inventarDatumInput) {
          AlmaDomUtils.setDateInputValue(inventarDatumInput, targetDate);
          AlmaDomUtils.highlight(
            inventarDatumInput,
            this.config.fieldHighlightColor,
            this.config.fieldHighlightBorder,
            true
          );
          result.fieldsModified.push(`Inventarisierungsdatum = "${targetDate}"`);
        }

        result.actionTaken = 'CLEARED_SIGNATUR_EXISTING_DATA';
      } else {
        AlmaLogger.info(
          `Übertrage Exemplarsignatur "${currentExemplarSignatur}" nach Inventarnummer und setze Datum "${targetDate}" (Retro: ${hasRetro ? 'JA' : 'NEIN'}).`
        );

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
          AlmaLogger.warn('Konnte Feld "Inventarnummer" nicht finden.');
        }

        if (exemplarSignaturInput) {
          AlmaDomUtils.clearInputValue(exemplarSignaturInput);
          AlmaDomUtils.highlight(
            exemplarSignaturInput,
            this.config.fieldHighlightColor,
            this.config.fieldHighlightBorder,
            true
          );
          result.fieldsModified.push('Exemplarsignatur (ausgeschnitten/geleert)');
        }

        if (inventarDatumInput) {
          AlmaDomUtils.setDateInputValue(inventarDatumInput, targetDate);
          AlmaDomUtils.highlight(
            inventarDatumInput,
            this.config.fieldHighlightColor,
            this.config.fieldHighlightBorder,
            true
          );
          result.fieldsModified.push(`Inventarisierungsdatum = "${targetDate}"`);
        } else {
          AlmaLogger.warn('Konnte Feld "Inventarisierungsdatum" nicht finden.');
        }

        result.actionTaken = 'TRANSFERRED_AND_DATED';
      }

      AlmaLogger.success(
        `Fertig! Operation abgeschlossen. Datum: ${targetDate} (Retro: ${hasRetro ? 'JA' : 'NEIN'}). Bitte Felder prüfen und "Speichern" (Alt+S) drücken.`
      );

      // Dispatch event to update HUD display with completion info
      try {
        window.dispatchEvent(new CustomEvent('alma-operation-completed', {
          detail: result
        }));
      } catch (_) {}

      return result;
    } finally {
      setTimeout(() => {
        AlmaDomUtils.suppressDatepicker(false);
      }, 1500);
    }
  }

  /**
   * Entry point for hotkey or default trigger: opens Notizen
   */
  async processCurrentItem() {
    return this.goToNotizenWorkflow();
  }

  /**
   * Triggers Alma save action
   */
  async saveCurrentItem() {
    const saveBtn = AlmaSelectors.getSaveButton();
    if (saveBtn) {
      AlmaDomUtils.simulateClick(saveBtn);
      AlmaLogger.success('Alma "Speichern"-Button angeklickt.');
    } else {
      AlmaDomUtils.simulateShortcut('s', true);
      AlmaLogger.success('Alt+S Shortcut simuliert.');
    }
  }
}

if (typeof window !== 'undefined') {
  window.AlmaEditorHandler = AlmaEditorHandler;
}
