/**
 * Secure Activity Logger
 * Prevents information leakage while providing useful debugging information
 */

import logger from '../services/logger';
import { getActivityConfig } from '../config/activityConfig';

/**
 * Sanitizes event data to remove sensitive information
 * @param {Object} eventData - Raw event data
 * @returns {Object} Sanitized event data
 */
function sanitizeEventData(eventData) {
  if (!eventData || typeof eventData !== 'object') {
    return {};
  }

  const sanitized = {};
  
  // Safe properties that can be logged
  const safeProperties = [
    'type', 'timestamp', 'category', 'component', 
    'method', 'status', 'fromPath', 'toPath',
    'throttleMs', 'isAuthenticated'
  ];

  safeProperties.forEach(prop => {
    if (eventData.hasOwnProperty(prop)) {
      sanitized[prop] = eventData[prop];
    }
  });

  // Add safe metadata
  sanitized.timestamp = sanitized.timestamp || new Date().toISOString();
  
  return sanitized;
}

/**
 * Sanitizes error information to prevent sensitive data leakage
 * @param {Error} error - Error object
 * @returns {Object} Sanitized error information
 */
function sanitizeError(error) {
  if (!error) return {};

  return {
    message: error.message || 'Unknown error',
    name: error.name || 'Error',
    type: typeof error,
    timestamp: new Date().toISOString()
    // Deliberately excluding stack trace and other potentially sensitive data
  };
}

/**
 * Secure Activity Logger Class
 */
class SecureActivityLogger {
  constructor() {
    this.config = getActivityConfig();
    this.logCount = 0;
    this.errorCount = 0;
    this.lastLogTime = 0;
    
    // Rate limiting to prevent log spam
    this.maxLogsPerMinute = 60;
    this.logTimestamps = [];
  }

  /**
   * Checks if logging should be rate limited
   * @returns {boolean} True if rate limit exceeded
   */
  isRateLimited() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old timestamps
    this.logTimestamps = this.logTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    
    if (this.logTimestamps.length >= this.maxLogsPerMinute) {
      return true;
    }
    
    this.logTimestamps.push(now);
    return false;
  }

  /**
   * Logs activity tracking initialization
   * @param {Object} initData - Initialization data
   */
  logActivityInit(initData = {}) {
    if (!this.config.LOG_ACTIVITY_DETAILS || this.isRateLimited()) {
      return;
    }

    const sanitized = sanitizeEventData({
      category: 'activity_tracking',
      action: 'initialized',
      component: initData.component || 'unknown',
      timestamp: new Date().toISOString(),
      ...initData
    });

    logger.debug('Activity tracking initialized', sanitized);
    this.logCount++;
  }

  /**
   * Logs activity detection (throttled)
   * @param {Object} activityData - Activity data
   */
  logActivityDetected(activityData = {}) {
    if (!this.config.LOG_ACTIVITY_DETAILS || this.isRateLimited()) {
      return;
    }

    const sanitized = sanitizeEventData({
      category: 'activity_tracking',
      action: 'activity_detected',
      timestamp: new Date().toISOString(),
      ...activityData
    });

    logger.debug('User activity detected', sanitized);
    this.logCount++;
  }

  /**
   * Logs activity tracking cleanup
   * @param {Object} cleanupData - Cleanup data
   */
  logActivityCleanup(cleanupData = {}) {
    if (!this.config.LOG_ACTIVITY_DETAILS || this.isRateLimited()) {
      return;
    }

    const sanitized = sanitizeEventData({
      category: 'activity_tracking',
      action: 'cleanup',
      timestamp: new Date().toISOString(),
      ...cleanupData
    });

    logger.debug('Activity tracking cleaned up', sanitized);
    this.logCount++;
  }

  /**
   * Logs activity tracking errors without exposing sensitive data
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  logActivityError(error, context = {}) {
    if (this.isRateLimited()) {
      return;
    }

    const sanitizedError = sanitizeError(error);
    const sanitizedContext = sanitizeEventData({
      category: 'activity_tracking_error',
      timestamp: new Date().toISOString(),
      ...context
    });

    // Always log errors regardless of LOG_ACTIVITY_DETAILS setting
    logger.error('Activity tracking error', {
      ...sanitizedError,
      ...sanitizedContext,
      errorCount: ++this.errorCount
    });
  }

  /**
   * Logs performance metrics for activity tracking
   * @param {Object} metrics - Performance metrics
   */
  logPerformanceMetrics(metrics = {}) {
    if (!this.config.LOG_ACTIVITY_DETAILS || this.isRateLimited()) {
      return;
    }

    const sanitized = sanitizeEventData({
      category: 'activity_tracking_performance',
      timestamp: new Date().toISOString(),
      totalLogs: this.logCount,
      totalErrors: this.errorCount,
      ...metrics
    });

    logger.debug('Activity tracking performance', sanitized);
  }

  /**
   * Logs session timeout related events
   * @param {Object} sessionData - Session data
   */
  logSessionEvent(sessionData = {}) {
    // Session events are always logged (security relevant)
    const sanitized = sanitizeEventData({
      category: 'session_management',
      timestamp: new Date().toISOString(),
      ...sessionData
    });

    logger.debug('Session event', sanitized);
  }

  /**
   * Gets logger statistics (for debugging)
   * @returns {Object} Logger statistics
   */
  getStats() {
    return {
      logCount: this.logCount,
      errorCount: this.errorCount,
      lastLogTime: this.lastLogTime,
      rateLimit: {
        maxLogsPerMinute: this.maxLogsPerMinute,
        currentLogCount: this.logTimestamps.length
      },
      config: {
        logActivityDetails: this.config.LOG_ACTIVITY_DETAILS,
        logSensitiveData: this.config.LOG_SENSITIVE_DATA
      }
    };
  }

  /**
   * Resets logger statistics
   */
  resetStats() {
    this.logCount = 0;
    this.errorCount = 0;
    this.logTimestamps = [];
    this.lastLogTime = 0;
  }
}

// Create singleton instance
const secureActivityLogger = new SecureActivityLogger();

// Export both the class and singleton instance
export { SecureActivityLogger };
export default secureActivityLogger;