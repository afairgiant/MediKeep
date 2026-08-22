import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { authService } from '../services/auth/simpleAuthService';
import {
  notifySuccess,
  notifyInfo,
  notifyWarning,
} from '../utils/notifyTranslated';
import { env } from '../config/env';
import {
  shouldShowPatientProfileCompletionPrompt,
  isFirstLogin,
} from '../utils/profileUtils';
import logger from '../services/logger';
import { getActivityConfig } from '../config/activityConfig';
import secureActivityLogger from '../utils/secureActivityLogger';
import { isAdminRole } from '../utils/authUtils';
import { getUserPreferences } from '../services/api/userPreferencesApi';

// Auth State Management
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  lastActivity: Date.now(),
  sessionTimeoutMinutes: 120, // Default timeout
  mustChangePassword: false,
  // Why the session ended, when it ended by our own action (the user logged out,
  // or the inactivity timeout fired) rather than because there was never one.
  // ProtectedRoute turns this into a `local=1` on the login URL so the redirect
  // that follows does not bounce to the IdP, which still holds a live session and
  // would silently sign the user back in. Null for a visitor who simply is not
  // logged in - that redirect SHOULD reach the IdP.
  //
  // It lives in reducer state rather than a module flag on purpose: ProtectedRoute
  // computes its redirect during render, and React StrictMode double-invokes
  // render in development, so a consume-on-read flag would be swallowed by the
  // discarded first pass and suppression would vanish in dev only.
  sessionEndedReason: null,
};

// Auth Actions
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_SESSION_TIMEOUT: 'UPDATE_SESSION_TIMEOUT',
  CLEAR_MUST_CHANGE_PASSWORD: 'CLEAR_MUST_CHANGE_PASSWORD',
};

// Auth Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),
        sessionTimeoutMinutes: action.payload.sessionTimeoutMinutes || 120,
        mustChangePassword: action.payload.mustChangePassword || false,
        sessionEndedReason: null,
      };

    case AUTH_ACTIONS.CLEAR_MUST_CHANGE_PASSWORD:
      return {
        ...state,
        mustChangePassword: false,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
        // Set by endSession, null by discardSession. Never inherited from the
        // previous state - a teardown that had no reason must clear a stale one.
        sessionEndedReason: action.payload?.reason ?? null,
      };

    case AUTH_ACTIONS.UPDATE_ACTIVITY:
      return {
        ...state,
        lastActivity: Date.now(),
      };

    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case AUTH_ACTIONS.UPDATE_SESSION_TIMEOUT:
      return {
        ...state,
        sessionTimeoutMinutes: action.payload,
        lastActivity: Date.now(), // Reset activity timer when timeout changes
      };

    default:
      return state;
  }
}

// Create Context
const AuthContext = createContext(null);

// Auth Provider Component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user should see patient profile completion prompts (first login only)
  const shouldShowProfilePrompts = patient => {
    return (
      state.user &&
      shouldShowPatientProfileCompletionPrompt(state.user, patient)
    );
  };

  // Check if this is user's first login
  const checkIsFirstLogin = () => {
    return state.user && isFirstLogin(state.user.username);
  };

  // Helper functions
  // Clear client-side auth data. The HttpOnly cookie is cleared server-side on logout.
  const clearAuthData = () => {
    localStorage.removeItem('medapp_sessionTimeoutMinutes');

    const cacheKeys = Object.keys(localStorage).filter(
      key =>
        key.startsWith('appData_') ||
        key.startsWith('patient_') ||
        key.startsWith('cache_')
    );
    cacheKeys.forEach(key => localStorage.removeItem(key));
  };

  // Tear down a session that WE ended -- the user logged out, or the inactivity
  // timeout fired. The reason is recorded so the redirect that follows carries
  // suppression.
  //
  // This exists as one function because there is more than one way to end a
  // session and only one of them is a button. The inactivity timeout used to
  // clear and dispatch by hand; under SSO_AUTO_REDIRECT that meant an idle user
  // was bounced to the IdP, silently re-authenticated, and returned to the app --
  // the inactivity timeout disabled deployment-wide. See SSO_ONLY_MODE_SPEC.md 8.12.
  //
  // useCallback with no dependencies so the inactivity effect can depend on it
  // without being torn down and recreated on every render. dispatch is stable,
  // and clearAuthData reads nothing reactive.
  const endSession = useCallback(reason => {
    clearAuthData();
    dispatch({ type: AUTH_ACTIONS.LOGOUT, payload: { reason } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearAuthData touches only localStorage
  }, []);

  // The other kind of teardown: there was no session to end. Startup found no
  // valid cookie, or the lookup failed outright.
  //
  // It records no reason, which is the whole point - a visitor who simply is not
  // signed in should still reach the IdP under SSO_AUTO_REDIRECT. Naming it
  // rather than leaving the two sites to dispatch LOGOUT by hand is what keeps
  // that distinction visible: it used to be expressed only by *not* calling
  // endSession, which is invisible to whoever adds the next teardown.
  // Not memoized: its only caller is the mount-once effect below, which has no
  // dependency on it.
  const discardSession = () => endSession(null);

  // Initialize auth state on app load.
  // The HttpOnly cookie is sent automatically -- we verify the session by
  // calling /users/me. If the cookie is valid the user is returned; otherwise
  // we treat the session as expired.
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

        logger.info('Verifying session with server', {
          category: 'auth_restore_attempt',
          timestamp: new Date().toISOString(),
        });

        const user = await authService.getCurrentUser();

        if (!user) {
          logger.info('No valid session found', {
            category: 'auth_init_no_session',
            timestamp: new Date().toISOString(),
          });
          discardSession();
          return;
        }

        const mustChangePassword = user.must_change_password === true;

        // Load user preferences from backend (session timeout + language)
        let sessionTimeoutMinutes = 120;
        try {
          const userPrefs = await getUserPreferences();
          if (userPrefs.session_timeout_minutes) {
            sessionTimeoutMinutes = userPrefs.session_timeout_minutes;
            localStorage.setItem(
              'medapp_sessionTimeoutMinutes',
              sessionTimeoutMinutes.toString()
            );
          }
          // Language preference is applied by UserPreferencesContext
        } catch (prefError) {
          // Fall back to cached localStorage value
          const cached = localStorage.getItem('medapp_sessionTimeoutMinutes');
          if (cached) sessionTimeoutMinutes = parseInt(cached);
          logger.warn('Failed to load user preferences, using cached timeout', {
            category: 'prefs_load_failed',
            error: prefError.message,
            sessionTimeoutMinutes,
          });
        }

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, sessionTimeoutMinutes, mustChangePassword },
        });

        logger.info('Authentication restored successfully', {
          category: 'auth_restore_success',
          userId: user.id,
          username: user.username,
          sessionTimeoutMinutes,
        });
      } catch (error) {
        logger.error('auth_context_init_error', {
          message: 'Auth initialization failed',
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
        discardSession();
      } finally {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; discardSession is stable
  }, []);

  // Refs so the interval closure reads fresh values without re-registering
  const lastActivityRef = React.useRef(state.lastActivity);
  const sessionTimeoutRef = React.useRef(state.sessionTimeoutMinutes);
  useEffect(() => {
    lastActivityRef.current = state.lastActivity;
  }, [state.lastActivity]);
  useEffect(() => {
    sessionTimeoutRef.current = state.sessionTimeoutMinutes;
  }, [state.sessionTimeoutMinutes]);

  // Inactivity check -- single interval, created once on login, torn down on logout
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const { SESSION_CHECK_INTERVAL } = getActivityConfig();

    const activityTimer = setInterval(async () => {
      const idle = Date.now() - lastActivityRef.current;
      const timeoutMs = (sessionTimeoutRef.current || 120) * 60 * 1000;

      if (idle > timeoutMs) {
        logger.warn('Session expired due to inactivity', {
          category: 'auth_session_expired',
          idleSeconds: Math.floor(idle / 1000),
          sessionTimeoutMinutes: sessionTimeoutRef.current || 120,
        });
        notifyInfo('notifications:toasts.auth.sessionExpired');
        // Await the server-side cookie clear before tearing down auth state.
        // Racing this with the Login page's config fetches caused the SSO
        // button to disappear after auto-logout (issue #723). May fail if the
        // JWT is already expired -- that's OK.
        try {
          await authService.logout();
        } catch {
          // ignored -- expired JWT will 401, that's expected
        }
        endSession('session_expired');
      }
    }, SESSION_CHECK_INTERVAL);

    return () => clearInterval(activityTimer);
  }, [state.isAuthenticated, endSession]);

  // Update user data in context -- preserve existing session state
  const updateUser = updatedUserData => {
    const updatedUser = { ...state.user, ...updatedUserData };

    dispatch({
      type: AUTH_ACTIONS.LOGIN_SUCCESS,
      payload: {
        user: updatedUser,
        sessionTimeoutMinutes: state.sessionTimeoutMinutes,
        mustChangePassword: state.mustChangePassword,
      },
    });

    return updatedUser;
  };

  // Auth Actions - handles both username/password credentials and SSO user object.
  // The token is stored as an HttpOnly cookie by the server -- the frontend
  // only manages user state and session timeout preferences.
  // For SSO: pass { sso: true, mustChangePassword } as second arg to distinguish
  // from regular login and carry through flags from the SSO login response.
  const login = async (credentialsOrUser, ssoFlag = null) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      // Check if this is SSO login (user object) or regular login (credentials).
      // Requires sso === true, not merely a present options object: { sso: false }
      // must fall through to a credential login rather than trusting the first
      // argument as an already-authenticated user.
      const isSSO =
        ssoFlag?.sso === true &&
        typeof credentialsOrUser === 'object' &&
        credentialsOrUser.username;

      let user, result;

      if (isSSO) {
        // SSO login - user object is provided directly by the SSO callback
        user = {
          ...credentialsOrUser,
          isAdmin: isAdminRole(credentialsOrUser.role),
        };

        logger.info('Processing SSO login', {
          category: 'auth_sso_login',
          username: user.username,
          userId: user.id,
          role: user.role,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Regular username/password login
        result = await authService.login(credentialsOrUser);

        if (!result.success) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_FAILURE,
            payload: result.error || 'Login failed',
          });
          return { success: false, error: result.error };
        }

        user = result.user;

        logger.info('Processing regular login', {
          category: 'auth_regular_login',
          username: user.username,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Clear any existing cached data from localStorage
      const cacheKeys = Object.keys(localStorage).filter(
        key =>
          key.startsWith('appData_') ||
          key.startsWith('patient_') ||
          key.startsWith('cache_')
      );
      cacheKeys.forEach(key => localStorage.removeItem(key));

      // Get session timeout from result or use default
      const sessionTimeoutMinutes =
        (isSSO ? 120 : result?.sessionTimeoutMinutes) || 120;
      // SSO callers read the flag from the login response and pass it in the options
      // object; regular logins get it from the login result.
      const mustChangePassword =
        (isSSO ? ssoFlag?.mustChangePassword : result?.mustChangePassword) ||
        false;

      // Store session timeout preference in localStorage (not sensitive)
      localStorage.setItem(
        'medapp_sessionTimeoutMinutes',
        sessionTimeoutMinutes.toString()
      );

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user,
          sessionTimeoutMinutes,
          mustChangePassword,
        },
      });

      // Language preference is applied by UserPreferencesContext once isAuthenticated flips

      notifySuccess('notifications:toasts.auth.loginSuccess');

      return {
        success: true,
        isFirstLogin: isFirstLogin(user.username),
        mustChangePassword,
      };
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      notifyInfo('notifications:toasts.auth.loginFailed');
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    // Tracked so the `finally` can tell a clean logout from one where the server
    // never cleared the cookie. authService.logout() used to swallow a non-2xx
    // response, which made this catch unreachable for anything but a total
    // network failure -- see SSO_ONLY_MODE_SPEC.md 8.7b.
    let serverLogoutFailed = false;

    try {
      // Call backend logout to clear the HttpOnly cookie
      await authService.logout();
    } catch (error) {
      serverLogoutFailed = true;
      logger.error('auth_context_logout_error', {
        message: 'Logout API call failed',
        error: error.message,
        stack: error.stack,
        isAuthenticated: state.isAuthenticated,
        userId: state.user?.id,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Tear down local state either way. Refusing to log out because the server
      // refused would leave someone who clicked "log out" sitting in an
      // authenticated session, which is worse on a shared workstation than a
      // client-side-only logout. But say so: the cookie may still be live, and
      // only closing the browser is guaranteed to end it.
      endSession('logged_out');

      if (serverLogoutFailed) {
        notifyWarning('notifications:toasts.auth.logoutIncomplete');
      } else {
        notifyInfo('notifications:toasts.auth.logoutSuccess');
      }
    }
  };

  const updateActivity = () => {
    try {
      const now = Date.now();
      const timeSinceLastUpdate = now - state.lastActivity;

      if (timeSinceLastUpdate < 5000) {
        return;
      }

      dispatch({ type: AUTH_ACTIONS.UPDATE_ACTIVITY });

      // Log activity update in development mode only
      if (env.DEV) {
        secureActivityLogger.logActivityDetected({
          component: 'AuthContext',
          action: 'activity_updated',
          timeSinceLastUpdate,
        });
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'AuthContext',
        action: 'updateActivity',
      });

      // Don't throw the error to prevent breaking the app
      logger.error('Failed to update activity', {
        error: error.message,
        category: 'auth_context_error',
      });
    }
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const clearMustChangePassword = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_MUST_CHANGE_PASSWORD });
  };

  // Check if user has specific role
  const hasRole = role => {
    return state.user?.role === role || state.user?.roles?.includes(role);
  };

  // Check if user has any of the specified roles
  const hasAnyRole = roles => {
    if (!state.user) return false;
    if (state.user.role && roles.includes(state.user.role)) return true;
    if (state.user.roles) {
      return roles.some(role => state.user.roles.includes(role));
    }
    return false;
  };

  const updateSessionTimeout = timeoutMinutes => {
    localStorage.setItem(
      'medapp_sessionTimeoutMinutes',
      timeoutMinutes.toString()
    );
    dispatch({
      type: AUTH_ACTIONS.UPDATE_SESSION_TIMEOUT,
      payload: timeoutMinutes,
    });
  };

  const contextValue = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    sessionTimeoutMinutes: state.sessionTimeoutMinutes,
    mustChangePassword: state.mustChangePassword,
    sessionEndedReason: state.sessionEndedReason,

    // Actions
    login,
    logout,
    updateActivity,
    clearError,
    clearMustChangePassword,
    updateUser,
    updateSessionTimeout,

    // Utilities
    hasRole,
    hasAnyRole,
    shouldShowProfilePrompts,
    checkIsFirstLogin,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
