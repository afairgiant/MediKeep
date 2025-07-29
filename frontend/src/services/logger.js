/**
 * Simplified Frontend Logger for Medical Records System
 *
 * Streamlined logging with focus on reliability and simplicity
 */

class Logger {
  constructor() {
    this.baseURL =
      process.env.REACT_APP_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? '/api/v1'
        : 'http://localhost:8000/api/v1');
    this.sessionId = this.generateSessionId();
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.setupNetworkListener();
    this.setupGlobalHandlers();
  }

  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomUUID()}`;
  }

  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  setupGlobalHandlers() {
    // JavaScript errors
    window.addEventListener('error', event => {
      this.error('JavaScript Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: 'javascript_error',
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        type: 'unhandled_promise_rejection',
      });
    });
  }

  // Core logging method
  log(level, message, data = {}) {
    const logEntry = {
      level,
      message,
      category: data.category || 'app',
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      url: window.location.href,
      user_agent: navigator.userAgent,
      ...data,
    };

    // Always console log for immediate feedback
    const consoleMethod =
      level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, data);

    // Send to backend if online
    if (this.isOnline) {
      this.sendToBackend(logEntry);
    } else {
      this.queue.push(logEntry);
    }
  }

  // Convenience methods
  info(message, data = {}) {
    this.log('info', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }

  // Specialized logging methods
  apiError(error, endpoint, method = 'GET') {
    this.error(`API Error: ${method} ${endpoint}`, {
      category: 'api_error',
      status: error.status,
      statusText: error.statusText,
      endpoint,
      method,
      stack: error.stack,
    });
  }

  userAction(action, component, data = {}) {
    this.info(`User Action: ${action}`, {
      category: 'user_action',
      action,
      component,
      ...data,
    });
  }

  async sendToBackend(logEntry) {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch(`${this.baseURL}/frontend-logs/log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      // Fail silently - don't create logging loops
      this.queue.push(logEntry);
    }
  }

  flushQueue() {
    if (this.queue.length > 0) {
      const queueCopy = [...this.queue];
      this.queue = [];

      queueCopy.forEach(entry => {
        this.sendToBackend(entry);
      });
    }
  }
}

// Create and export singleton
const logger = new Logger();
export default logger;
