import BaseApiService from './baseApi';

class AuthApiService extends BaseApiService {
  // Login method
  async login(username, password) {
    try {
      const url = `${this.baseURL}/api/v1/auth/login`;
      console.log('Making login request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }      throw error;
    }
  }

  // Register method
  async register(username, password, email, fullName) {
    try {
      const url = `${this.baseURL}/api/v1/auth/register`;
      console.log('Making register request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          email,
          full_name: fullName,
          role: 'user' // Default role
        })
      });

      console.log('Response status:', response.status);      if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
          const error = await response.json();
          if (error.detail) {
            // Handle specific error messages from the backend
            if (error.detail.includes('Username already registered')) {
              errorMessage = 'Username already exists. Please choose a different username.';
            } else if (error.detail.includes('Email already registered')) {
              errorMessage = 'Email already exists. Please use a different email address.';
            } else {
              errorMessage = error.detail;
            }
          } else {
            errorMessage = error.message || errorMessage;
          }
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }
  }
}

export default AuthApiService;
