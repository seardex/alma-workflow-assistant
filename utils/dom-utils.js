/**
 * DOM interaction utilities tailored for complex enterprise Single Page Applications (Alma).
 */
class AlmaDomUtils {
  /**
   * Promisified sleep delay
   */
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Waits for an element to appear in DOM via polling / observer.
   * Target can be a CSS selector string or a finder function returning an HTMLElement.
   */
  static async waitForElement(finder, timeoutMs = 7000, intervalMs = 150) {
    const startTime = Date.now();

    const find = () => {
      if (typeof finder === 'function') {
        return finder();
      }
      return document.querySelector(finder);
    };

    let el = find();
    if (el) return el;

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        el = find();
        if (el) {
          clearInterval(interval);
          resolve(el);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for element: ${finder}`));
        }
      }, intervalMs);
    });
  }

  /**
   * Waits for a condition predicate function to return true via polling.
   */
  static async waitForCondition(predicate, timeoutMs = 7000, intervalMs = 150) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        if (predicate()) return true;
      } catch (_) {}
      await this.sleep(intervalMs);
    }
    return false;
  }

  /**
   * Temporarily suppresses Alma's jQuery UI datepicker popup via injected CSS and script dismissal.
   * Completely prevents the calendar popup from rendering on screen.
   */
  static suppressDatepicker(enable = true) {
    const styleId = 'alma-suppress-datepicker-style';
    let styleEl = document.getElementById(styleId);

    if (enable) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          #ui-datepicker-div, .ui-datepicker {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -9999 !important;
          }
        `;
        (document.head || document.documentElement).appendChild(styleEl);
      }

      // Hide and clear any existing datepicker element immediately
      const dp = document.getElementById('ui-datepicker-div') || document.querySelector('.ui-datepicker');
      if (dp) {
        dp.style.setProperty('display', 'none', 'important');
        dp.style.setProperty('visibility', 'hidden', 'important');
        try { dp.innerHTML = ''; } catch (_) {}
      }

      // Direct jQuery UI dismissal in main page world
      this.dismissPageDatepicker();
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  /**
   * Dismisses jQuery UI datepicker in the page context
   */
  static dismissPageDatepicker() {
    try {
      // 1. Firefox Xray-wrapper / global access
      const pageWin = window.wrappedJSObject || window;
      if (pageWin.jQuery && pageWin.jQuery.datepicker) {
        pageWin.jQuery.datepicker._hideDatepicker();
        pageWin.jQuery.datepicker._datepickerShowing = false;
        pageWin.jQuery.datepicker._curInst = null;
      }
    } catch (_) {}

    try {
      // 2. Main-world script execution as fallback
      const script = document.createElement('script');
      script.textContent = `
        try {
          if (window.jQuery && window.jQuery.datepicker) {
            window.jQuery.datepicker._hideDatepicker();
            window.jQuery.datepicker._datepickerShowing = false;
            window.jQuery.datepicker._curInst = null;
          }
          var dp = document.getElementById('ui-datepicker-div');
          if (dp) { dp.style.display = 'none'; }
        } catch (_) {}
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (_) {}
  }

  /**
   * Checks whether an input represents a date field by ID, name, attributes, classes, or value pattern.
   */
  static isDateInput(el, value = '') {
    if (!el) return false;
    if (value && /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(String(value).trim())) return true;
    const id = el.id || '';
    const name = el.name || '';
    const aria = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
    const title = el.getAttribute ? (el.getAttribute('title') || '') : '';
    const className = el.className || '';

    if (/date|datum/i.test(id)) return true;
    if (/date|datum/i.test(name)) return true;
    if (/date|datum/i.test(aria)) return true;
    if (/date|datum/i.test(title)) return true;
    if (className.includes('hasDatepicker') || className.includes('datepicker')) return true;
    if (el.parentElement?.querySelector('.ui-datepicker-trigger, [class*="datepicker"], [class*="calendar"], button[title*="Kalender" i], button[aria-label*="Kalender" i]')) return true;
    return false;
  }

  /**
   * Robustly sets input value for modern JS frameworks (Angular, Dojo, React).
   * Directly assigning element.value often fails to notify framework internal state.
   */
  static setInputValue(inputEl, value) {
    if (!inputEl) return false;

    // Route date fields to date-specific handler to avoid opening jQuery UI datepicker popup
    if (this.isDateInput(inputEl, value)) {
      return this.setDateInputValue(inputEl, value);
    }

    // Focus for text inputs
    try {
      inputEl.focus();
    } catch (_) {}

    // Use property descriptor to bypass prototype setter intercepts if present
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    // Dispatch standard browser events so Alma registers the update
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
    try {
      inputEl.blur();
    } catch (_) {}

    return true;
  }

  /**
   * Sets date inputs cleanly without triggering Alma's jQuery UI datepicker calendar popup.
   * Completely avoids inputEl.focus() to prevent the popup from opening and overriding the date.
   */
  static setDateInputValue(inputEl, value) {
    if (!inputEl) return false;

    // Suppress datepicker popups immediately
    this.suppressDatepicker(true);

    // 1. Set the value using native setter without focusing
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    // 2. Dispatch events so Alma registers the change
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    // 3. Blur to ensure no lingering focus remains
    try {
      inputEl.blur();
      if (document.activeElement === inputEl) {
        document.body.focus();
      }
    } catch (_) {}

    // 4. Dismiss datepicker via page script and hide div
    this.dismissPageDatepicker();

    return true;
  }

  /**
   * Clears an input element and dispatches change events
   */
  static clearInputValue(inputEl) {
    return this.setInputValue(inputEl, '');
  }

  /**
   * Click an element simulating realistic mouse events
   */
  /**
   * Click an element simulating realistic mouse and pointer events
   */
  static simulateClick(el) {
    if (!el) return false;

    // If an inner element was passed (e.g. span inside a tab/button), also target clickable parent
    const clickable = el.closest('button, a, [role="tab"], [role="button"], input[type="button"], input[type="submit"], li') || el;

    clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const eventInit = { bubbles: true, cancelable: true, view: window };
    
    // Dispatch pointer events for modern UI libraries
    if (typeof PointerEvent !== 'undefined') {
      clickable.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      clickable.dispatchEvent(new PointerEvent('pointerup', eventInit));
    }

    clickable.dispatchEvent(new MouseEvent('mousedown', eventInit));
    clickable.dispatchEvent(new MouseEvent('mouseup', eventInit));
    clickable.click();

    // If target was a child, also click it directly as fallback
    if (clickable !== el) {
      try { el.click(); } catch (_) {}
    }

    return true;
  }

  /**
   * Highlights an element on the screen so the user can easily see what was inspected or changed.
   */
  static highlight(el, color = '#d4edda', border = '2px solid #28a745', persist = false) {
    if (!el) return;
    const originalBg = el.style.backgroundColor;
    const originalBorder = el.style.border;
    const originalTransition = el.style.transition;

    el.style.transition = 'all 0.3s ease';
    el.style.backgroundColor = color;
    el.style.border = border;

    if (!persist) {
      setTimeout(() => {
        el.style.backgroundColor = originalBg;
        el.style.border = originalBorder;
        el.style.transition = originalTransition;
      }, 2500);
    }
  }

  /**
   * Simulates Alma native keyboard shortcuts (e.g. Alt+1, Alt+3, Alt+S)
   */
  static simulateShortcut(key, altKey = true, ctrlKey = false, shiftKey = false) {
    const isDigit = /^[0-9]$/.test(key);
    const code = isDigit ? `Digit${key}` : `Key${key.toUpperCase()}`;
    const keyCode = isDigit ? (48 + parseInt(key, 10)) : key.toUpperCase().charCodeAt(0);

    const eventOptions = {
      key: key,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      altKey: altKey,
      ctrlKey: ctrlKey,
      shiftKey: shiftKey,
      bubbles: true,
      cancelable: true
    };

    const target = document.activeElement || document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    target.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
    target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
  }

  /**
   * Checks whether an element is visible in the DOM (works even inside fixed/flex containers).
   */
  static isElementVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    } catch (_) {
      return false;
    }
  }

  /**
   * Robustly extracts current text/value from any input, select, textarea, or widget container.
   */
  static getElementValue(el) {
    if (!el) return '';
    // Select dropdown
    if (el.tagName === 'SELECT') {
      const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      const optText = opt ? (opt.text || opt.textContent || '') : '';
      return `${el.value || ''} ${optText}`.trim();
    }
    // Standard input or textarea
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      return (el.value !== undefined ? el.value : (el.getAttribute('value') || '')).trim();
    }
    // Check if element is a wrapper around an input (e.g. Dojo, Angular or custom Alma wrapper)
    const innerInput = el.querySelector('input:not([type="hidden"]), textarea, select');
    if (innerInput) {
      return this.getElementValue(innerInput);
    }
    return (el.textContent || el.innerText || '').trim();
  }

  /**
   * Matches keyword (e.g. "retro") against text across any variation:
   * e.g. "*RETRO*", "*retro*", "RETRO", "retro", "* RETRO *", "**RETRO**",
   * "[RETRO]", "_RETRO_", or embedded inside phrases.
   * Completely safe against Regex crashes when keyword contains wildcard stars.
   */
  static matchesKeyword(value, keyword = 'retro') {
    if (!value) return false;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return false;

    // Extract core keyword without surrounding asterisks, quotes, brackets, or spaces
    const cleanKw = String(keyword || 'retro')
      .replace(/^[\s*"'`~_#[\]()]+|[\s*"'`~_#[\]()]+$/g, '')
      .trim()
      .toLowerCase() || 'retro';

    // 1. Direct case-insensitive substring match (e.g. "*RETRO*", "retro", "altes *RETRO* vorhanden")
    if (raw.includes(cleanKw)) {
      return true;
    }

    // 2. Match with punctuation and whitespace stripped (e.g. "* R E T R O *", "*_RETRO_*", "**retro**")
    const collapsed = raw.replace(/[\s*_~#\-[\]()]/g, '');
    if (collapsed.includes(cleanKw)) {
      return true;
    }

    // 3. Regex with flexible wrappers (asterisks, spaces, brackets, or word boundaries)
    try {
      const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:\\*+|\\b|\\s|_|\\[|\\()${escaped}(?:\\*+|\\b|\\s|_|\\]|\\)|$)`, 'i');
      if (pattern.test(raw)) {
        return true;
      }
    } catch (_) {}

    // 4. Exact raw match fallback if user entered custom keyword with symbols
    if (keyword && raw.includes(String(keyword).trim().toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Finds an element by traversing text contents of specific tags
   */
  static findElementByText(selector, textPattern, root = document) {
    const elements = Array.from(root.querySelectorAll(selector));
    const regex = textPattern instanceof RegExp ? textPattern : new RegExp(textPattern, 'i');
    return elements.find((el) => {
      const text = el.textContent || el.innerText || '';
      return regex.test(text.trim());
    });
  }

  /**
   * Finds an input/select/textarea associated with a nearby label containing the search text.
   * Tailored for Ex Libris Alma DOM (Dojo widgets, AngularJS forms, Alma tables/grids).
   */
  static findInputByLabel(labelText, root = document) {
    const regex = labelText instanceof RegExp ? labelText : new RegExp(labelText, 'i');

    const labels = Array.from(root.querySelectorAll('label, div, span, th, td, p'));
    for (const label of labels) {
      const text = (label.textContent || '').trim();
      // Only match if the element's direct text matches reasonably (avoid giant container matches)
      if (regex.test(text) && text.length < 75) {
        // Strategy A: 'for' attribute
        if (label.htmlFor) {
          const target = document.getElementById(label.htmlFor);
          if (target) {
            if (target.matches('input, textarea, select')) return target;
            const inner = target.querySelector('input:not([type="hidden"]), textarea, select');
            if (inner) return inner;
          }
        }

        // Strategy B: aria-labelledby / aria-owns / id match
        if (label.id) {
          const ariaTarget = root.querySelector(`[aria-labelledby*="${label.id}"], [aria-owns*="${label.id}"]`);
          if (ariaTarget) {
            if (ariaTarget.matches('input, textarea, select')) return ariaTarget;
            const inner = ariaTarget.querySelector('input:not([type="hidden"]), textarea, select');
            if (inner) return inner;
          }
        }

        // Strategy C: Direct child input
        const childInput = label.querySelector('input:not([type="hidden"]), textarea, select');
        if (childInput) return childInput;

        // Strategy D: Next sibling elements
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.matches('input:not([type="hidden"]), textarea, select')) return sibling;
          const inputInsideSibling = sibling.querySelector('input:not([type="hidden"]), textarea, select');
          if (inputInsideSibling) return inputInsideSibling;
          sibling = sibling.nextElementSibling;
        }

        // Strategy E: Parent's sibling (e.g. column 1 has label, column 2 has input)
        let parent = label.parentElement;
        if (parent && parent !== root && parent !== document.body) {
          let parentSibling = parent.nextElementSibling;
          while (parentSibling) {
            if (parentSibling.matches('input:not([type="hidden"]), textarea, select')) return parentSibling;
            const inputInside = parentSibling.querySelector('input:not([type="hidden"]), textarea, select');
            if (inputInside) return inputInside;
            parentSibling = parentSibling.nextElementSibling;
          }
        }

        // Strategy F: Ancestor row/form-group container
        let ancestor = label.parentElement;
        let depth = 0;
        while (ancestor && ancestor !== root && ancestor !== document.body && depth < 4) {
          const rowInputs = Array.from(
            ancestor.querySelectorAll('input:not([type="hidden"]), textarea, select')
          );
          if (rowInputs.length === 1) {
            return rowInputs[0];
          }
          if (rowInputs.length > 1) {
            // Find input that appears after the label in DOM order
            const afterLabel = rowInputs.find(inp => (label.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING));
            return afterLabel || rowInputs[0];
          }
          ancestor = ancestor.parentElement;
          depth++;
        }
      }
    }

    // Strategy G: Fallback by attributes (aria-label, title, placeholder, name, id)
    const allInputs = Array.from(root.querySelectorAll('input:not([type="hidden"]), textarea, select'));
    for (const inp of allInputs) {
      const aria = inp.getAttribute('aria-label') || '';
      const title = inp.getAttribute('title') || '';
      const placeholder = inp.getAttribute('placeholder') || '';
      const name = inp.getAttribute('name') || '';
      const id = inp.getAttribute('id') || '';

      if (regex.test(aria) || regex.test(title) || regex.test(placeholder) || regex.test(name) || regex.test(id)) {
        return inp;
      }
    }

    return null;
  }
}

if (typeof window !== 'undefined') {
  window.AlmaDomUtils = AlmaDomUtils;
}
