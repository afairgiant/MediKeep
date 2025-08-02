# Enhanced Activity Tracking Implementation

## Overview

The enhanced activity tracking system prevents premature session timeouts by automatically detecting user activity and updating the session's `lastActivity` timestamp in the AuthContext. This implementation addresses critical security, performance, and reliability issues.

## Critical Improvements

- **Memory Leak Prevention**: Comprehensive cleanup management with proper event listener removal
- **Race Condition Safety**: API activity tracking with race condition protection
- **Error Handling**: Try-catch blocks around all critical operations with graceful fallbacks
- **Session Alignment**: Throttle intervals properly aligned with 30-minute session timeout
- **Secure Logging**: Information leakage prevention in activity logs
- **Performance Optimization**: Proper memoization to prevent unnecessary re-renders

## Key Features

- **Automatic Detection**: Tracks mouse movements, clicks, keyboard input, touch events, scrolling
- **API Activity**: Race-safe monitoring of successful API requests as user activity  
- **Navigation Tracking**: Detects route changes as user activity with data sanitization
- **Performance Optimized**: Uses configurable throttling (15s for UI events, 10s for API calls, 5s for navigation)
- **Authentication Aware**: Only tracks activity for authenticated users
- **Error Resilient**: Comprehensive error handling without breaking app functionality

## Components

### 1. `useActivityTracker` Hook
Enhanced main hook that sets up global event listeners with comprehensive error handling and memory leak prevention.

**Usage:**
```javascript
const { 
  isTracking, 
  isEnabled, 
  manualTrigger, 
  getStats, 
  cleanup 
} = useActivityTracker({
  throttleMs: 15000,        // Override default throttle (optional)
  trackMouseMove: true,     // Track mouse movements
  trackKeyboard: true,      // Track keyboard input
  trackClicks: true,        // Track mouse clicks
  trackTouch: true,         // Track touch events
  enabled: true,            // Enable/disable tracking
});

// Get performance statistics
const stats = getStats();
console.log('Listeners:', stats.listenersCount);
console.log('Throttle:', stats.throttleMs);
console.log('Pending:', stats.isPending);

// Manual cleanup if needed
cleanup();
```

**New Features:**
- Configurable throttling with session timeout alignment
- Comprehensive error handling with graceful fallbacks  
- Memory leak prevention with proper cleanup management
- Performance monitoring and statistics
- Race condition safe activity updates

### 2. `useApiActivityTracker` Hook
Specialized hook for tracking API requests as user activity.

**Usage:**
```javascript
const { trackApiActivity, isTracking } = useApiActivityTracker();

// Call this after successful API requests
trackApiActivity({
  method: 'GET',
  url: '/api/patients',
  status: 200
});
```

### 3. `useNavigationActivityTracker` Hook
Tracks route navigation as user activity.

**Usage:**
```javascript
const { trackNavigationActivity, isTracking } = useNavigationActivityTracker();

// Call this on route changes
trackNavigationActivity({
  fromPath: '/dashboard',
  toPath: '/patients'
});
```

## Integration Points

### 1. Global Setup (App.js)
- `ActivityTracker` component initializes global UI activity tracking
- `NavigationTracker` component enhanced to track navigation activity
- API client configured with activity tracking interceptor

### 2. API Client Integration (apiClient.js)
- API client enhanced with `setActivityTracker()` method
- Successful API requests automatically trigger activity tracking
- Throttled to prevent excessive calls during rapid API usage

### 3. AuthContext Integration
- Existing `updateActivity()` function used to update `lastActivity` timestamp
- Session timeout logic remains unchanged - only the activity detection is enhanced

## Session Timeout Logic

The session timeout mechanism in AuthContext:
1. Checks `lastActivity` every 60 seconds
2. Logs out user if inactive for 30 minutes (configurable)
3. Shows "Session expired due to inactivity" toast notification

With the activity tracker, `lastActivity` is automatically updated when:
- User moves mouse or clicks
- User types on keyboard  
- User touches screen (mobile)
- User scrolls or focuses elements
- API requests succeed
- User navigates between routes

## Performance Considerations

- **Throttling**: Events are throttled to prevent excessive `updateActivity()` calls
- **Passive Listeners**: Mouse and scroll events use passive listeners for better performance
- **Conditional Tracking**: Only tracks activity for authenticated users
- **Memory Management**: Event listeners are properly cleaned up when components unmount

## Security Features

- Only tracks activity during authenticated sessions
- Ignores activity on login/logout forms to prevent interference
- Logs activity tracking events for debugging and monitoring
- No sensitive data is captured - only activity timestamps

## Debugging

Activity tracking events are logged with `logger.debug()` for troubleshooting:
- When global tracking is enabled/disabled
- When individual activity events are detected (throttled)
- When API and navigation activities are tracked

## Error Handling

- Graceful fallback if activity tracker fails to initialize
- Error logging for debugging issues
- Does not interfere with existing authentication flow if tracker fails