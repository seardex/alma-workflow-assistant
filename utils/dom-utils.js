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
   * Robustly sets input value for modern JS frameworks (Angular, Dojo, React).
   * Directly assigning element.value often fails to notify framework internal state.
   */
  static setInputValue(inputEl, value) {
    if (!inputEl) return false;

    // Focus first
    inputEl.focus();

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
  static simulateClick(el) {
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.click();
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
    const eventOptions = {
      key: key,
      code: `Key${key.toUpperCase()}`,
      keyCode: key.charCodeAt(0),
      which: key.charCodeAt(0),
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
   * Finds an input associated with a nearby label containing the search text.
   * Handles:
   * 1. <label for="xyz"> ... <input id="xyz">
   * 2. <label>Text <input></label>
   * 3. Table/grid rows or form groups containing text followed by input
   */
  static findInputByLabel(labelText, root = document) {
    const regex = labelText instanceof RegExp ? labelText : new RegExp(labelText, 'i');

    // 1. Direct label with 'for' attribute
    const labels = Array.from(root.querySelectorAll('label, div, span, th, td'));
    for (const label of labels) {
      const text = (label.textContent || '').trim();
      // Only match if the element's direct or shallow text matches, to avoid giant parent containers
      if (regex.test(text) && text.length < 60) {
        // If it's a label with 'for'
        if (label.htmlFor) {
          const input = document.getElementById(label.htmlFor);
          if (input) return input;
        }

        // Direct input child
        const childInput = label.querySelector('input:not([type="hidden"]), textarea');
        if (childInput) return childInput;

        // Next sibling element input
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.tagName === 'INPUT' || sibling.tagName === 'TEXTAREA') return sibling;
          const inputInsideSibling = sibling.querySelector('input:not([type="hidden"]), textarea');
          if (inputInsideSibling) return inputInsideSibling;
          sibling = sibling.nextElementSibling;
        }

        // Parent container search (e.g., .form-group or Alma grid row)
        const parentGroup = label.closest('.form-group, tr, .row, [class*="form-row"], [class*="field"]');
        if (parentGroup) {
          const input = parentGroup.querySelector('input:not([type="hidden"]), textarea');
          if (input) return input;
        }
      }
    }

    // 2. Fallback: Search by placeholder, title, or aria-label
    const inputs = Array.from(root.querySelectorAll('input:not([type="hidden"]), textarea'));
    for (const inp of inputs) {
      const aria = inp.getAttribute('aria-label') || '';
      const title = inp.getAttribute('title') || '';
      const placeholder = inp.getAttribute('placeholder') || '';
      const name = inp.getAttribute('name') || '';

      if (regex.test(aria) || regex.test(title) || regex.test(placeholder) || regex.test(name)) {
        return inp;
      }
    }

    return null;
  }
}

if (typeof window !== 'undefined') {
  window.AlmaDomUtils = AlmaDomUtils;
}
