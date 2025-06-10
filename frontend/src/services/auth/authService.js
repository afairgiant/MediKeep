/**
 * Authentication service for handling login, logout, and token management
 */

import { apiService } from '../api';

class AuthService {
  constructor() {
    this.tokenKey = 'token';
    this.userKey = 'user';
  }

  /**
   * Login user with credentials
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<Object>} Login response
   */
  async login(username, password) {
    try {
      const response = await apiService.login(username, password);
      
      if (response.access_token) {
        this.setToken(response.access_token);
        
        // Get user data after login
        const userData = await apiService.getCurrentPatient();
        this.setUser(userData);
        
        return { success: true, user: userData };
      }
      
      throw new Error('No access token received');
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Logout user and clear stored data
   */
  logout() {
    this.removeToken();
    this.removeUser();
    window.location.href = '/login';
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    
    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get stored authentication token
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Store authentication token
   * @param {string} token 
   */
  setToken(token) {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Remove authentication token
   */
  removeToken() {
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Get stored user data
   * @returns {Object|null}
   */
  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Store user data
   * @param {Object} user 
   */
  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  /**
   * Remove stored user data
   */
  removeUser() {
    localStorage.removeItem(this.userKey);
  }

  /**
   * Get authorization headers for API requests
   * @returns {Object}
   */
  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string>} New token
   */
  async refreshToken() {
    try {
      // Implementation depends on your backend refresh token strategy
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.setToken(data.access_token);
      return data.access_token;
    } catch (error) {
      this.logout();
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService;
