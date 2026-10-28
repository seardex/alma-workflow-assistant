/**
 * Centralized logger with UI event dispatching for Alma Workflow Assistant.
 */
class AlmaLogger {
  static listeners = [];

  static log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { level, message, data, timestamp };

    const styleMap = {
      info: 'color: #0288d1; font-weight: bold;',
      success: 'color: #2e7d32; font-weight: bold;',
      warn: 'color: #ed6c02; font-weight: bold;',
      error: 'color: #d32f2f; font-weight: bold;'
    };

    console.log(
      `%c[Alma Assistant %s]%c ${message}`,
      styleMap[level] || 'color: #333;',
      level.toUpperCase(),
      data ? data : ''
    );

    // Notify listeners (such as the in-page HUD or popup)
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        console.error('Logger listener error', err);
      }
    });

    // Also dispatch custom DOM event for cross-component updates
    try {
      window.dispatchEvent(new CustomEvent('alma-assistant-log', { detail: entry }));
    } catch (_) {}
  }

  static info(msg, data) {
    this.log('info', msg, data);
  }

  static success(msg, data) {
    this.log('success', msg, data);
  }

  static warn(msg, data) {
    this.log('warn', msg, data);
  }

  static error(msg, data) {
    this.log('error', msg, data);
  }

  static addListener(callback) {
    this.listeners.push(callback);
  }

  static removeListener(callback) {
    this.listeners = this.listeners.filter((fn) => fn !== callback);
  }
}

if (typeof window !== 'undefined') {
  window.AlmaLogger = AlmaLogger;
}
