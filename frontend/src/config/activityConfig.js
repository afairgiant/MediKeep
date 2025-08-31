/**
 * Activity Tracking Configuration
 * Centralized configuration for session timeout and activity tracking
 */
import logger from '../services/logger';


/**
 * Session and Activity Configuration
 * All values in milliseconds for consistency
 */
export const ACTIVITY_CONFIG = {
  // Session timeout settings
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes - main session timeout
  SESSION_CHECK_INTERVAL: 60 * 1000, // 1 minute - how often to check for timeout
  
  // Activity tracking throttle intervals
  // These should be significantly less than SESSION_TIMEOUT to ensure proper tracking
  UI_ACTIVITY_THROTTLE: 15 * 1000, // 15 seconds for UI events (mouse, keyboard, etc.)
  API_ACTIVITY_THROTTLE: 10 * 1000, // 10 seconds for API calls
  NAVIGATION_ACTIVITY_THROTTLE: 5 * 1000, // 5 seconds for navigation events
  
  // Error handling and retry settings
  MAX_ACTIVITY_UPDATE_RETRIES: 3,
  ACTIVITY_UPDATE_RETRY_DELAY: 1000, // 1 second
  
  // Performance settings
  EVENT_LISTENER_OPTIONS: {
    passive: true,
    capture: true
  },
  
  // Security settings
  LOG_SENSITIVE_DATA: false,
  LOG_ACTIVITY_DETAILS: process.env.NODE_ENV === 'development',
  
  // Event types to track
  TRACKED_EVENTS: {
    MOUSE: ['click', 'mousedown'],
    MOUSE_MOVE: ['mousemove'],
    KEYBOARD: ['keydown', 'keypress'],
    TOUCH: ['touchstart', 'touchmove', 'touchend'],
    SCROLL: ['scroll', 'wheel'],
    FOCUS: ['focus', 'blur']
  },
  
  // Elements to ignore for activity tracking
  IGNORED_SELECTORS: [
    '.login-form',
    '.logout-button',
    '.activity-tracker-ignore',
    '[data-activity-ignore="true"]'
  ]
};

/**
 * Validation helpers
 */
export const validateActivityConfig = () => {
  const config = ACTIVITY_CONFIG;
  
  // Ensure throttle intervals are reasonable compared to session timeout
  const maxThrottle = Math.max(
    config.UI_ACTIVITY_THROTTLE,
    config.API_ACTIVITY_THROTTLE,
    config.NAVIGATION_ACTIVITY_THROTTLE
  );
  
  if (maxThrottle >= config.SESSION_TIMEOUT / 2) {
    logger.warn('Activity throttle intervals may be too large compared to session timeout');
  }
  
  // Ensure session check interval is reasonable
  if (config.SESSION_CHECK_INTERVAL >= config.SESSION_TIMEOUT / 3) {
    logger.warn('Session check interval may be too large for effective timeout detection');
  }
  
  return true;
};

/**
 * Get environment-specific configuration overrides
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV;
  
  const overrides = {
    test: {
      UI_ACTIVITY_THROTTLE: 100, // Faster for tests
      API_ACTIVITY_THROTTLE: 100,
      NAVIGATION_ACTIVITY_THROTTLE: 50,
      LOG_ACTIVITY_DETAILS: false,
      MAX_ACTIVITY_UPDATE_RETRIES: 1
    },
    development: {
      LOG_ACTIVITY_DETAILS: true
    },
    production: {
      LOG_ACTIVITY_DETAILS: false,
      LOG_SENSITIVE_DATA: false
    }
  };
  
  return overrides[env] || {};
};

/**
 * Get final configuration with environment overrides applied
 */
export const getActivityConfig = () => {
  const baseConfig = ACTIVITY_CONFIG;
  const envOverrides = getEnvironmentConfig();
  
  const finalConfig = {
    ...baseConfig,
    ...envOverrides
  };
  
  // Validate the final configuration
  if (process.env.NODE_ENV !== 'test') {
    validateActivityConfig();
  }
  
  return finalConfig;
};

export default ACTIVITY_CONFIG;