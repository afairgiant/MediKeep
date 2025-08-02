import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getActivityConfig } from '../config/activityConfig';
import { 
  createActivityThrottle, 
  createThrottleCleanupManager,
  createRetryWrapper 
} from '../utils/throttleUtils';
import secureActivityLogger from '../utils/secureActivityLogger';

/**
 * Enhanced custom hook for tracking user activity to prevent premature session timeouts
 * 
 * Features:
 * - Comprehensive error handling and memory leak prevention
 * - Configurable throttling aligned with session timeout
 * - Race condition safe API activity tracking
 * - Secure logging without information leakage
 * - Performance optimized with proper cleanup
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.throttleMs - Override default throttle interval
 * @param {boolean} options.trackMouseMove - Whether to track mouse movements
 * @param {boolean} options.trackKeyboard - Whether to track keyboard input
 * @param {boolean} options.trackClicks - Whether to track mouse clicks
 * @param {boolean} options.trackTouch - Whether to track touch events
 * @param {boolean} options.enabled - Whether activity tracking is enabled
 */
export function useActivityTracker(options = {}) {
  const config = getActivityConfig();
  const {
    throttleMs = config.UI_ACTIVITY_THROTTLE,
    trackMouseMove = true,
    trackKeyboard = true,
    trackClicks = true,
    trackTouch = true,
    enabled = true,
  } = options;

  const { updateActivity, isAuthenticated } = useAuth();
  const activityListeners = useRef([]);
  const cleanupManager = useRef(null);
  const isComponentMounted = useRef(true);

  // Create a retry-wrapped updateActivity function
  const safeUpdateActivity = useMemo(() => {
    return createRetryWrapper(
      async () => {
        if (!isComponentMounted.current || !isAuthenticated) {
          return;
        }
        
        try {
          await updateActivity();
          secureActivityLogger.logActivityDetected({
            component: 'useActivityTracker',
            throttleMs
          });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'useActivityTracker',
            action: 'updateActivity'
          });
          throw error;
        }
      },
      config.MAX_ACTIVITY_UPDATE_RETRIES,
      config.ACTIVITY_UPDATE_RETRY_DELAY,
      'activity-update'
    );
  }, [updateActivity, isAuthenticated, throttleMs, config]);

  // Create throttled activity updater with proper error handling
  const throttledUpdateActivity = useMemo(() => {
    // Initialize cleanup manager inside useMemo to handle HMR properly
    if (!cleanupManager.current || cleanupManager.current.isDestroyed) {
      cleanupManager.current = createThrottleCleanupManager();
    }
    
    const throttledFunc = createActivityThrottle(
      safeUpdateActivity,
      throttleMs,
      'ui-activity'
    );

    try {
      cleanupManager.current.add(throttledFunc);
    } catch (error) {
      // Handle destroyed cleanup manager during HMR
      cleanupManager.current = createThrottleCleanupManager();
      cleanupManager.current.add(throttledFunc);
    }
    
    return throttledFunc;
  }, [safeUpdateActivity, throttleMs]);

  // Activity event handler with comprehensive safety checks
  const handleActivity = useCallback((event) => {
    try {
      // Safety checks
      if (!isComponentMounted.current || !isAuthenticated || !enabled) {
        return;
      }
      
      // Check if target element should be ignored
      if (event?.target) {
        const target = event.target;
        const shouldIgnore = config.IGNORED_SELECTORS.some(selector => {
          try {
            return target.closest && target.closest(selector);
          } catch (e) {
            return false;
          }
        });
        
        if (shouldIgnore) {
          return;
        }
      }
      
      // Throttled activity update with error handling
      if (throttledUpdateActivity && !throttledUpdateActivity.isDestroyed()) {
        throttledUpdateActivity();
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'useActivityTracker',
        action: 'handleActivity',
        eventType: event?.type
      });
    }
  }, [isAuthenticated, enabled, throttledUpdateActivity, config]);

  // Set up event listeners with comprehensive error handling and cleanup
  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return;
    }

    let addedListeners = [];
    
    try {
      const events = [];
      
      // Build event list based on configuration
      if (trackClicks) {
        events.push(...config.TRACKED_EVENTS.MOUSE);
      }
      if (trackMouseMove) {
        events.push(...config.TRACKED_EVENTS.MOUSE_MOVE);
      }
      if (trackKeyboard) {
        events.push(...config.TRACKED_EVENTS.KEYBOARD);
      }
      if (trackTouch) {
        events.push(...config.TRACKED_EVENTS.TOUCH);
      }
      
      // Always add scroll and focus events
      events.push(...config.TRACKED_EVENTS.SCROLL);
      events.push(...config.TRACKED_EVENTS.FOCUS);

      // Add event listeners with proper error handling
      events.forEach(eventType => {
        try {
          // Use different options based on event type to avoid interfering with navigation
          let options;
          if (eventType === 'mousemove' || eventType === 'scroll') {
            // Keep passive for performance-critical events
            options = config.EVENT_LISTENER_OPTIONS;
          } else if (eventType === 'click' || eventType === 'mousedown') {
            // Don't use capture for click events to avoid interfering with React Router
            options = { passive: true };
          } else {
            // Use capture for other events
            options = { capture: true };
          }
          
          document.addEventListener(eventType, handleActivity, options);
          addedListeners.push({ eventType, options });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'useActivityTracker',
            action: 'addEventListener',
            eventType
          });
        }
      });

      activityListeners.current = addedListeners;

      secureActivityLogger.logActivityInit({
        component: 'useActivityTracker',
        events: events.length,
        throttleMs,
        isAuthenticated,
        trackingOptions: {
          trackMouseMove,
          trackKeyboard,
          trackClicks,
          trackTouch
        }
      });

    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'useActivityTracker',
        action: 'setup'
      });
    }

    // Comprehensive cleanup function
    return () => {
      try {
        // Remove event listeners
        addedListeners.forEach(({ eventType, options }) => {
          try {
            document.removeEventListener(eventType, handleActivity, options);
          } catch (error) {
            secureActivityLogger.logActivityError(error, {
              component: 'useActivityTracker',
              action: 'removeEventListener',
              eventType
            });
          }
        });
        
        activityListeners.current = [];
        
        secureActivityLogger.logActivityCleanup({
          component: 'useActivityTracker',
          listenersRemoved: addedListeners.length
        });
        
      } catch (error) {
        secureActivityLogger.logActivityError(error, {
          component: 'useActivityTracker',
          action: 'cleanup'
        });
      }
    };
  }, [isAuthenticated, enabled, handleActivity, trackMouseMove, trackKeyboard, trackClicks, trackTouch, throttleMs, config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      if (cleanupManager.current) {
        cleanupManager.current.cleanupAll();
      }
    };
  }, []);

  // Return comprehensive tracking status and control functions
  return {
    isTracking: isAuthenticated && enabled && activityListeners.current.length > 0,
    isEnabled: enabled,
    manualTrigger: throttledUpdateActivity,
    getStats: () => ({
      listenersCount: activityListeners.current.length,
      throttleMs,
      lastUpdate: throttledUpdateActivity?.lastUpdate || 0,
      isPending: throttledUpdateActivity?.isPending() || false
    }),
    cleanup: () => {
      isComponentMounted.current = false;
      if (cleanupManager.current) {
        cleanupManager.current.cleanupAll();
      }
    }
  };
}

/**
 * Enhanced hook for tracking API requests as user activity
 * Race condition safe with comprehensive error handling
 */
export function useApiActivityTracker() {
  const config = getActivityConfig();
  const { updateActivity, isAuthenticated } = useAuth();
  const cleanupManager = useRef(null);
  const isComponentMounted = useRef(true);

  // Create race-safe updateActivity function
  const safeUpdateActivity = useMemo(() => {
    return createRetryWrapper(
      async (apiInfo = {}) => {
        if (!isComponentMounted.current || !isAuthenticated) {
          return;
        }
        
        try {
          await updateActivity();
          secureActivityLogger.logActivityDetected({
            component: 'useApiActivityTracker',
            ...apiInfo
          });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'useApiActivityTracker',
            action: 'updateActivity',
            apiInfo
          });
          throw error;
        }
      },
      config.MAX_ACTIVITY_UPDATE_RETRIES,
      config.ACTIVITY_UPDATE_RETRY_DELAY,
      'api-activity-update'
    );
  }, [updateActivity, isAuthenticated, config]);

  // Create throttled API activity tracker
  const throttledTrackActivity = useMemo(() => {
    // Initialize cleanup manager inside useMemo to handle HMR properly
    if (!cleanupManager.current || cleanupManager.current.isDestroyed) {
      cleanupManager.current = createThrottleCleanupManager();
    }
    
    const throttledFunc = createActivityThrottle(
      safeUpdateActivity,
      config.API_ACTIVITY_THROTTLE,
      'api-activity'
    );

    try {
      cleanupManager.current.add(throttledFunc);
    } catch (error) {
      // Handle destroyed cleanup manager during HMR
      cleanupManager.current = createThrottleCleanupManager();
      cleanupManager.current.add(throttledFunc);
    }
    
    return throttledFunc;
  }, [safeUpdateActivity, config.API_ACTIVITY_THROTTLE]);

  // Public API activity tracking function
  const trackApiActivity = useCallback((apiInfo = {}) => {
    try {
      if (!isComponentMounted.current || !isAuthenticated) {
        return;
      }

      // Sanitize API info to prevent logging sensitive data
      const safeApiInfo = {
        method: apiInfo.method,
        status: apiInfo.status,
        // Deliberately exclude URL and other potentially sensitive data
        timestamp: new Date().toISOString()
      };

      if (throttledTrackActivity && !throttledTrackActivity.isDestroyed()) {
        throttledTrackActivity(safeApiInfo);
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'useApiActivityTracker',
        action: 'trackApiActivity'
      });
    }
  }, [isAuthenticated, throttledTrackActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      if (cleanupManager.current) {
        cleanupManager.current.cleanupAll();
      }
    };
  }, []);

  return {
    trackApiActivity,
    isTracking: isAuthenticated,
    getStats: () => ({
      throttleMs: config.API_ACTIVITY_THROTTLE,
      isPending: throttledTrackActivity?.isPending() || false
    })
  };
}

/**
 * Enhanced hook for tracking route navigation as user activity
 * With proper error handling and performance optimization
 */
export function useNavigationActivityTracker() {
  const config = getActivityConfig();
  const { updateActivity, isAuthenticated } = useAuth();
  const cleanupManager = useRef(null);
  const isComponentMounted = useRef(true);

  // Create safe updateActivity function
  const safeUpdateActivity = useMemo(() => {
    return createRetryWrapper(
      async (navigationInfo = {}) => {
        if (!isComponentMounted.current || !isAuthenticated) {
          return;
        }
        
        try {
          await updateActivity();
          secureActivityLogger.logActivityDetected({
            component: 'useNavigationActivityTracker',
            ...navigationInfo
          });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'useNavigationActivityTracker',
            action: 'updateActivity',
            navigationInfo
          });
          throw error;
        }
      },
      config.MAX_ACTIVITY_UPDATE_RETRIES,
      config.ACTIVITY_UPDATE_RETRY_DELAY,
      'navigation-activity-update'
    );
  }, [updateActivity, isAuthenticated, config]);

  // Create throttled navigation activity tracker
  const throttledTrackActivity = useMemo(() => {
    // Initialize cleanup manager inside useMemo to handle HMR properly
    if (!cleanupManager.current || cleanupManager.current.isDestroyed) {
      cleanupManager.current = createThrottleCleanupManager();
    }
    
    const throttledFunc = createActivityThrottle(
      safeUpdateActivity,
      config.NAVIGATION_ACTIVITY_THROTTLE,
      'navigation-activity'
    );

    try {
      cleanupManager.current.add(throttledFunc);
    } catch (error) {
      // Handle destroyed cleanup manager during HMR
      cleanupManager.current = createThrottleCleanupManager();
      cleanupManager.current.add(throttledFunc);
    }
    
    return throttledFunc;
  }, [safeUpdateActivity, config.NAVIGATION_ACTIVITY_THROTTLE]);

  // Public navigation activity tracking function
  const trackNavigationActivity = useCallback((navigationInfo = {}) => {
    try {
      if (!isComponentMounted.current || !isAuthenticated) {
        return;
      }

      // Sanitize navigation info
      const safeNavigationInfo = {
        fromPath: navigationInfo.fromPath,
        toPath: navigationInfo.toPath,
        timestamp: new Date().toISOString()
        // Deliberately exclude search params and hash that might contain sensitive data
      };

      if (throttledTrackActivity && !throttledTrackActivity.isDestroyed()) {
        throttledTrackActivity(safeNavigationInfo);
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'useNavigationActivityTracker',
        action: 'trackNavigationActivity'
      });
    }
  }, [isAuthenticated, throttledTrackActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      if (cleanupManager.current) {
        cleanupManager.current.cleanupAll();
      }
    };
  }, []);

  return {
    trackNavigationActivity,
    isTracking: isAuthenticated,
    getStats: () => ({
      throttleMs: config.NAVIGATION_ACTIVITY_THROTTLE,
      isPending: throttledTrackActivity?.isPending() || false
    })
  };
}

export default useActivityTracker;