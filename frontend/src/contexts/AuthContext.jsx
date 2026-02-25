import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/auth/simpleAuthService';
import { notifySuccess, notifyInfo } from '../utils/notifyTranslated';
import { env } from '../config/env';
import {
  shouldShowPatientProfileCompletionPrompt,
  isFirstLogin,
} from '../utils/profileUtils';
import logger from '../services/logger';
import { getActivityConfig } from '../config/activityConfig';
import secureActivityLogger from '../utils/secureActivityLogger';
import { isAdminRole } from '../utils/authUtils';
import { secureStorage, legacyMigration } from '../utils/secureStorage';
import { getUserPreferences } from '../services/api/userPreferencesApi';
import i18n from '../i18n';

// Auth State Management
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  tokenExpiry: null,
  lastActivity: Date.now(),
  sessionTimeoutMinutes: 30, // Default timeout
  mustChangePassword: false,
};

// Auth Actions
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
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
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        tokenExpiry: action.payload.tokenExpiry,
        lastActivity: Date.now(),
        sessionTimeoutMinutes: action.payload.sessionTimeoutMinutes || 30,
        mustChangePassword: action.payload.mustChangePassword || false,
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
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        tokenExpiry: null,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };

    case AUTH_ACTIONS.TOKEN_REFRESH:
      return {
        ...state,
        token: action.payload.token,
        tokenExpiry: action.payload.tokenExpiry,
        lastActivity: Date.now(),
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

  // Check if token is expired
  const isTokenExpired = tokenExpiry => {
    if (!tokenExpiry) return true;
    return Date.now() >= tokenExpiry;
  };

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

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

        // Migrate legacy localStorage data if present
        await legacyMigration.migrateFromLocalStorage();
        
        const storedToken = await secureStorage.getItem('token');
        const storedUser = await secureStorage.getItem('user');
        const storedExpiry = await secureStorage.getItem('tokenExpiry');
        const storedSessionTimeout = await secureStorage.getItem('sessionTimeoutMinutes');

        if (storedToken && storedUser && storedExpiry) {
          const tokenExpiry = parseInt(storedExpiry);
          const sessionTimeoutMinutes = storedSessionTimeout ? parseInt(storedSessionTimeout) : 30;

          if (!isTokenExpired(tokenExpiry)) {
            // Token is still valid, verify with server
            try {
              logger.info('Verifying stored token with server', {
                category: 'auth_restore_attempt',
                tokenExpiry: tokenExpiry,
                currentTime: Date.now(),
                hoursUntilExpiry: ((tokenExpiry - Date.now()) / (1000 * 60 * 60)).toFixed(2),
                sessionTimeoutMinutes: sessionTimeoutMinutes,
                timestamp: new Date().toISOString()
              });

              // getCurrentUser() calls the backend so must_change_password is always
              // authoritative — never read from client-side storage which can be cleared.
              const user = await authService.getCurrentUser();

              // A null return means the backend rejected the token (e.g. expired or
              // deleted user). Treat it the same as a failed verification.
              if (!user) {
                clearAuthData();
                dispatch({ type: AUTH_ACTIONS.LOGOUT });
                return;
              }

              const mustChangePassword = user.must_change_password === true;
              dispatch({
                type: AUTH_ACTIONS.LOGIN_SUCCESS,
                payload: {
                  user,
                  token: storedToken,
                  tokenExpiry,
                  sessionTimeoutMinutes,
                  mustChangePassword,
                },
              });

              logger.info('Authentication restored successfully', {
                category: 'auth_restore_success',
                userId: user.id,
                username: user.username,
                timestamp: new Date().toISOString()
              });

              // Load user's language preference from backend
              try {
                const userPrefs = await getUserPreferences();
                if (userPrefs.language && userPrefs.language !== i18n.language) {
                  await i18n.changeLanguage(userPrefs.language);
                  logger.info('User language preference loaded from backend', {
                    category: 'language_loaded',
                    language: userPrefs.language,
                    userId: user.id,
                    timestamp: new Date().toISOString()
                  });
                }
              } catch (langError) {
                // Don't fail auth if language loading fails
                logger.warn('Failed to load user language preference', {
                  category: 'language_load_failed',
                  error: langError.message,
                  userId: user.id,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (error) {
              // Token invalid on server, clear local storage
              logger.warn('Stored token invalid on server, clearing auth data', {
                category: 'auth_restore_failure',
                error: error.message,
                errorStack: error.stack,
                tokenExpiry: tokenExpiry,
                currentTime: Date.now(),
                wasExpired: tokenExpiry < Date.now(),
                timestamp: new Date().toISOString()
              });
              clearAuthData();
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          } else {
            // Token expired, try to refresh
            try {
              // Check if refreshToken method exists
              if (typeof authService.refreshToken !== 'function') {
                logger.warn('Token refresh not available, logging out', {
                  category: 'auth_refresh_unavailable'
                });
                clearAuthData();
                dispatch({ type: AUTH_ACTIONS.LOGOUT });
                return;
              }
              
              const refreshResult = await authService.refreshToken();
              if (refreshResult.success) {
                dispatch({
                  type: AUTH_ACTIONS.TOKEN_REFRESH,
                  payload: {
                    token: refreshResult.token,
                    tokenExpiry: refreshResult.tokenExpiry,
                  },
                });
                await updateStoredToken(refreshResult.token, refreshResult.tokenExpiry);
                
                logger.info('Token refreshed successfully during auth initialization', {
                  category: 'auth_refresh_success',
                  timestamp: new Date().toISOString()
                });
              } else {
                logger.warn('Token refresh failed during auth initialization', {
                  category: 'auth_refresh_failure',
                  timestamp: new Date().toISOString()
                });
                clearAuthData();
                dispatch({ type: AUTH_ACTIONS.LOGOUT });
              }
            } catch (error) {
              logger.error('Token refresh error during auth initialization', {
                category: 'auth_refresh_error',
                error: error.message,
                timestamp: new Date().toISOString()
              });
              clearAuthData();
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          }
        } else {
          // No stored auth data
          logger.info('No stored authentication data found', {
            category: 'auth_init_no_data',
            timestamp: new Date().toISOString()
          });
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } catch (error) {
        logger.error('auth_context_init_error', {
          message: 'Auth initialization failed',
          error: error.message,
          stack: error.stack,
          hasStoredToken: !!(await secureStorage.getItem('token')),
          hasStoredUser: !!(await secureStorage.getItem('user')),
          hasStoredExpiry: !!(await secureStorage.getItem('tokenExpiry')),
          timestamp: new Date().toISOString()
        });
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      } finally {
        // Always ensure loading is set to false when initialization completes
        // This prevents indefinite loading states
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);
  // Auto-refresh token before expiry - DISABLED
  // NOTE: Token refresh is not implemented on the backend (see simpleAuthService.js:324-328)
  // This auto-refresh logic was causing users to be logged out 5 minutes before their
  // actual token expiration because the refresh would fail and trigger a logout.
  // The JWT tokens are now set to the full user-configured timeout duration,
  // and users will be logged out only when:
  // 1. The token actually expires (not 5 minutes early), OR
  // 2. Inactivity timeout is reached (managed by the activity tracking below)
  //
  // If token refresh is implemented in the future, uncomment this code.
  /*
  useEffect(() => {
    if (!state.isAuthenticated || !state.tokenExpiry) {
      return;
    }

    const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
    const timeUntilRefresh = state.tokenExpiry - Date.now() - refreshBuffer;

    if (timeUntilRefresh > 0) {
      const refreshTimer = setTimeout(async () => {
        try {
          // Check if refreshToken method exists
          if (typeof authService.refreshToken !== 'function') {
            clearAuthData();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
            return;
          }

          const refreshResult = await authService.refreshToken();
          if (refreshResult.success) {
            dispatch({
              type: AUTH_ACTIONS.TOKEN_REFRESH,
              payload: {
                token: refreshResult.token,
                tokenExpiry: refreshResult.tokenExpiry,
              },
            });
            await updateStoredToken(refreshResult.token, refreshResult.tokenExpiry);
          } else {
            clearAuthData();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        } catch (error) {
          logger.error('auth_context_refresh_error', {
            message: 'Token refresh failed',
            error: error.message,
            stack: error.stack,
            isAuthenticated: state.isAuthenticated,
            hasToken: !!state.token,
            tokenExpiry: state.tokenExpiry,
            timeUntilExpiry: state.tokenExpiry ? state.tokenExpiry - Date.now() : null,
            timestamp: new Date().toISOString()
          });
          clearAuthData();
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      }, timeUntilRefresh);

      return () => clearTimeout(refreshTimer);
    }
  }, [state.tokenExpiry, state.isAuthenticated]);
  */

  // Enhanced activity tracking for auto-logout with proper error handling
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const config = getActivityConfig();
    let activityTimer = null;

    const checkActivity = () => {
      try {
        const timeSinceLastActivity = Date.now() - state.lastActivity;
        // Use user's custom timeout or fallback to config
        const sessionTimeoutMs = (state.sessionTimeoutMinutes || 30) * 60 * 1000;

        if (timeSinceLastActivity > sessionTimeoutMs) {
          secureActivityLogger.logSessionEvent({
            action: 'session_expired',
            reason: 'inactivity',
            timeSinceLastActivity,
            sessionTimeout: sessionTimeoutMs
          });

          logger.warn('Session expired due to inactivity', {
            category: 'auth_session_expired',
            timeSinceLastActivity: Math.floor(timeSinceLastActivity / 1000),
            sessionTimeoutMinutes: state.sessionTimeoutMinutes || 30,
            userId: state.user?.id,
            timestamp: new Date().toISOString()
          });

          notifyInfo('notifications:toasts.auth.sessionExpired');
          clearAuthData();
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } catch (error) {
        secureActivityLogger.logActivityError(error, {
          component: 'AuthContext',
          action: 'checkActivity'
        });
        
        // On error, err on the side of caution and logout
        logger.error('Session check failed, logging out for security', {
          error: error.message,
          category: 'auth_context_error'
        });
        clearAuthData();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    // Set up the activity check timer
    try {
      activityTimer = setInterval(checkActivity, config.SESSION_CHECK_INTERVAL);
      
      const sessionTimeoutMs = (state.sessionTimeoutMinutes || 30) * 60 * 1000;
      secureActivityLogger.logSessionEvent({
        action: 'session_monitoring_started',
        sessionTimeout: sessionTimeoutMs,
        sessionTimeoutMinutes: state.sessionTimeoutMinutes || 30,
        checkInterval: config.SESSION_CHECK_INTERVAL
      });
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'AuthContext',
        action: 'setup_activity_timer'
      });
    }

    // Cleanup function
    return () => {
      try {
        if (activityTimer) {
          clearInterval(activityTimer);
          secureActivityLogger.logSessionEvent({
            action: 'session_monitoring_stopped'
          });
        }
      } catch (error) {
        secureActivityLogger.logActivityError(error, {
          component: 'AuthContext',
          action: 'cleanup_activity_timer'
        });
      }
    };
  }, [state.lastActivity, state.isAuthenticated]);

  // Helper functions
  const clearAuthData = () => {
    secureStorage.removeItem('token');
    secureStorage.removeItem('user');
    secureStorage.removeItem('tokenExpiry');
    secureStorage.removeItem('sessionTimeoutMinutes');
    secureStorage.removeItem('mustChangePassword');

    // Clear any cached app data to ensure fresh data on next login
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('appData_') || 
      key.startsWith('patient_') || 
      key.startsWith('cache_')
    );
    
    cacheKeys.forEach(key => {
      // Legacy cleanup - remove from both storages
      localStorage.removeItem(key);
      secureStorage.removeItem(key);
    });
    
    // Note: We don't clear first login status as it should persist across sessions
  };

  const updateStoredToken = async (token, tokenExpiry) => {
    await secureStorage.setItem('token', token);
    await secureStorage.setItem('tokenExpiry', tokenExpiry.toString());
  };

  const updateStoredUser = async user => {
    await secureStorage.setJSON('user', user);
  };

  // Update user data in context and storage
  const updateUser = updatedUserData => {
    const updatedUser = { ...state.user, ...updatedUserData };

    dispatch({
      type: AUTH_ACTIONS.LOGIN_SUCCESS,
      payload: {
        user: updatedUser,
        token: state.token,
        tokenExpiry: state.tokenExpiry,
      },
    });

    // Note: Not awaiting here as this is called synchronously from components
    // The storage will complete in the background
    secureStorage.setJSON('user', updatedUser);
    return updatedUser;
  };

  // Auth Actions - handles both username/password credentials and SSO user/token
  const login = async (credentialsOrUser, tokenFromSSO = null) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      // Check if this is SSO login (user object + token) or regular login (credentials)
      const isSSO = tokenFromSSO !== null && typeof credentialsOrUser === 'object' && credentialsOrUser.username;
      
      let user, token, tokenExpiry, result;
      
      if (isSSO) {
        // SSO login - we already have user and token
        user = {
          ...credentialsOrUser,
          // Ensure isAdmin property is set based on role
          isAdmin: isAdminRole(credentialsOrUser.role)
        };
        token = tokenFromSSO;
        
        // Try to extract expiry from the SSO token
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.exp) {
              tokenExpiry = payload.exp * 1000; // Convert from seconds to milliseconds
            }
          }
        } catch (e) {
          logger.warn('Failed to extract expiry from SSO token', {
            category: 'auth_sso_token_parse',
            error: e.message
          });
        }
        
        logger.info('Processing SSO login', {
          category: 'auth_sso_login',
          username: user.username,
          userId: user.id,
          role: user.role,
          isAdmin: user.isAdmin,
          tokenExpiry: tokenExpiry,
          timestamp: new Date().toISOString()
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
        token = result.token;
        tokenExpiry = result.tokenExpiry; // Get the actual token expiry from the result
        
        logger.info('Processing regular login', {
          category: 'auth_regular_login',
          username: user.username,
          userId: user.id,
          tokenExpiry: tokenExpiry,
          timestamp: new Date().toISOString()
        });
      }

      // Use the actual token expiry from the auth service (or fallback to 24 hours for SSO)
      if (isSSO && !tokenExpiry) {
        tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours fallback for SSO
      }
      
      // Fallback if tokenExpiry is still not set
      if (!tokenExpiry) {
        tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours fallback
      }

      // Clear any existing cache data before login
      // This ensures fresh data is loaded for the new user session
      logger.info('Clearing cache before login', {
        category: 'auth_cache_clear',
        username: user.username,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      // Clear any existing cached data from localStorage
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('appData_') || 
        key.startsWith('patient_') || 
        key.startsWith('cache_')
      );
      
      cacheKeys.forEach(key => {
        // Legacy cleanup - remove from both storages
        localStorage.removeItem(key);
        secureStorage.removeItem(key);
      });

      // Log token expiry details for debugging
      const expiryDate = new Date(tokenExpiry);
      const hoursUntilExpiry = (tokenExpiry - Date.now()) / (1000 * 60 * 60);
      logger.info('Token expiry details before storage', {
        category: 'auth_token_expiry',
        tokenExpiry: tokenExpiry,
        expiryDate: expiryDate.toISOString(),
        hoursUntilExpiry: hoursUntilExpiry.toFixed(2),
        currentTime: Date.now(),
        isExpired: tokenExpiry < Date.now()
      });

      // Get session timeout from result or use default
      const sessionTimeoutMinutes = (isSSO ? 30 : result?.sessionTimeoutMinutes) || 30;
      const mustChangePassword = isSSO ? false : (result?.mustChangePassword || false);

      // Store in localStorage - MUST await to prevent race conditions
      await updateStoredToken(token, tokenExpiry);
      await updateStoredUser(user);
      await secureStorage.setItem('sessionTimeoutMinutes', sessionTimeoutMinutes.toString());
      await secureStorage.setItem('mustChangePassword', mustChangePassword ? 'true' : 'false');

      logger.info('Session timeout stored', {
        category: 'auth_session_timeout',
        sessionTimeoutMinutes: sessionTimeoutMinutes,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user,
          token,
          tokenExpiry,
          sessionTimeoutMinutes,
          mustChangePassword,
        },
      });

      // Load user's language preference from backend after successful login
      try {
        const userPrefs = await getUserPreferences();
        if (userPrefs.language && userPrefs.language !== i18n.language) {
          await i18n.changeLanguage(userPrefs.language);
          logger.info('User language preference loaded from backend after login', {
            category: 'language_loaded',
            language: userPrefs.language,
            userId: user.id,
            timestamp: new Date().toISOString()
          });
        }
      } catch (langError) {
        // Don't fail auth if language loading fails
        logger.warn('Failed to load user language preference after login', {
          category: 'language_load_failed',
          error: langError.message,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      }

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
    try {
      // Call backend logout if token exists
      if (state.token) {
        await authService.logout();
      }
    } catch (error) {
      logger.error('auth_context_logout_error', {
        message: 'Logout API call failed',
        error: error.message,
        stack: error.stack,
        isAuthenticated: state.isAuthenticated,
        hasToken: !!state.token,
        userId: state.user?.id,
        userRole: state.user?.role,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Clear auth data first
      clearAuthData();
      
      // Dispatch logout action to update state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      
      notifyInfo('notifications:toasts.auth.logoutSuccess');
    }
  };

  const updateActivity = () => {
    try {
      // Throttle activity updates to prevent excessive re-renders during form interactions
      const now = Date.now();
      const timeSinceLastUpdate = now - state.lastActivity;
      
      // Only update if it's been at least 5 seconds since last update
      if (timeSinceLastUpdate < 5000) {
        return;
      }
      
      dispatch({ type: AUTH_ACTIONS.UPDATE_ACTIVITY });
      
      // Log activity update in development mode only
      if (env.DEV) {
        secureActivityLogger.logActivityDetected({
          component: 'AuthContext',
          action: 'activity_updated',
          timeSinceLastUpdate
        });
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'AuthContext',
        action: 'updateActivity'
      });
      
      // Don't throw the error to prevent breaking the app
      logger.error('Failed to update activity', {
        error: error.message,
        category: 'auth_context_error'
      });
    }
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const clearMustChangePassword = () => {
    secureStorage.removeItem('mustChangePassword');
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

  const updateSessionTimeout = (timeoutMinutes) => {
    dispatch({ 
      type: AUTH_ACTIONS.UPDATE_SESSION_TIMEOUT, 
      payload: timeoutMinutes 
    });
    logger.info('Session timeout updated', {
      category: 'auth_timeout_update',
      newTimeout: timeoutMinutes,
      userId: state.user?.id
    });
  };

  const contextValue = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    sessionTimeoutMinutes: state.sessionTimeoutMinutes,
    mustChangePassword: state.mustChangePassword,

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
