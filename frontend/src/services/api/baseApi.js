// Base API service with common functionality
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  : 'http://localhost:8000';

class BaseApiService {
  constructor(basePath = '') {
    this.baseURL = API_BASE_URL;
    this.basePath = basePath;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }  // Helper method to handle authentication errors
  handleAuthError(response) {
    // Only redirect to login on 401 if it's clearly an authentication issue
    if (response.status === 401) {
      // Check if this is an admin access error vs general auth error
      const url = response.url;
      if (url && url.includes('/admin/')) {
        // For admin endpoints, don't automatically redirect - let the component handle it
        console.warn('Admin access denied - insufficient privileges');
        return false; // Don't redirect, let calling code handle
      }
      
      // For non-admin 401s, be less aggressive - only redirect if the token is clearly invalid
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          // No token, definitely need to login
          localStorage.removeItem('token');
          window.location.href = '/login';
          return true;
        }
        
        // Check if token is expired
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        if (payload.exp < currentTime) {
          // Token expired, redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
          return true;
        }
        
        // Token exists and isn't expired, don't redirect - might be a temporary error
        console.warn('401 error but token seems valid, not redirecting');
        return false;
        
      } catch (e) {
        // Can't decode token, probably invalid
        localStorage.removeItem('token');
        window.location.href = '/login';
        return true;
      }
    }
    // Don't treat rate limiting (429) as authentication error
    if (response.status === 429) {
      return false; // Let the calling code handle rate limiting
    }
    return false;
  }
  // Helper method to handle common API response patterns
  async handleResponse(response, errorMessage = 'API request failed') {
    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      // Handle rate limiting specifically
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
      }
      
      const error = await response.json().catch(() => ({}));
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || errorMessage);
    }

    return response.json();
  }
  // Helper method for GET requests
  async get(endpoint, errorMessage) {
    const response = await fetch(`${this.baseURL}${this.basePath}${endpoint}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for POST requests
  async post(endpoint, data, errorMessage) {
    const response = await fetch(`${this.baseURL}${this.basePath}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for PUT requests
  async put(endpoint, data, errorMessage) {
    const response = await fetch(`${this.baseURL}${this.basePath}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for DELETE requests
  async delete(endpoint, errorMessage) {
    const response = await fetch(`${this.baseURL}${this.basePath}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response, errorMessage);
  }
}

export default BaseApiService;
