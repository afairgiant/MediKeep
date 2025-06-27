/**
 * Simple Authentication Service for current backend
 * Works with the existing Medical Records backend API
 */

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
        console.log(`Attempting request ${i + 1}/${urls.length}: ${url}`);

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000);
        });

        const fetchPromise = fetch(url, options);
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        console.log(
          `Response from ${url}: ${response.status} ${response.statusText}`
        );

        // Return response regardless of status (let caller handle HTTP errors)
        return response;
      } catch (error) {
        console.warn(`Failed to connect to ${url}:`, error.message);
        lastError = error;

        // Continue to next URL if this one fails
        if (i < urls.length - 1) {
          console.log(`Trying next URL...`);
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
      console.error('Error parsing JWT:', error);
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
      console.log('Attempting login for:', credentials.username);

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

      console.log('Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Login failed:', errorData);
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}: Login failed`,
        };
      }

      const data = await response.json();
      console.log('Login successful, received data:', {
        hasToken: !!data.access_token,
        tokenType: data.token_type,
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
      console.log('Token payload:', payload);

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
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Network error during login',
      };
    }
  } // Register user
  async register(userData) {
    try {
      console.log('Attempting registration for:', userData.username);

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

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Registration failed:', errorData);
        return {
          success: false,
          error: errorData.detail || errorData.message || 'Registration failed',
        };
      }

      const data = await response.json();
      console.log('Registration successful');

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Registration error:', error);
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
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Logout user
  async logout() {
    try {
      console.log('Logging out user');
      this.clearTokens();
    } catch (error) {
      console.error('Logout error:', error);
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
}

// Export singleton instance
export const authService = new SimpleAuthService();
export default authService;
