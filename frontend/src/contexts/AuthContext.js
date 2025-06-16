import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/auth/simpleAuthService';
import { toast } from 'react-toastify';

// Auth State Management
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  tokenExpiry: null,
  lastActivity: Date.now()
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
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Auth Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
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
        lastActivity: Date.now()
      };
    
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        tokenExpiry: null
      };
    
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };
    
    case AUTH_ACTIONS.TOKEN_REFRESH:
      return {
        ...state,
        token: action.payload.token,
        tokenExpiry: action.payload.tokenExpiry,
        lastActivity: Date.now()
      };
    
    case AUTH_ACTIONS.UPDATE_ACTIVITY:
      return {
        ...state,
        lastActivity: Date.now()
      };
    
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
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
  const isTokenExpired = (tokenExpiry) => {
    if (!tokenExpiry) return true;
    return Date.now() >= tokenExpiry;
  };

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
        
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedExpiry = localStorage.getItem('tokenExpiry');
        
        if (storedToken && storedUser && storedExpiry) {
          const tokenExpiry = parseInt(storedExpiry);
          
          if (!isTokenExpired(tokenExpiry)) {
            // Token is still valid, verify with server
            try {
              const user = await authService.getCurrentUser();
              dispatch({
                type: AUTH_ACTIONS.LOGIN_SUCCESS,
                payload: {
                  user,
                  token: storedToken,
                  tokenExpiry
                }
              });
            } catch (error) {
              // Token invalid on server, clear local storage
              clearAuthData();
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          } else {
            // Token expired, try to refresh
            try {
              const refreshResult = await authService.refreshToken();
              if (refreshResult.success) {
                dispatch({
                  type: AUTH_ACTIONS.TOKEN_REFRESH,
                  payload: {
                    token: refreshResult.token,
                    tokenExpiry: refreshResult.tokenExpiry
                  }
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
        console.error('Auth initialization failed:', error);
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    initializeAuth();
  }, []);
  // Auto-refresh token before expiry
  useEffect(() => {
    if (!state.isAuthenticated || !state.tokenExpiry) return;

    const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
    const timeUntilRefresh = state.tokenExpiry - Date.now() - refreshBuffer;

    if (timeUntilRefresh > 0) {
      const refreshTimer = setTimeout(async () => {
        try {
          const refreshResult = await authService.refreshToken();
          if (refreshResult.success) {
            dispatch({
              type: AUTH_ACTIONS.TOKEN_REFRESH,
              payload: {
                token: refreshResult.token,
                tokenExpiry: refreshResult.tokenExpiry
              }
            });
            updateStoredToken(refreshResult.token, refreshResult.tokenExpiry);
          } else {
            clearAuthData();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          clearAuthData();
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      }, timeUntilRefresh);

      return () => clearTimeout(refreshTimer);
    }
  }, [state.tokenExpiry, state.isAuthenticated]);

  // Activity tracking for auto-logout
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const activityTimeout = 30 * 60 * 1000; // 30 minutes
    const checkActivity = () => {
      if (Date.now() - state.lastActivity > activityTimeout) {
        toast.info('Session expired due to inactivity');
        clearAuthData();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    const activityTimer = setInterval(checkActivity, 60000); // Check every minute
    return () => clearInterval(activityTimer);
  }, [state.lastActivity, state.isAuthenticated]);

  // Helper functions
  const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
  };

  const updateStoredToken = (token, tokenExpiry) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tokenExpiry', tokenExpiry.toString());
  };

  const updateStoredUser = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  };

  // Auth Actions
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const result = await authService.login(credentials);
      
      if (result.success) {
        const tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store in localStorage
        updateStoredToken(result.token, tokenExpiry);
        updateStoredUser(result.user);
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: result.user,
            token: result.token,
            tokenExpiry
          }
        });

        toast.success('Login successful!');
        return { success: true };
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_FAILURE,
          payload: result.error || 'Login failed'
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      toast.error(errorMessage);
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
      console.error('Logout API call failed:', error);
    } finally {
      clearAuthData();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.info('Logged out successfully');
    }
  };

  const updateActivity = () => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_ACTIVITY });
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.role === role || state.user?.roles?.includes(role);
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
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
    
    // Utilities
    hasRole,
    hasAnyRole
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
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
