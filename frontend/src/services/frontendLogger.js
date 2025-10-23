/**
 * Frontend Error Logging Service for Medical Records Management System
 *   Frontend Logger Refactor Implementation
 *
 * This service provides comprehensive frontend error logging capabilities including:
 * - JavaScript error capture
 * - User interaction logging
 * - API error tracking
 * - Performance monitoring
 * - Integration with backend logging system
 * - Dynamic log level fetching and client-side filtering
 * - Dual output format (console + backend)
 * - Network resilience with caching and retry logic
 */
import { getApiUrl } from '../config/env';

class FrontendLogger {
  constructor() {
    this.baseURL = getApiUrl();
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.patientId = null;
    this.errorQueue = [];
    this.isOnline = navigator.onLine;

    //   Log level numeric mapping for filtering
    this.LOG_LEVELS = {
      DEBUG: 10,
      INFO: 20,
      WARNING: 30,
      ERROR: 40,
      CRITICAL: 50,
    };

    //   Log level management
    this.currentLogLevel = 'INFO'; // Default fallback
    this.logLevelConfig = null;
    this.logLevelNumeric = this.getLogLevelNumeric(this.currentLogLevel);
    this.logLevelCache = {
      level: null,
      timestamp: null,
      maxAge: 300000, // 5 minutes cache
    };

    this.setupErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkMonitoring();

    //   Initialize log level fetching
    this.initializeLogLevel();
  }

  generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `session_${Date.now()}_${crypto.randomUUID()}`;
    }
    
    // Secure fallback using crypto.getRandomValues()
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      return `session_${Date.now()}_${hex}`;
    }
    
    throw new Error('Crypto API not available - cannot generate secure session ID');
  }

  //   Initialize log level from backend
  async initializeLogLevel() {
    try {
      await this.fetchLogLevel();
      this.logDebug(
        'Frontend logger initialized with backend log level configuration'
      );
    } catch (error) {
      this.logWarning(
        'Failed to initialize log level from backend, using default INFO',
        {
          error: error.message,
        }
      );
    }
  }

  //   Fetch log level configuration from backend
  async fetchLogLevel() {
    try {
      // Check cache first
      if (this.isLogLevelCacheValid()) {
        this.currentLogLevel = this.logLevelCache.level;
        this.logLevelNumeric = this.getLogLevelNumeric(this.currentLogLevel);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${this.baseURL}/system/log-level`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const config = await response.json();
        this.logLevelConfig = config;
        this.currentLogLevel = config.current_level || 'INFO';
        this.logLevelNumeric = this.getLogLevelNumeric(this.currentLogLevel);

        // Cache successful fetch
        this.logLevelCache = {
          level: this.currentLogLevel,
          timestamp: Date.now(),
          maxAge: 300000, // 5 minutes
        };

        // Store in localStorage as backup
        localStorage.setItem('lastLogLevel', this.currentLogLevel);
        localStorage.setItem('lastLogLevelTimestamp', Date.now().toString());

        this.logDebug('Log level fetched from backend', {
          level: this.currentLogLevel,
          configuration: config.configuration,
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Graceful fallback with cached data
      const cachedLevel = localStorage.getItem('lastLogLevel');
      const cachedTimestamp = localStorage.getItem('lastLogLevelTimestamp');

      if (cachedLevel && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age < 3600000) {
          // Use cache if less than 1 hour old
          this.currentLogLevel = cachedLevel;
          this.logLevelNumeric = this.getLogLevelNumeric(this.currentLogLevel);
          this.logInfo('Using cached log level due to fetch failure', {
            level: cachedLevel,
            cacheAge: Math.round(age / 1000) + 's',
          });
          return;
        }
      }

      // Final fallback to INFO
      this.currentLogLevel = 'INFO';
      this.logLevelNumeric = this.getLogLevelNumeric(this.currentLogLevel);

      this.logWarning('Log level fetch failed, using default INFO', {
        error: error.message,
        timeout: error.name === 'AbortError',
      });
    }
  }

  //   Check if log level cache is still valid
  isLogLevelCacheValid() {
    if (!this.logLevelCache.level || !this.logLevelCache.timestamp) {
      return false;
    }

    const age = Date.now() - this.logLevelCache.timestamp;
    return age < this.logLevelCache.maxAge;
  }

  //   Get numeric value for log level
  getLogLevelNumeric(level) {
    return this.LOG_LEVELS[level?.toUpperCase()] || this.LOG_LEVELS.INFO;
  }

  //   Check if message should be logged based on current log level
  shouldLog(level) {
    const messageLevel = this.getLogLevelNumeric(level);
    return messageLevel >= this.logLevelNumeric;
  }

  //   Dual output logging methods
  logDebug(message, additionalData = {}) {
    this.log('DEBUG', message, additionalData);
  }

  logInfo(message, additionalData = {}) {
    this.log('INFO', message, additionalData);
  }

  logWarning(message, additionalData = {}) {
    this.log('WARNING', message, additionalData);
  }

  logError(message, additionalData = {}) {
    this.log('ERROR', message, additionalData);
  }

  logCritical(message, additionalData = {}) {
    this.log('CRITICAL', message, additionalData);
  }

  //   Unified logging method with dual output
  log(level, message, additionalData = {}) {
    // Client-side filtering based on backend log level
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logData = {
      level,
      message,
      timestamp,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: 'frontend',
      ...additionalData,
    };

    // Dual output format
    this.outputToConsole(level, message, logData);
    this.sendToBackend('log', logData);
  }

  //   Readable console output for browser developer tools
  outputToConsole(level, message, logData) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] ${level}`;
    const fullMessage = `${prefix} ${message}`;

    // Use appropriate console method based on level
    switch (level) {
      case 'DEBUG':
    // eslint-disable-next-line no-console
        console.debug(fullMessage, logData);
        break;
      case 'INFO':
    // eslint-disable-next-line no-console
        console.info(fullMessage, logData);
        break;
      case 'WARNING':
    // eslint-disable-next-line no-console
        console.warn(fullMessage, logData);
        break;
      case 'ERROR':
      case 'CRITICAL':
    // eslint-disable-next-line no-console
        console.error(fullMessage, logData);
        break;
      default:
    // eslint-disable-next-line no-console
        console.log(fullMessage, logData);
    }
  }

  // Enhanced error logging with Phase 5 filtering
  logJavaScriptError(errorData) {
    if (!this.shouldLog('ERROR')) {
      return;
    }

    const enrichedError = {
      ...errorData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_error',
      severity: this.determineSeverity(errorData),
      context: this.getPageContext(),
    };

    // Dual output
    this.outputToConsole(
      'ERROR',
      `JavaScript Error: ${errorData.message}`,
      enrichedError
    );

    if (this.isOnline) {
      this.sendToBackend('error', enrichedError);
    } else {
      this.errorQueue.push(enrichedError);
    }
  }

  setupErrorHandlers() {
    // Global error handler for uncaught JavaScript errors
    window.addEventListener('error', event => {
      this.logJavaScriptError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.logJavaScriptError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason?.stack || String(event.reason),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // React error boundary integration
    window.frontendLogger = this;
  }

  setupPerformanceMonitoring() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        if (perfData) {
          this.logInfo('Page load performance', {
            type: 'page_load',
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded:
              perfData.domContentLoadedEventEnd -
              perfData.domContentLoadedEventStart,
            totalTime: perfData.loadEventEnd - perfData.fetchStart,
          });
        }
      }, 0);
    });
  }

  setupNetworkMonitoring() {
    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.logInfo('Network status changed to online');
      this.flushErrorQueue();
      // Refresh log level when back online
      this.fetchLogLevel();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.logWarning('Network status changed to offline');
    });
  }

  setUserContext(userId, patientId = null) {
    this.userId = userId;
    this.patientId = patientId;
    this.logDebug('User context updated', { userId, patientId });
  }

  logAPIError(apiError, endpoint, method = 'GET') {
    if (!this.shouldLog('ERROR')) {
      return;
    }

    const errorData = {
      type: 'api_error',
      message: apiError.message,
      endpoint: endpoint,
      method: method,
      status: apiError.status,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_api_error',
      severity: this.determineAPISeverity(apiError.status),
      context: this.getPageContext(),
    };

    this.outputToConsole(
      'ERROR',
      `API Error: ${method} ${endpoint}`,
      errorData
    );
    this.sendToBackend('error', errorData);
  }

  logUserInteraction(action, element, additionalData = {}) {
    if (!this.shouldLog('INFO')) {
      return;
    }

    const interactionData = {
      type: 'user_interaction',
      action: action,
      element: element,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_interaction',
      context: this.getPageContext(),
      ...additionalData,
    };

    // Only log significant interactions to avoid spam
    if (this.isSignificantInteraction(action)) {
      this.logInfo(`User interaction: ${action}`, interactionData);
    }
  }

  logPerformance(performanceData) {
    if (!this.shouldLog('INFO')) {
      return;
    }

    const enrichedPerformance = {
      ...performanceData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_performance',
      context: this.getPageContext(),
    };

    this.outputToConsole(
      'INFO',
      `Performance: ${performanceData.type}`,
      enrichedPerformance
    );
    this.sendToBackend('performance', enrichedPerformance);
  }

  logEvent(eventData) {
    if (!this.shouldLog('INFO')) {
      return;
    }

    const enrichedEvent = {
      ...eventData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_event',
      context: this.getPageContext(),
    };

    this.outputToConsole('INFO', `Event: ${eventData.type}`, enrichedEvent);
    this.sendToBackend('event', enrichedEvent);
  }

  //   Refresh log level configuration
  async refreshLogLevel() {
    try {
      // Clear cache to force fresh fetch
      this.logLevelCache.timestamp = null;
      await this.fetchLogLevel();
      this.logDebug('Log level configuration refreshed');
    } catch (error) {
      this.logWarning('Failed to refresh log level configuration', {
        error: error.message,
      });
    }
  }

  //   Get current log level information
  getLogLevelInfo() {
    return {
      currentLevel: this.currentLogLevel,
      numericLevel: this.logLevelNumeric,
      configuration: this.logLevelConfig,
      cacheValid: this.isLogLevelCacheValid(),
    };
  }

  determineSeverity(errorData) {
    if (errorData.type === 'javascript_error') {
      if (
        errorData.message?.includes('TypeError') ||
        errorData.message?.includes('ReferenceError')
      ) {
        return 'high';
      }
      return 'medium';
    }
    if (errorData.type === 'unhandled_promise_rejection') {
      return 'high';
    }
    return 'low';
  }

  determineAPISeverity(status) {
    if (status >= 500) return 'high';
    if (status >= 400) return 'medium';
    return 'low';
  }

  isSignificantInteraction(action) {
    const significantActions = [
      'login',
      'logout',
      'save',
      'delete',
      'create',
      'update',
      'navigation',
      'error_occurred',
      'form_submission',
      'file_upload',
    ];
    return significantActions.includes(action);
  }

  getPageContext() {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
    };
  }

  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  async sendToBackend(logType, data) {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Transform data to match backend schema
      let transformedData;
      let endpoint;

      switch (logType) {
        case 'error':
          // Transform to FrontendErrorRequest schema
          transformedData = {
            error_message:
              data.message || data.error_message || 'Unknown error',
            error_type: data.type || data.error_type || 'frontend_error',
            stack_trace: data.stackTrace || data.stack_trace || data.stack,
            component_name: data.component || data.component_name,
            props: data.props || data.context,
            user_id: data.userId || data.user_id,
            url: data.url || window.location.href,
            timestamp: data.timestamp || new Date().toISOString(),
            user_agent: navigator.userAgent,
            browser_info: {
              ...this.getBrowserInfo(),
              severity: data.severity,
              category: data.category,
              sessionId: data.sessionId,
            },
          };
          endpoint = 'error';
          break;

        case 'interaction':
          // Transform to UserActionRequest schema
          transformedData = {
            action: data.action || data.type,
            component: data.component || data.element || 'unknown',
            details: {
              ...data,
              sessionId: data.sessionId,
              patientId: data.patientId,
              context: data.context,
            },
            user_id: data.userId || data.user_id,
            timestamp: data.timestamp || new Date().toISOString(),
            url: data.url || window.location.href,
          };
          endpoint = 'user-action';
          break;

        case 'event':
        case 'performance':
        case 'log':
        default:
          // Transform to FrontendLogRequest schema
          transformedData = {
            level: data.level || data.severity || 'info',
            message: data.message || data.type || 'Frontend event',
            category: data.category || logType,
            timestamp: data.timestamp || new Date().toISOString(),
            url: data.url || window.location.href,
            user_agent: navigator.userAgent,
            stack_trace: data.stackTrace || data.stack_trace,
            user_id: data.userId || data.user_id,
            session_id: data.sessionId || data.session_id,
            component: data.component,
            action: data.action || data.type,
            details: {
              ...data,
              context: data.context,
              patientId: data.patientId,
            },
          };
          endpoint = 'log';
          break;
      }

      const response = await fetch(
        `${this.baseURL}/frontend-logs/${endpoint}`,
        {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(transformedData),
        }
      );

      if (response.ok) {
        // Log successful backend transmission at debug level
        if (this.shouldLog('DEBUG')) {
    // eslint-disable-next-line no-console
          console.debug(
            `[${new Date().toLocaleTimeString()}] DEBUG Frontend Debug: ${logType} sent to backend`,
            {
              endpoint,
              status: response.status,
            }
          );
        }
      } else {
    // eslint-disable-next-line no-console
        console.error('Failed to send log to backend:', response.status);
        // Don't create infinite loop by logging this error
      }
    } catch (error) {
    // eslint-disable-next-line no-console
      console.error('Error sending log to backend:', error);
      // Store in queue for retry
      this.errorQueue.push({ logType, data });
    }
  }

  flushErrorQueue() {
    if (this.errorQueue.length > 0 && this.isOnline) {
      this.logInfo(`Flushing ${this.errorQueue.length} queued log entries`);

      const queueCopy = [...this.errorQueue];
      this.errorQueue = [];

      queueCopy.forEach(({ logType, data }) => {
        this.sendToBackend(logType, data);
      });
    }
  }

  // Enhanced API wrapper for automatic error logging
  async apiCall(apiFunction, endpoint, method = 'GET') {
    try {
      const result = await apiFunction();

      // Log successful API calls for audit trail
      this.logDebug(`API request successful: ${method} ${endpoint}`);

      return result;
    } catch (error) {
      this.logAPIError(error, endpoint, method);
      throw error; // Re-throw to maintain original error handling
    }
  }

  // Method to be called by React Error Boundary
  logReactError(error, errorInfo) {
    this.logJavaScriptError({
      type: 'react_error',
      message: error.message,
      error: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  }
}

// Create global instance
const frontendLogger = new FrontendLogger();

// Export for use in React components
export default frontendLogger;
