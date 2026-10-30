/**
 * DOM Selectors and Heuristic Resolvers for Ex Libris Alma UI.
 * Provides fallback layers: exact ID -> ARIA labels -> text content heuristics.
 */
class AlmaSelectors {
  /**
   * Identifies the current screen in Alma
   */
  static detectCurrentPage() {
    const text = document.body.innerText || '';

    if (text.includes('Editor für physische Exemplare')) {
      return 'PHYSICAL_ITEM_EDITOR';
    }
    if (text.includes('Liste der Exemplare')) {
      return 'EXEMPLAR_LIST';
    }
    if (text.includes('Alle Titel in der Institution') || text.includes('Suchergebnisse')) {
      return 'SEARCH_RESULTS';
    }

    return 'UNKNOWN';
  }

  // ==========================================
  // PHYSICAL ITEM EDITOR (Editor für physische Exemplare)
  // ==========================================

  /**
   * Find tab buttons (Allgemein = Alt+1, Notizen = Alt+3)
   */
  static findTab(tabName) {
    if (/Notizen/i.test(tabName)) {
      return this.getNotizenTab();
    }
    if (/Allgemein/i.test(tabName)) {
      return this.getAllgemeinTab();
    }

    const regex = new RegExp(`^\\s*${tabName}\\b`, 'i');
    const candidates = Array.from(document.querySelectorAll(
      'button, a, [role="tab"], .tab, .nav-link, span, li'
    ));

    const matched = candidates.find(el => {
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
      return regex.test(text) && text.length < 35;
    });

    if (!matched) return null;
    return matched.closest('button, a, [role="tab"], li') || matched;
  }

  /**
   * Exact Alma trigger for Notizen tab
   */
  static getNotizenTab() {
    return document.getElementById('cresource_editornotes') ||
           document.querySelector('#cresource_editornotes_span input[type="submit"]') ||
           document.getElementById('cresource_editornotes_span') ||
           document.getElementById('A_NAV_LINK_cresource_editornotes_span');
  }

  /**
   * Exact Alma trigger for Allgemein tab
   */
  static getAllgemeinTab() {
    return document.getElementById('cresource_editorgeneral') ||
           document.querySelector('#cresource_editorgeneral_span input[type="submit"]') ||
           document.getElementById('cresource_editorgeneral_span') ||
           document.getElementById('A_NAV_LINK_cresource_editorgeneral_span');
  }

  /**
   * Unambiguously identifies the active tab inside the Physical Item Editor
   */
  static detectCurrentEditorTab() {
    // 1. Page URL input indicator (highest reliability in Alma forms)
    const currentUrlInput = document.querySelector('input[name="pageBean.currentUrl"]');
    if (currentUrlInput && currentUrlInput.value) {
      if (currentUrlInput.value.includes('item_notes.xml')) return 'NOTIZEN';
      if (currentUrlInput.value.includes('item_general.xml')) return 'ALLGEMEIN';
    }

    // 2. Active tab indicator in Alma header
    const tabSpanNotes = document.getElementById('cresource_editornotes_span');
    if (tabSpanNotes && (tabSpanNotes.classList.contains('active') || tabSpanNotes.classList.contains('tabSelected') || tabSpanNotes.classList.contains('selected'))) {
      return 'NOTIZEN';
    }
    const tabSpanGeneral = document.getElementById('cresource_editorgeneral_span');
    if (tabSpanGeneral && (tabSpanGeneral.classList.contains('active') || tabSpanGeneral.classList.contains('tabSelected') || tabSpanGeneral.classList.contains('selected'))) {
      return 'ALLGEMEIN';
    }

    // 3. Tab navigation links with aria-selected
    const linkNotes = document.getElementById('A_NAV_LINK_cresource_editornotes_span');
    if (linkNotes && (linkNotes.getAttribute('aria-selected') === 'true' || linkNotes.classList.contains('active') || linkNotes.classList.contains('selected'))) {
      return 'NOTIZEN';
    }
    const linkGeneral = document.getElementById('A_NAV_LINK_cresource_editorgeneral_span');
    if (linkGeneral && (linkGeneral.getAttribute('aria-selected') === 'true' || linkGeneral.classList.contains('active') || linkGeneral.classList.contains('selected'))) {
      return 'ALLGEMEIN';
    }

    // 4. Form fields check: If Allgemein fields (Inventarnummer/Signatur) are present, it is Allgemein
    if (this.isAllgemeinTabReady()) {
      return 'ALLGEMEIN';
    }

    // 5. Note fields check
    if (document.getElementById('pageBeanitemMddnxphysicalItemTableinternalNote_1') ||
        document.getElementById('pageBeanitemMddnxphysicalItemTablepublicNote')) {
      return 'NOTIZEN';
    }

    return 'ALLGEMEIN';
  }

  /**
   * Checks whether the Notizen tab is currently active and rendered
   */
  static isNotizenTabActive() {
    return this.detectCurrentEditorTab() === 'NOTIZEN';
  }

  /**
   * Checks whether the Notizen tab is ready with its inputs actually present in the DOM
   */
  static isNotizenTabReady() {
    return this.isNotizenTabActive();
  }

  /**
   * Checks whether the Allgemein tab is currently active and rendered
   */
  static isAllgemeinTabActive() {
    return this.detectCurrentEditorTab() === 'ALLGEMEIN';
  }

  /**
   * Checks whether the Allgemein tab is ready with target inputs actually present in the DOM
   */
  static isAllgemeinTabReady() {
    const num = this.getInventarnummerInput();
    const date = this.getInventarisierungsdatumInput();
    const sig = this.getExemplarsignaturInput();
    return !!(num || date || sig);
  }

  /**
   * Checks whether the specified tab is currently active/selected
   */
  static isTabActive(tabName) {
    if (/Notizen/i.test(tabName)) return this.isNotizenTabActive();
    if (/Allgemein/i.test(tabName)) return this.isAllgemeinTabActive();
    return false;
  }

  /**
   * Save button ("Speichern", Alt+S)
   */
  static getSaveButton() {
    const candidates = Array.from(document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a'
    ));

    return candidates.find(el => {
      const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
      return /^Speichern$/i.test(text) || text.includes('Speichern (Alt + S)');
    });
  }

  /**
   * Inventarnummer input field (Excludes summary card at top of page)
   */
  static getInventarnummerInput() {
    // 1. Direct Alma ID in item_general.xml
    const byId = document.getElementById('pageBeanitemMddnxphysicalItemTableinventoryNumber') ||
                 document.querySelector('input[name="pageBean.itemMd.dnx.physicalItemTable.inventoryNumber"]') ||
                 document.querySelector('input[name*="inventoryNumber" i]');
    if (byId && !byId.closest('.summarySection, #itemContext')) return byId;

    // 2. Form panel search (strictly outside .summarySection)
    const formPanels = Array.from(document.querySelectorAll('.innerContainer form, form[name="pageBean"], div.panel:not(.summarySection)'));
    for (const panel of formPanels) {
      const inp = AlmaDomUtils.findInputByLabel(/Inventarnummer|^Inventory Number/i, panel);
      if (inp && !inp.closest('.summarySection, #itemContext')) return inp;
    }

    return null;
  }

  /**
   * Inventarisierungsdatum input field (Excludes summary card at top of page)
   */
  static getInventarisierungsdatumInput() {
    // 1. Direct Alma ID in item_general.xml
    const byId = document.getElementById('pageBeanitemMddnxphysicalItemTableinventoryDate') ||
                 document.querySelector('input[name="pageBean.itemMd.dnx.physicalItemTable.inventoryDate"]') ||
                 document.querySelector('input[name*="inventoryDate" i]') ||
                 document.querySelector('input[name*="accessionDate" i]');
    if (byId && !byId.closest('.summarySection, #itemContext')) return byId;

    // 2. Form panel search (strictly outside .summarySection)
    const formPanels = Array.from(document.querySelectorAll('.innerContainer form, form[name="pageBean"], div.panel:not(.summarySection)'));
    for (const panel of formPanels) {
      const inp = AlmaDomUtils.findInputByLabel(/Inventarisierungsdatum|Inventardatum|^Inventory Date/i, panel);
      if (inp && !inp.closest('.summarySection, #itemContext')) return inp;
    }

    // 3. Fallback row search: Find input near "Inventarisierungsdatum" label
    const allLabels = Array.from(document.querySelectorAll('label, span, div.control-label'));
    for (const lbl of allLabels) {
      const text = (lbl.textContent || '').trim();
      if (/Inventarisierungsdatum|Inventardatum/i.test(text) && text.length < 50) {
        const row = lbl.closest('.row, .col, .form-group, tr') || lbl.parentElement?.parentElement;
        if (row && !row.closest('.summarySection, #itemContext')) {
          const input = row.querySelector('input.hasDatepicker, input[type="text"]:not([readonly])');
          if (input && !input.closest('.summarySection, #itemContext')) return input;
        }
      }
    }

    return null;
  }

  /**
   * Exemplarsignatur input field (Excludes summary card at top of page)
   */
  static getExemplarsignaturInput() {
    // 1. Direct Alma IDs in item_general.xml
    const byId = document.getElementById('pageBeanitemMddnxphysicalItemTablealternativeCallNumber') ||
                 document.getElementById('pageBeanitemMddnxphysicalItemTablecallNumber') ||
                 document.querySelector('input[name*="alternativeCallNumber" i], input[name*="callNumber" i]');
    if (byId && !byId.closest('.summarySection, #itemContext')) return byId;

    // 2. Form panel search (strictly outside .summarySection)
    const formPanels = Array.from(document.querySelectorAll('.innerContainer form, form[name="pageBean"], div.panel:not(.summarySection)'));
    for (const panel of formPanels) {
      const inp = AlmaDomUtils.findInputByLabel(/Exemplarsignatur|^Call Number/i, panel);
      if (inp && !inp.closest('.summarySection, #itemContext')) return inp;
    }

    return null;
  }

  // ==========================================
  // EXEMPLAR LIST (Liste der Exemplare)
  // ==========================================

  /**
   * Finds the currently highlighted / targeted row in the "Liste der Exemplare" table
   */
  static getHighlightedExemplarRow() {
    // Alma highlights the searched item row with specific class or background color
    const rows = Array.from(document.querySelectorAll('tr, [role="row"], .table-row'));
    
    // Check for selected/highlighted class or inline style
    const highlighted = rows.find(r => {
      const cls = (r.className || '').toLowerCase();
      const style = (r.getAttribute('style') || '').toLowerCase();
      return cls.includes('selected') || 
             cls.includes('highlight') || 
             cls.includes('active') ||
             style.includes('background-color') ||
             r.querySelector('.selected, .highlighted, [aria-selected="true"]');
    });

    if (highlighted) return highlighted;

    // Fallback: Return the first row if only 1-2 rows exist
    const dataRows = rows.filter(r => r.querySelectorAll('td').length > 3);
    return dataRows.length > 0 ? dataRows[0] : null;
  }

  /**
   * Finds the "..." (Weitere Aktionen) button inside a row
   */
  static getRowActionsButton(rowElement) {
    if (!rowElement) return null;
    return rowElement.querySelector(
      'button[title*="Aktionen"], button[aria-label*="Aktionen"], button[title*="Actions"], button.more-actions, button.dropdown-toggle'
    ) || Array.from(rowElement.querySelectorAll('button, a')).find(el => {
      const txt = (el.textContent || el.title || el.getAttribute('aria-label') || '').trim();
      return txt === '...' || txt.includes('Aktionen');
    });
  }

  /**
   * Finds "Bearbeiten" inside an opened dropdown/action menu
   */
  static getBearbeitenMenuItem() {
    const items = Array.from(document.querySelectorAll(
      '[role="menuitem"], .dropdown-item, .popover a, .popover button, ul.dropdown-menu li, button, a'
    ));

    return items.find(el => {
      const text = (el.textContent || '').trim();
      return /^Bearbeiten$/i.test(text) || text.includes('Bearbeiten');
    });
  }

  // ==========================================
  // SEARCH RESULTS (Alle Titel in der Institution)
  // ==========================================

  /**
   * Finds "Alle Exemplare (X von Y verfügbar)" link
   */
  static getAlleExemplareLink() {
    const candidates = Array.from(document.querySelectorAll('a, button, span'));
    return candidates.find(el => {
      const text = (el.textContent || '').trim();
      return /Alle Exemplare\s*\(/i.test(text);
    });
  }
}

if (typeof window !== 'undefined') {
  window.AlmaSelectors = AlmaSelectors;
}
