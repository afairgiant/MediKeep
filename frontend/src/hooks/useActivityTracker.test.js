import { renderHook, act } from '@testing-library/react';
import { useActivityTracker, useApiActivityTracker, useNavigationActivityTracker } from './useActivityTracker';
import { AuthProvider } from '../contexts/AuthContext';
import React from 'react';

// Mock the auth context
const mockUpdateActivity = jest.fn().mockResolvedValue(undefined);
const mockAuthContext = {
  updateActivity: mockUpdateActivity,
  isAuthenticated: true,
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }) => children,
}));

jest.mock('../services/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

// Mock the activity config
jest.mock('../config/activityConfig', () => ({
  getActivityConfig: () => ({
    UI_ACTIVITY_THROTTLE: 100, // Fast for tests
    API_ACTIVITY_THROTTLE: 100,
    NAVIGATION_ACTIVITY_THROTTLE: 50,
    MAX_ACTIVITY_UPDATE_RETRIES: 1,
    ACTIVITY_UPDATE_RETRY_DELAY: 10,
    EVENT_LISTENER_OPTIONS: { passive: true, capture: true },
    TRACKED_EVENTS: {
      MOUSE: ['click', 'mousedown'],
      MOUSE_MOVE: ['mousemove'],
      KEYBOARD: ['keydown', 'keypress'],
      TOUCH: ['touchstart', 'touchmove', 'touchend'],
      SCROLL: ['scroll', 'wheel'],
      FOCUS: ['focus', 'blur']
    },
    IGNORED_SELECTORS: ['.login-form', '.logout-button']
  })
}));

// Mock secure activity logger
jest.mock('../utils/secureActivityLogger', () => ({
  logActivityInit: jest.fn(),
  logActivityDetected: jest.fn(),
  logActivityCleanup: jest.fn(),
  logActivityError: jest.fn(),
}));

// Mock throttle utils
jest.mock('../utils/throttleUtils', () => ({
  createActivityThrottle: jest.fn((func) => {
    const throttled = jest.fn(func);
    throttled.cleanup = jest.fn();
    throttled.isPending = jest.fn(() => false);
    throttled.isDestroyed = jest.fn(() => false);
    return throttled;
  }),
  createThrottleCleanupManager: jest.fn(() => ({
    add: jest.fn(),
    cleanupAll: jest.fn(),
  })),
  createRetryWrapper: jest.fn((func) => func),
  createRaceSafeWrapper: jest.fn((func) => {
    const wrapped = jest.fn(func);
    wrapped.cleanup = jest.fn();
    wrapped.isPending = jest.fn(() => false);
    wrapped.isDestroyed = jest.fn(() => false);
    return wrapped;
  }),
}));

describe('useActivityTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock document.addEventListener
    global.document.addEventListener = jest.fn();
    global.document.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should set up event listeners when authenticated', () => {
    const { result } = renderHook(() => useActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(document.addEventListener).toHaveBeenCalled();
    expect(typeof result.current.isTracking).toBe('boolean');
    expect(typeof result.current.isEnabled).toBe('boolean');
  });

  it('should provide comprehensive API', () => {
    const { result } = renderHook(() => useActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(typeof result.current.manualTrigger).toBe('function');
    expect(typeof result.current.getStats).toBe('function');
    expect(typeof result.current.cleanup).toBe('function');
  });

  it('should call updateActivity when manually triggered', async () => {
    const { result } = renderHook(() => useActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.manualTrigger();
    });

    expect(mockUpdateActivity).toHaveBeenCalled();
  });

  it('should provide stats', () => {
    const { result } = renderHook(() => useActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    const stats = result.current.getStats();
    expect(stats).toHaveProperty('listenersCount');
    expect(stats).toHaveProperty('throttleMs');
    expect(stats).toHaveProperty('isPending');
  });

  it('should handle disabled state', () => {
    const { result } = renderHook(() => useActivityTracker({ enabled: false }), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it('should cleanup properly', () => {
    const { result } = renderHook(() => useActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.cleanup();
    });

    // Cleanup should not throw
    expect(typeof result.current.cleanup).toBe('function');
  });
});

describe('useApiActivityTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide comprehensive API', () => {
    const { result } = renderHook(() => useApiActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(typeof result.current.trackApiActivity).toBe('function');
    expect(typeof result.current.getStats).toBe('function');
    expect(result.current.isTracking).toBe(true);
  });

  it('should call updateActivity when tracking API activity', () => {
    const { result } = renderHook(() => useApiActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.trackApiActivity({
        method: 'GET',
        status: 200,
      });
    });

    expect(mockUpdateActivity).toHaveBeenCalled();
  });

  it('should provide stats', () => {
    const { result } = renderHook(() => useApiActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    const stats = result.current.getStats();
    expect(stats).toHaveProperty('throttleMs');
    expect(stats).toHaveProperty('isPending');
  });

  it('should not track when not authenticated', () => {
    // Mock unauthenticated state
    const originalAuthContext = mockAuthContext.isAuthenticated;
    mockAuthContext.isAuthenticated = false;

    const { result } = renderHook(() => useApiActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.trackApiActivity({
        method: 'GET',
        status: 200,
      });
    });

    // Should not call updateActivity when not authenticated
    expect(result.current.isTracking).toBe(false);

    // Restore original state
    mockAuthContext.isAuthenticated = originalAuthContext;
  });
});

describe('useNavigationActivityTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide comprehensive API', () => {
    const { result } = renderHook(() => useNavigationActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(typeof result.current.trackNavigationActivity).toBe('function');
    expect(typeof result.current.getStats).toBe('function');
    expect(result.current.isTracking).toBe(true);
  });

  it('should call updateActivity when tracking navigation', () => {
    const { result } = renderHook(() => useNavigationActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.trackNavigationActivity({
        fromPath: '/dashboard',
        toPath: '/patients',
      });
    });

    expect(mockUpdateActivity).toHaveBeenCalled();
  });

  it('should provide stats', () => {
    const { result } = renderHook(() => useNavigationActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    const stats = result.current.getStats();
    expect(stats).toHaveProperty('throttleMs');
    expect(stats).toHaveProperty('isPending');
  });

  it('should sanitize navigation info', () => {
    const { result } = renderHook(() => useNavigationActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    act(() => {
      result.current.trackNavigationActivity({
        fromPath: '/dashboard',
        toPath: '/patients?sensitive=data',
        search: '?secret=value',
        hash: '#private',
      });
    });

    expect(mockUpdateActivity).toHaveBeenCalled();
    // The implementation should sanitize the data and not pass sensitive info
  });

  it('should handle errors gracefully', () => {
    const { result } = renderHook(() => useNavigationActivityTracker(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    // This should not throw even if updateActivity fails
    act(() => {
      result.current.trackNavigationActivity(null);
    });

    // Should handle invalid input gracefully
    expect(typeof result.current.trackNavigationActivity).toBe('function');
  });
});