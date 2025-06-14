/**
 * Enhanced Authentication Service
 * Handles all authentication operations with proper error handling and token management
 */

class AuthenticationService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '/api/v1';
    this.tokenKey = 'auth_token';
    this.userKey = 'auth_user';
    this.refreshTokenKey = 'refresh_token';
  }

  // Token utilities
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setRefreshToken(token) {
    if (token) {
      localStorage.setItem(this.refreshTokenKey, token);
    } else {
      localStorage.removeItem(this.refreshTokenKey);
    }
  }

  // Parse JWT token
  parseJWT(token) {
    try {
      if (!token || token.split('.').length !== 3) {
        return null;
      }
      
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
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  // Check if token is valid
  isTokenValid(token = null) {
    const targetToken = token || this.getToken();
    if (!targetToken) return false;

    const payload = this.parseJWT(targetToken);
    if (!payload) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  }

  // Get token expiry time
  getTokenExpiry(token = null) {
    const targetToken = token || this.getToken();
    if (!targetToken) return null;

    const payload = this.parseJWT(targetToken);
    if (!payload) return null;

    return payload.exp * 1000; // Convert to milliseconds
  }

  // Create authenticated headers
  getAuthHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token && this.isTokenValid(token)) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // API request wrapper with auth handling
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle authentication errors
      if (response.status === 401) {
        // Try to refresh token first
        const refreshResult = await this.refreshToken();
        if (refreshResult.success) {
          // Retry the original request with new token
          const newHeaders = {
            ...this.getAuthHeaders(),
            ...options.headers,
          };
          
          const retryResponse = await fetch(url, {
            ...options,
            headers: newHeaders,
          });
          
          if (retryResponse.ok) {
            return await retryResponse.json();
          }
        }
        
        // If refresh failed or retry failed, throw auth error
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Login user
  async login(credentials) {
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.detail || 'Login failed'
        };
      }

      const data = await response.json();
      
      if (!data.access_token) {
        return {
          success: false,
          error: 'No access token received'
        };
      }

      // Validate token
      if (!this.isTokenValid(data.access_token)) {
        return {
          success: false,
          error: 'Received invalid token'
        };
      }

      // Store tokens
      this.setToken(data.access_token);
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }

      // Extract user info from token
      const payload = this.parseJWT(data.access_token);
      const user = {
        id: payload.user_id,
        username: payload.sub,
        role: payload.role || 'user',
        fullName: payload.full_name || payload.sub,
        email: payload.email || '',
        isAdmin: ['admin', 'administrator'].includes((payload.role || '').toLowerCase())
      };

      localStorage.setItem(this.userKey, JSON.stringify(user));

      return {
        success: true,
        user,
        token: data.access_token,
        tokenExpiry: this.getTokenExpiry(data.access_token)
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  // Register user
  async register(userData) {
    try {      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.detail || errorData.message || 'Registration failed'
        };
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }
  // Get current user
  async getCurrentUser() {
    try {
      // First try to get from localStorage
      const storedUser = localStorage.getItem(this.userKey);
      if (storedUser) {
        const user = JSON.parse(storedUser);
        
        // Verify with server if token is still valid
        if (this.isTokenValid()) {
          try {
            const serverUser = await this.apiRequest('/users/me');
            return serverUser;
          } catch (error) {
            // If server call fails but token is valid, return stored user
            console.warn('Server user fetch failed, using cached user:', error);
            return user;
          }
        }
      }

      // Get from server
      const user = await this.apiRequest('/users/me');
      localStorage.setItem(this.userKey, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }
  // Refresh token (not implemented in current backend)
  async refreshToken() {
    try {
      console.warn('Token refresh not implemented in current backend');
      return { success: false, error: 'Token refresh not available' };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: error.message };
    }
  }
  // Logout user
  async logout() {
    try {
      // Note: Backend logout endpoint not implemented, just clear local storage
      console.info('Logging out user (clearing local storage)');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local storage
      this.clearTokens();
    }
  }

  // Clear all auth data
  clearTokens() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.refreshTokenKey);
  }
  // Forgot password (not implemented in current backend)
  async forgotPassword(email) {
    try {
      console.warn('Forgot password not implemented in current backend');
      return {
        success: false,
        error: 'Password reset not available in current backend'
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send password reset email'
      };
    }
  }

  // Reset password (not implemented in current backend)
  async resetPassword(token, newPassword) {
    try {
      console.warn('Reset password not implemented in current backend');
      return {
        success: false,
        error: 'Password reset not available in current backend'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: error.message || 'Password reset failed'
      };
    }
  }

  // Change password (not implemented in current backend)
  async changePassword(currentPassword, newPassword) {
    try {
      console.warn('Change password not implemented in current backend');
      return {
        success: false,
        error: 'Password change not available in current backend'
      };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: error.message || 'Password change failed'
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthenticationService();
export default authService;
