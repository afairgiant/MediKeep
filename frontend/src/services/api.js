// API service for making requests to FastAPI backend
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  : ''; // Use proxy in development

class ApiService {
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
  // Login method
  async login(username, password) {
    const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username,
        password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  }

  // Get current user/patient info
  async getCurrentPatient() {
    const response = await fetch(`${this.baseURL}/api/v1/patients/me`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  }

  // Get recent activity (you'll need to implement this endpoint in FastAPI)
  async getRecentActivity() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/activity/recent`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        return []; // Return empty array if endpoint doesn't exist yet
      }

      return response.json();
    } catch (error) {
      console.log('Recent activity endpoint not implemented yet');
      return [];
    }
  }

  // Get lab results
  async getLabResults() {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lab results');
    }

    return response.json();
  }

  // Get medications
  async getMedications() {
    const response = await fetch(`${this.baseURL}/api/v1/medications`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch medications');
    }

    return response.json();
  }

  // Add more API methods as needed for other endpoints
}

export const apiService = new ApiService();
export default apiService;
