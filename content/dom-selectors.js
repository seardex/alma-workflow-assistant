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
    const regex = new RegExp(`^\\s*${tabName}\\b`, 'i');
    
    // Look for tab elements, buttons, links
    const candidates = Array.from(document.querySelectorAll(
      'button, a, [role="tab"], .tab, .nav-link, span'
    ));

    return candidates.find(el => {
      const text = (el.textContent || '').trim();
      return regex.test(text) && text.length < 35;
    });
  }

  static getAllgemeinTab() {
    return this.findTab('Allgemein');
  }

  static getNotizenTab() {
    return this.findTab('Notizen');
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
   * Inventarnummer input field
   */
  static getInventarnummerInput() {
    // 1. Direct label or text heuristic
    return AlmaDomUtils.findInputByLabel(/Inventarnummer/i);
  }

  /**
   * Inventarisierungsdatum input field
   */
  static getInventarisierungsdatumInput() {
    return AlmaDomUtils.findInputByLabel(/Inventarisierungsdatum/i);
  }

  /**
   * Exemplarsignatur input field
   */
  static getExemplarsignaturInput() {
    return AlmaDomUtils.findInputByLabel(/Exemplarsignatur$/i) || 
           AlmaDomUtils.findInputByLabel(/Exemplarsignatur/i);
  }

  /**
   * Returns all input and textarea fields in the currently visible Notizen tab
   */
  static getNotizenInputFields() {
    // Search within active tab panel if exists, or all inputs matching the note sections
    const noteFieldLabels = [
      'Öffentliche Notiz',
      'Benutzungs-Notiz',
      'Interne Notiz 1',
      'Interne Notiz 2',
      'Interne Notiz 3',
      'Statistiknotiz 1',
      'Statistiknotiz 2',
      'Statistiknotiz 3'
    ];

    const fields = [];
    for (const label of noteFieldLabels) {
      const el = AlmaDomUtils.findInputByLabel(label);
      if (el && !fields.includes(el)) {
        fields.push({ label, element: el });
      }
    }

    // Fallback: If specific labeled fields weren't found, collect all text/textarea inputs in the view
    if (fields.length === 0) {
      const visibleInputs = Array.from(document.querySelectorAll(
        'input[type="text"]:not([readonly]), textarea:not([readonly])'
      )).filter(el => {
        // filter out hidden/collapsed elements
        return el.offsetParent !== null;
      });

      visibleInputs.forEach((el, index) => {
        fields.push({ label: `Field #${index + 1}`, element: el });
      });
    }

    return fields;
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
