// Base API service with common functionality
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  : 'http://localhost:8000';

class BaseApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Helper method to handle authentication errors
  handleAuthError(response) {
    if (response.status === 401) {
      // Clear the token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      return true;
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
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for POST requests
  async post(endpoint, data, errorMessage) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for PUT requests
  async put(endpoint, data, errorMessage) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response, errorMessage);
  }

  // Helper method for DELETE requests
  async delete(endpoint, errorMessage) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response, errorMessage);
  }
}

export default BaseApiService;
