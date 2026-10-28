/**
 * Navigation Handler: Handles finding highlighted exemplars and navigating
 * from Search Results -> Exemplar List -> Item Editor.
 */
class AlmaNavigationHandler {
  /**
   * On "Search Results" page: Clicks "Alle Exemplare (...)"
   */
  static async openAlleExemplare() {
    AlmaLogger.info('Searching for "Alle Exemplare" link...');
    const link = AlmaSelectors.getAlleExemplareLink();

    if (!link) {
      const msg = 'Could not find "Alle Exemplare" link on this page.';
      AlmaLogger.warn(msg);
      throw new Error(msg);
    }

    AlmaDomUtils.highlight(link, '#fff3cd');
    AlmaDomUtils.simulateClick(link);
    AlmaLogger.success('Clicked "Alle Exemplare". Waiting for Exemplar list to load...');
  }

  /**
   * On "Liste der Exemplare" page:
   * 1. Finds highlighted exemplar row
   * 2. Opens "..." (Weitere Aktionen)
   * 3. Clicks "Bearbeiten"
   */
  static async openHighlightedExemplarEditor() {
    AlmaLogger.info('Locating highlighted exemplar row...');
    const row = AlmaSelectors.getHighlightedExemplarRow();

    if (!row) {
      const msg = 'No highlighted or matching row found in Exemplar table.';
      AlmaLogger.warn(msg);
      throw new Error(msg);
    }

    AlmaDomUtils.highlight(row, '#e3f2fd', '2px solid #2196f3');
    AlmaLogger.info('Found exemplar row. Clicking actions button ("...")...');

    const actionsBtn = AlmaSelectors.getRowActionsButton(row);
    if (!actionsBtn) {
      const msg = 'Could not find "..." actions button in highlighted row.';
      AlmaLogger.warn(msg);
      throw new Error(msg);
    }

    AlmaDomUtils.simulateClick(actionsBtn);
    await AlmaDomUtils.sleep(300);

    // Wait for dropdown to reveal "Bearbeiten"
    const bearbeitenItem = await AlmaDomUtils.waitForElement(
      () => AlmaSelectors.getBearbeitenMenuItem(),
      3000,
      100
    ).catch(() => null);

    if (!bearbeitenItem) {
      const msg = 'Could not find "Bearbeiten" menu item in actions dropdown.';
      AlmaLogger.error(msg);
      throw new Error(msg);
    }

    AlmaDomUtils.highlight(bearbeitenItem, '#d4edda');
    AlmaDomUtils.simulateClick(bearbeitenItem);
    AlmaLogger.success('Clicked "Bearbeiten". Waiting for Physical Item Editor to load...');
  }
}

if (typeof window !== 'undefined') {
  window.AlmaNavigationHandler = AlmaNavigationHandler;
}
