/**
 * Frontend Error Logging Service for Medical Records Management System
 * 
 * This service provides comprehensive frontend error logging capabilities including:
 * - JavaScript error capture
 * - User interaction logging
 * - API error tracking
 * - Performance monitoring
 * - Integration with backend logging system
 */

class FrontendLogger {  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.patientId = null;
    this.errorQueue = [];
    this.isOnline = navigator.onLine;
    this.setupErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkMonitoring();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupErrorHandlers() {
    // Global error handler for uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason?.stack || String(event.reason),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
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
          this.logPerformance({
            type: 'page_load',
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            totalTime: perfData.loadEventEnd - perfData.fetchStart,
            url: window.location.href,
            timestamp: new Date().toISOString()
          });
        }
      }, 0);
    });
  }

  setupNetworkMonitoring() {
    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.logEvent({
        type: 'network_status',
        status: 'online',
        timestamp: new Date().toISOString()
      });
      this.flushErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.logEvent({
        type: 'network_status',
        status: 'offline',
        timestamp: new Date().toISOString()
      });
    });
  }

  setUserContext(userId, patientId = null) {
    this.userId = userId;
    this.patientId = patientId;
  }

  logError(errorData) {
    const enrichedError = {
      ...errorData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_error',
      severity: this.determineSeverity(errorData),
      context: this.getPageContext()
    };

    console.error('Frontend Error:', enrichedError);

    if (this.isOnline) {
      this.sendToBackend('error', enrichedError);
    } else {
      this.errorQueue.push(enrichedError);
    }
  }

  logAPIError(apiError, endpoint, method = 'GET') {
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
      context: this.getPageContext()
    };

    console.error('API Error:', errorData);
    this.sendToBackend('error', errorData);
  }

  logUserInteraction(action, element, additionalData = {}) {
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
      ...additionalData
    };

    // Only log significant interactions to avoid spam
    if (this.isSignificantInteraction(action)) {
      this.sendToBackend('interaction', interactionData);
    }
  }

  logPerformance(performanceData) {
    const enrichedPerformance = {
      ...performanceData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_performance',
      context: this.getPageContext()
    };

    console.log('Performance:', enrichedPerformance);
    this.sendToBackend('performance', enrichedPerformance);
  }

  logEvent(eventData) {
    const enrichedEvent = {
      ...eventData,
      sessionId: this.sessionId,
      userId: this.userId,
      patientId: this.patientId,
      category: 'frontend_event',
      context: this.getPageContext()
    };

    this.sendToBackend('event', enrichedEvent);
  }

  determineSeverity(errorData) {
    if (errorData.type === 'javascript_error') {
      if (errorData.message?.includes('TypeError') || errorData.message?.includes('ReferenceError')) {
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
      'login', 'logout', 'save', 'delete', 'create', 'update',
      'navigation', 'error_occurred', 'form_submission', 'file_upload'
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
        height: window.innerHeight      },
      screen: {
        width: window.screen.width,
        height: window.screen.height
      }
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
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  async sendToBackend(logType, data) {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
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
            error_message: data.message || data.error_message || 'Unknown error',
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
              sessionId: data.sessionId
            }
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
              context: data.context
            },
            user_id: data.userId || data.user_id,
            timestamp: data.timestamp || new Date().toISOString(),
            url: data.url || window.location.href
          };
          endpoint = 'user-action';
          break;

        case 'event':
        case 'performance':
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
              patientId: data.patientId
            }
          };
          endpoint = 'log';
          break;
      }

      const response = await fetch(`${this.baseURL}/frontend-logs/${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(transformedData)
      });

      if (!response.ok) {
        console.error('Failed to send log to backend:', response.status);
        // Don't create infinite loop by logging this error
      }
    } catch (error) {
      console.error('Error sending log to backend:', error);
      // Store in queue for retry
      this.errorQueue.push({ logType, data });
    }
  }

  flushErrorQueue() {
    if (this.errorQueue.length > 0 && this.isOnline) {
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
      this.logEvent({
        type: 'api_success',
        endpoint: endpoint,
        method: method,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      this.logAPIError(error, endpoint, method);
      throw error; // Re-throw to maintain original error handling
    }
  }

  // Method to be called by React Error Boundary
  logReactError(error, errorInfo) {
    this.logError({
      type: 'react_error',
      message: error.message,
      error: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }
}

// Create global instance
const frontendLogger = new FrontendLogger();

// Export for use in React components
export default frontendLogger;
