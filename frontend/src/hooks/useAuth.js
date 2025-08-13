/**
 * Modern Authentication Hook
 * Centralized authentication state management with automatic token handling
 */
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { useNavigate } from 'react-router-dom';
import logger from '../services/logger';
import { isAdminRole } from '../utils/authUtils';

// Auth Context
const AuthContext = createContext(null);

// Token utilities
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

class TokenManager {
  static getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  static setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  static removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  static isTokenValid(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if token is expired (with 30 second buffer)
      return payload.exp > currentTime + 30;
    } catch (error) {
      logger.error('Invalid token format', {
        category: 'auth_token_error',
        error: error.message,
        token_exists: !!token
      });
      return false;
    }
  }

  static getTokenPayload(token) {
    if (!token) return null;

    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      logger.error('Error parsing token payload', {
        category: 'auth_token_error',
        error: error.message,
        token_exists: !!token
      });
      return null;
    }
  }

  static getTokenExpiry(token) {
    const payload = this.getTokenPayload(token);
    return payload ? payload.exp : null;
  }

  static isTokenExpiringSoon(token, bufferMinutes = 5) {
    const payload = this.getTokenPayload(token);
    if (!payload) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    const bufferSeconds = bufferMinutes * 60;

    return payload.exp < currentTime + bufferSeconds;
  }
}

// Authentication Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const storedToken = TokenManager.getToken();

      if (!storedToken || !TokenManager.isTokenValid(storedToken)) {
        // No valid token, clear everything
        TokenManager.removeToken();
        setToken(null);
        setUser(null);
        return;
      }

      // Token is valid, extract user info
      const payload = TokenManager.getTokenPayload(storedToken);
      if (payload) {
        const userData = {
          id: payload.user_id,
          username: payload.sub,
          role: payload.role || 'user',
          fullName: payload.full_name || payload.sub,
          isAdmin: isAdminRole(payload.role),
        };

        setToken(storedToken);
        setUser(userData);

        // Store user data
        localStorage.setItem(USER_KEY, JSON.stringify(userData));

        // Check if token is expiring soon
        if (TokenManager.isTokenExpiringSoon(storedToken)) {
          logger.warn('Token expires soon, consider implementing refresh', {
            category: 'auth_warning',
            token_expiry: payload.exp,
            current_time: Math.floor(Date.now() / 1000)
          });
          // Token refresh not implemented - user will need to log in again when token expires
        }
      }
    } catch (error) {
      logger.error('Error initializing auth', {
        category: 'auth_init_error',
        error: error.message,
        has_stored_token: !!TokenManager.getToken()
      });
      TokenManager.removeToken();
      setError('Authentication initialization failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Login function
  const login = useCallback(
    async (username, password) => {
      try {
        setLoading(true);
        setError(null);

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Login failed');
        }

        const data = await response.json();

        if (!data.access_token) {
          throw new Error('No access token received');
        }

        // Validate token
        if (!TokenManager.isTokenValid(data.access_token)) {
          throw new Error('Received invalid token');
        }

        // Store token and initialize user
        TokenManager.setToken(data.access_token);
        await initializeAuth();

        return { success: true };
      } catch (error) {
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [initializeAuth]
  );

  // Logout function
  const logout = useCallback(() => {
    TokenManager.removeToken();
    setToken(null);
    setUser(null);
    setError(null);
    navigate('/login');
  }, [navigate]);

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    const currentToken = token || TokenManager.getToken();
    return currentToken && TokenManager.isTokenValid(currentToken);
  }, [token]);

  // Check if user has admin role
  const isAdmin = useCallback(() => {
    return user?.isAdmin || false;
  }, [user]);

  // Get auth headers for API requests
  const getAuthHeaders = useCallback(() => {
    const currentToken = token || TokenManager.getToken();

    if (currentToken && TokenManager.isTokenValid(currentToken)) {
      return {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      };
    }

    return {
      'Content-Type': 'application/json',
    };
  }, [token]);

  // Handle authentication errors
  const handleAuthError = useCallback(
    (error, response) => {
      if (response?.status === 401) {
        logger.warn('Authentication failed, logging out', {
          category: 'auth_warning',
          status: response?.status,
          error_type: 'authentication_failed'
        });
        logout();
        return true;
      }
      return false;
    },
    [logout]
  );

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up token expiration check
  useEffect(() => {
    if (!token) return;

    const checkTokenExpiration = () => {
      if (!TokenManager.isTokenValid(token)) {
        logger.warn('Token expired, logging out', {
          category: 'auth_warning',
          error_type: 'token_expired'
        });
        logout();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiration, 60000);

    return () => clearInterval(interval);
  }, [token, logout]);

  const value = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    getAuthHeaders,
    handleAuthError,
    initializeAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export token manager for direct use
export { TokenManager };
