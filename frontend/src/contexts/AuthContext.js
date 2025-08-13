import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/auth/simpleAuthService';
import { toast } from 'react-toastify';
import {
  shouldShowPatientProfileCompletionPrompt,
  isFirstLogin,
} from '../utils/profileUtils';
import logger from '../services/logger';
import { getActivityConfig } from '../config/activityConfig';
import secureActivityLogger from '../utils/secureActivityLogger';
import { isAdminRole } from '../utils/authUtils';
import { secureStorage, legacyMigration } from '../utils/secureStorage';

// Auth State Management
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  tokenExpiry: null,
  lastActivity: Date.now(),
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
      console.log('🔄 AUTH_INIT: Starting auth initialization', {
        currentAuthState: state.isAuthenticated,
        hasCurrentToken: !!state.token,
        timestamp: new Date().toISOString()
      });
      
      try {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

        // Migrate legacy localStorage data if present
        legacyMigration.migrateFromLocalStorage();
        
        const storedToken = secureStorage.getItem('token');
        const storedUser = secureStorage.getItem('user');
        const storedExpiry = secureStorage.getItem('tokenExpiry');
        
        console.log('🔄 AUTH_INIT: Checking stored auth data', {
          hasStoredToken: !!storedToken,
          hasStoredUser: !!storedUser,
          hasStoredExpiry: !!storedExpiry,
          storedTokenPreview: storedToken ? `${storedToken.substring(0, 20)}...` : null,
          storedUserPreview: storedUser ? JSON.parse(storedUser).username : null,
          allMedappKeys: Object.keys(localStorage).filter(key => key.startsWith('medapp_')),
          allTokenKeys: Object.keys(localStorage).filter(key => key.includes('token')),
          timestamp: new Date().toISOString()
        });

        if (storedToken && storedUser && storedExpiry) {
          const tokenExpiry = parseInt(storedExpiry);
          
          console.log('🔄 AUTH_INIT: Found stored auth data, checking expiry', {
            tokenExpiry: new Date(tokenExpiry).toISOString(),
            currentTime: new Date().toISOString(),
            isExpired: isTokenExpired(tokenExpiry),
            timeUntilExpiry: tokenExpiry - Date.now(),
            timestamp: new Date().toISOString()
          });

          if (!isTokenExpired(tokenExpiry)) {
            console.log('🔄 AUTH_INIT: Token not expired, attempting to restore session');
            // Token is still valid, verify with server
            try {
              const user = await authService.getCurrentUser();
              console.log('🔄 AUTH_INIT: Server validated token, restoring session', {
                username: user?.username,
                userId: user?.id
              });
              dispatch({
                type: AUTH_ACTIONS.LOGIN_SUCCESS,
                payload: {
                  user,
                  token: storedToken,
                  tokenExpiry,
                },
              });
            } catch (error) {
              console.log('🔄 AUTH_INIT: Server rejected token, clearing storage', error.message);
              // Token invalid on server, clear local storage
              clearAuthData();
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          } else {
            // Token expired, try to refresh
            try {
              console.log('🔄 AUTH_INIT: Token expired, checking for refresh capability');
              
              // Check if refreshToken method exists
              if (typeof authService.refreshToken !== 'function') {
                console.log('🔄 AUTH_INIT: No refresh method available, clearing auth data');
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
              } else {
                clearAuthData();
                dispatch({ type: AUTH_ACTIONS.LOGOUT });
              }
            } catch (error) {
              clearAuthData();
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          }
        } else {
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } catch (error) {
        logger.error('auth_context_init_error', {
          message: 'Auth initialization failed',
          error: error.message,
          stack: error.stack,
          hasStoredToken: !!secureStorage.getItem('token'),
          hasStoredUser: !!secureStorage.getItem('user'),
          hasStoredExpiry: !!secureStorage.getItem('tokenExpiry'),
          timestamp: new Date().toISOString()
        });
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    initializeAuth();
  }, []);
  // Auto-refresh token before expiry
  useEffect(() => {
    console.log('🔄 TOKEN_REFRESH_EFFECT: Auto-refresh effect triggered', {
      isAuthenticated: state.isAuthenticated,
      hasTokenExpiry: !!state.tokenExpiry,
      tokenExpiry: state.tokenExpiry,
      timestamp: new Date().toISOString()
    });
    
    if (!state.isAuthenticated || !state.tokenExpiry) {
      console.log('🔄 TOKEN_REFRESH_EFFECT: Skipping refresh - not authenticated or no expiry');
      return;
    }

    const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
    const timeUntilRefresh = state.tokenExpiry - Date.now() - refreshBuffer;

    if (timeUntilRefresh > 0) {
      const refreshTimer = setTimeout(async () => {
        try {
          console.log('🔄 TOKEN_REFRESH_EFFECT: Attempting token refresh');
          
          // Check if refreshToken method exists
          if (typeof authService.refreshToken !== 'function') {
            console.log('🔄 TOKEN_REFRESH_EFFECT: No refresh method available, logging out');
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
            updateStoredToken(refreshResult.token, refreshResult.tokenExpiry);
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

  // Enhanced activity tracking for auto-logout with proper error handling
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const config = getActivityConfig();
    let activityTimer = null;

    const checkActivity = () => {
      try {
        const timeSinceLastActivity = Date.now() - state.lastActivity;
        
        if (timeSinceLastActivity > config.SESSION_TIMEOUT) {
          secureActivityLogger.logSessionEvent({
            action: 'session_expired',
            reason: 'inactivity',
            timeSinceLastActivity,
            sessionTimeout: config.SESSION_TIMEOUT
          });
          
          toast.info('Session expired due to inactivity');
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
      
      secureActivityLogger.logSessionEvent({
        action: 'session_monitoring_started',
        sessionTimeout: config.SESSION_TIMEOUT,
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
    console.log('🗑️ CLEAR_AUTH_DATA: Starting to clear auth data', {
      beforeClear: {
        hasToken: !!secureStorage.getItem('token'),
        hasUser: !!secureStorage.getItem('user'),
        hasExpiry: !!secureStorage.getItem('tokenExpiry')
      },
      timestamp: new Date().toISOString()
    });
    
    secureStorage.removeItem('token');
    secureStorage.removeItem('user');
    secureStorage.removeItem('tokenExpiry');
    
    console.log('🗑️ CLEAR_AUTH_DATA: Auth data cleared', {
      afterClear: {
        hasToken: !!secureStorage.getItem('token'),
        hasUser: !!secureStorage.getItem('user'),
        hasExpiry: !!secureStorage.getItem('tokenExpiry')
      },
      legacyStorage: {
        hasLegacyToken: !!localStorage.getItem('token'),
        hasLegacyUser: !!localStorage.getItem('user'),
        hasLegacyExpiry: !!localStorage.getItem('tokenExpiry')
      },
      allStorageKeys: Object.keys(localStorage).filter(key => 
        key.includes('token') || key.includes('user') || key.includes('medapp')
      ),
      timestamp: new Date().toISOString()
    });
    
    // Clear any cached app data to ensure fresh data on next login
    // This is additional insurance for cache clearing
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

  const updateStoredToken = (token, tokenExpiry) => {
    secureStorage.setItem('token', token);
    secureStorage.setItem('tokenExpiry', tokenExpiry.toString());
  };

  const updateStoredUser = user => {
    secureStorage.setJSON('user', user);
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

    updateStoredUser(updatedUser);
    return updatedUser;
  };

  // Auth Actions - handles both username/password credentials and SSO user/token
  const login = async (credentialsOrUser, tokenFromSSO = null) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      // Check if this is SSO login (user object + token) or regular login (credentials)
      const isSSO = tokenFromSSO !== null && typeof credentialsOrUser === 'object' && credentialsOrUser.username;
      
      let user, token;
      
      if (isSSO) {
        // SSO login - we already have user and token
        user = {
          ...credentialsOrUser,
          // Ensure isAdmin property is set based on role
          isAdmin: isAdminRole(credentialsOrUser.role)
        };
        token = tokenFromSSO;
        
        logger.info('Processing SSO login', {
          category: 'auth_sso_login',
          username: user.username,
          userId: user.id,
          role: user.role,
          isAdmin: user.isAdmin,
          timestamp: new Date().toISOString()
        });
      } else {
        // Regular username/password login
        const result = await authService.login(credentialsOrUser);

        if (!result.success) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_FAILURE,
            payload: result.error || 'Login failed',
          });
          return { success: false, error: result.error };
        }
        
        user = result.user;
        token = result.token;
        
        logger.info('Processing regular login', {
          category: 'auth_regular_login',
          username: user.username,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      }

      const tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

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

      // Store in localStorage
      updateStoredToken(token, tokenExpiry);
      updateStoredUser(user);

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user,
          token,
          tokenExpiry,
        },
      });

      toast.success('Login successful!');

      return {
        success: true,
        isFirstLogin: isFirstLogin(user.username),
      };
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    console.log('🚪 LOGOUT: Starting logout process', {
      isAuthenticated: state.isAuthenticated,
      hasToken: !!state.token,
      hasUser: !!state.user,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Call backend logout if token exists
      if (state.token) {
        console.log('🚪 LOGOUT: Calling backend logout API');
        await authService.logout();
        console.log('🚪 LOGOUT: Backend logout completed');
      }
    } catch (error) {
      console.log('🚪 LOGOUT: Backend logout failed', error.message);
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
      console.log('🚪 LOGOUT: Clearing auth data and dispatching logout action');
      
      // Clear auth data first
      clearAuthData();
      
      // Dispatch logout action to update state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      
      // Add a small delay to ensure state updates are processed
      // This prevents race conditions with the auth initialization effect
      setTimeout(() => {
        console.log('🚪 LOGOUT: Final auth state verification', {
          hasStoredToken: !!secureStorage.getItem('token'),
          hasStoredUser: !!secureStorage.getItem('user'),
          hasStoredExpiry: !!secureStorage.getItem('tokenExpiry'),
          timestamp: new Date().toISOString()
        });
      }, 100);
      
      toast.info('Logged out successfully');
    }
  };

  const updateActivity = () => {
    try {
      dispatch({ type: AUTH_ACTIONS.UPDATE_ACTIVITY });
      
      // Log activity update in development mode only
      if (process.env.NODE_ENV === 'development') {
        secureActivityLogger.logActivityDetected({
          component: 'AuthContext',
          action: 'activity_updated'
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

  const contextValue = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    login,
    logout,
    updateActivity,
    clearError,
    updateUser,

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
