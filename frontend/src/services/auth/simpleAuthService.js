/**
 * Simple Authentication Service for current backend
 * Works with the existing Medical Records backend API
 */

import logger from '../logger';

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
}

// Export singleton instance
export const authService = new SimpleAuthService();
export default authService;
