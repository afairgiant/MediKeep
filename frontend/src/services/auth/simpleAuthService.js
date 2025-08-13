/**
 * Simple Authentication Service for current backend
 * Works with the existing Medical Records backend API
 */

import logger from '../logger';
import { isAdminRole } from '../../utils/authUtils';

class SimpleAuthService {
  constructor() {
    // Try to use the proxy first, fallback to direct backend
    this.baseURL =
      process.env.NODE_ENV === 'development'
        ? '/api/v1' // Use proxy in development
        : '/api/v1'; // Use relative path in production
    this.directBackendURL =
      process.env.NODE_ENV === 'production'
        ? '/api/v1'
        : 'http://localhost:8000/api/v1'; // Fallback for development
    this.tokenKey = 'token';
    this.userKey = 'user';
  } // Make API request with fallback
  async makeRequest(endpoint, options = {}) {
    const urls = [
      `${this.directBackendURL}${endpoint}`, // Try direct backend first
      `${this.baseURL}${endpoint}`, // Then try proxy
    ];

    let lastError = null;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        logger.info(`Attempting request ${i + 1}/${urls.length}`, { 
          url, 
          attempt: i + 1, 
          totalUrls: urls.length,
          category: 'auth_connection'
        });

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000);
        });

        const fetchPromise = fetch(url, options);
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        logger.info(`Response received from ${url}`, {
          url,
          status: response.status,
          statusText: response.statusText,
          category: 'auth_connection'
        });

        // Return response regardless of status (let caller handle HTTP errors)
        return response;
      } catch (error) {
        logger.warn(`Failed to connect to ${url}`, {
          url,
          error: error.message,
          category: 'auth_connection_failure'
        });
        lastError = error;

        // Continue to next URL if this one fails
        if (i < urls.length - 1) {
          logger.info(`Trying next URL in fallback sequence`, {
            failedUrl: url,
            nextAttempt: i + 2,
            category: 'auth_connection'
          });
          continue;
        }
      }
    }

    // If all URLs failed, throw the last error
    throw new Error(
      `All API endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  // Get stored token
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  // Set token
  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  // Parse JWT payload
  parseJWT(token) {
    try {
      if (!token || token.split('.').length !== 3) return null;

      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      logger.error('Error parsing JWT token', {
        error: error.message,
        category: 'auth_token_parse_error'
      });
      return null;
    }
  }

  // Check if token is valid (not expired)
  isTokenValid(token = null) {
    const targetToken = token || this.getToken();
    if (!targetToken) return false;

    const payload = this.parseJWT(targetToken);
    if (!payload || !payload.exp) return false;

    return payload.exp > Math.floor(Date.now() / 1000);
  }
  // Login user
  async login(credentials) {
    try {
      logger.info('Attempting user login', {
        username: credentials.username,
        category: 'auth_login_attempt'
      });

      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);

      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      logger.info('Login response received', {
        status: response.status,
        statusText: response.statusText,
        category: 'auth_login_response'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Login failed', {
          status: response.status,
          errorData,
          category: 'auth_login_failure'
        });
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}: Login failed`,
        };
      }

      const data = await response.json();
      logger.info('Login successful', {
        hasToken: !!data.access_token,
        tokenType: data.token_type,
        category: 'auth_login_success'
      });

      if (!data.access_token) {
        return {
          success: false,
          error: 'No access token received',
        };
      }

      // Store token
      this.setToken(data.access_token);

      // Extract user info from token
      const payload = this.parseJWT(data.access_token);
      logger.info('Token payload extracted from access token', {
        userId: payload?.user_id,
        username: payload?.sub,
        role: payload?.role,
        hasExpiry: !!payload?.exp,
        category: 'auth_token_info'
      });

      const user = {
        id: payload.user_id,
        username: payload.sub,
        role: payload.role || 'user',
        fullName: payload.full_name || payload.sub,
        isAdmin: payload.role === 'admin',
      };

      // Store user
      localStorage.setItem(this.userKey, JSON.stringify(user));

      return {
        success: true,
        user,
        token: data.access_token,
        tokenExpiry: payload.exp * 1000, // Convert to milliseconds
      };
    } catch (error) {
      logger.error('Login error occurred', {
        error: error.message,
        errorType: error.constructor.name,
        category: 'auth_login_error'
      });
      return {
        success: false,
        error: error.message || 'Network error during login',
      };
    }
  } // Register user
  async register(userData) {
    try {
      logger.info('Attempting user registration', {
        username: userData.username,
        role: userData.role || 'user',
        hasEmail: !!userData.email,
        category: 'auth_registration_attempt'
      });

      // Add default role if not provided
      const registrationData = {
        ...userData,
        role: userData.role || 'user', // Default to 'user' role
      };

      const response = await this.makeRequest('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      logger.info('Registration response received', {
        status: response.status,
        statusText: response.statusText,
        username: userData.username,
        category: 'auth_registration_attempt'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Registration failed', {
          status: response.status,
          errorData,
          username: userData.username,
          category: 'auth_registration_failure'
        });
        return {
          success: false,
          error: errorData.detail || errorData.message || 'Registration failed',
        };
      }

      const data = await response.json();
      logger.info('Registration successful', {
        username: userData.username,
        userId: data?.id || data?.user_id,
        category: 'auth_registration_success'
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('Registration error occurred', {
        error: error.message,
        errorType: error.constructor.name,
        username: userData.username,
        category: 'auth_registration_failure'
      });
      return {
        success: false,
        error: error.message || 'Network error during registration',
      };
    }
  }

  // Get current user (from localStorage since /users/me has issues)
  async getCurrentUser() {
    try {
      const storedUser = localStorage.getItem(this.userKey);
      if (storedUser && this.isTokenValid()) {
        return JSON.parse(storedUser);
      }
      return null;
    } catch (error) {
      logger.error('Error retrieving current user from storage', {
        error: error.message,
        errorType: error.constructor.name,
        hasToken: !!this.getToken(),
        isTokenValid: this.isTokenValid(),
        category: 'auth_user_fetch_error'
      });
      return null;
    }
  }

  // Logout user
  async logout() {
    try {
      logger.info('Logging out user', {
        hadToken: !!this.getToken(),
        category: 'auth_logout'
      });
      this.clearTokens();
    } catch (error) {
      logger.error('Error during logout process', {
        error: error.message,
        errorType: error.constructor.name,
        category: 'auth_logout'
      });
    }
  }

  // Clear all auth data
  clearTokens() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Get auth headers for API requests
  getAuthHeaders() {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };

    if (token && this.isTokenValid(token)) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Check if user registration is enabled
  async checkRegistrationEnabled() {
    try {
      const response = await this.makeRequest('/auth/registration-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        logger.error('Failed to check registration status', {
          status: response.status,
          category: 'auth_registration_check'
        });
        // Default to enabled if check fails
        return { registration_enabled: true };
      }

      const data = await response.json();
      logger.info('Registration status checked', {
        enabled: data.registration_enabled,
        category: 'auth_registration_check'
      });
      return data;
    } catch (error) {
      logger.error('Error checking registration status', {
        error: error.message,
        category: 'auth_registration_check'
      });
      // Default to enabled if check fails to avoid blocking users
      return { registration_enabled: true };
    }
  }

  // SSO Methods

  // Check if SSO is available and get configuration
  async getSSOConfig() {
    try {
      logger.info('Checking SSO configuration', {
        category: 'sso_config_check'
      });

      const response = await this.makeRequest('/auth/sso/config', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        logger.warn('Failed to get SSO config', {
          status: response.status,
          category: 'sso_config_check'
        });
        return { enabled: false };
      }

      const data = await response.json();
      logger.info('SSO configuration retrieved', {
        enabled: data.enabled,
        provider: data.provider_type,
        registration_enabled: data.registration_enabled,
        category: 'sso_config_check'
      });
      return data;
    } catch (error) {
      logger.error('Error checking SSO config', {
        error: error.message,
        category: 'sso_config_check'
      });
      return { enabled: false };
    }
  }

  // Initiate SSO login
  async initiateSSOLogin(returnUrl = null) {
    try {
      logger.info('Initiating SSO login', {
        returnUrl,
        category: 'sso_initiate'
      });

      const params = new URLSearchParams();
      if (returnUrl) {
        params.append('return_url', returnUrl);
      }

      const url = `/auth/sso/initiate${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Failed to initiate SSO', {
          status: response.status,
          errorData,
          category: 'sso_initiate'
        });
        throw new Error(errorData.detail || 'Failed to start SSO authentication');
      }

      const data = await response.json();
      logger.info('SSO initiation successful', {
        provider: data.provider,
        hasAuthUrl: !!data.auth_url,
        category: 'sso_initiate'
      });

      return data;
    } catch (error) {
      logger.error('SSO initiation error', {
        error: error.message,
        category: 'sso_initiate'
      });
      throw error;
    }
  }

  // Complete SSO authentication from callback
  async completeSSOAuth(code, state) {
    try {
      logger.info('Completing SSO authentication', {
        hasCode: !!code,
        hasState: !!state,
        category: 'sso_callback'
      });

      const params = new URLSearchParams();
      params.append('code', code);
      params.append('state', state);

      const response = await this.makeRequest(`/auth/sso/callback?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('SSO callback failed', {
          status: response.status,
          errorData,
          category: 'sso_callback'
        });
        
        // Handle specific SSO errors
        if (errorData.error_code === 'REGISTRATION_DISABLED') {
          throw new Error(errorData.message || 'Registration is disabled');
        }
        
        throw new Error(errorData.message || 'SSO authentication failed');
      }

      const data = await response.json();
      
      // Check if this is a conflict response
      if (data.conflict) {
        logger.info('SSO conflict detected', {
          hasExistingUser: !!data.existing_user_info,
          hasSSOUser: !!data.sso_user_info,
          category: 'sso_callback'
        });
        
        return {
          success: true,
          conflict: true,
          existing_user_info: data.existing_user_info,
          sso_user_info: data.sso_user_info,
          temp_token: data.temp_token
        };
      }
      
      logger.info('SSO authentication successful', {
        isNewUser: data.is_new_user,
        authMethod: data.user?.auth_method,
        category: 'sso_callback'
      });

      // Store token and user (same as regular login)
      if (data.access_token) {
        this.setToken(data.access_token);
        localStorage.setItem(this.userKey, JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          fullName: data.user.full_name,
          role: data.user.role,
          authMethod: data.user.auth_method,
          isAdmin: data.user.role === 'admin',
        }));
      }

      return {
        success: true,
        user: data.user,
        token: data.access_token,
        isNewUser: data.is_new_user,
      };
    } catch (error) {
      logger.error('SSO callback error', {
        error: error.message,
        category: 'sso_callback'
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Test SSO connection (admin function)
  async testSSOConnection() {
    try {
      logger.info('Testing SSO connection', {
        category: 'sso_test'
      });

      const response = await this.makeRequest('/auth/sso/test-connection', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        logger.error('SSO connection test failed', {
          status: response.status,
          category: 'sso_test'
        });
        return { success: false, message: 'Connection test failed' };
      }

      const data = await response.json();
      logger.info('SSO connection test result', {
        success: data.success,
        category: 'sso_test'
      });
      return data;
    } catch (error) {
      logger.error('SSO connection test error', {
        error: error.message,
        category: 'sso_test'
      });
      return { success: false, message: error.message };
    }
  }

  // Resolve SSO account conflict
  async resolveSSOConflict(tempToken, action, preference) {
    try {
      logger.info('Resolving SSO account conflict', {
        action,
        preference,
        category: 'sso_conflict'
      });

      const response = await this.makeRequest('/auth/sso/resolve-conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          temp_token: tempToken,
          action: action,
          preference: preference
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('SSO conflict resolution failed', {
          status: response.status,
          error: errorData,
          category: 'sso_conflict'
        });
        
        return { 
          success: false, 
          error: errorData.detail?.message || errorData.detail || 'Failed to resolve account conflict' 
        };
      }

      const data = await response.json();
      
      logger.info('SSO conflict resolved successfully', {
        hasToken: !!data.access_token,
        hasUser: !!data.user,
        category: 'sso_conflict'
      });

      // Prepare the result in the expected format
      return {
        success: true,
        user: {
          ...data.user,
          // Ensure isAdmin property is set based on role
          isAdmin: isAdminRole(data.user.role)
        },
        token: data.access_token,
        isNewUser: data.is_new_user
      };

    } catch (error) {
      logger.error('SSO conflict resolution error', {
        error: error.message,
        category: 'sso_conflict'
      });
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const authService = new SimpleAuthService();
export default authService;
