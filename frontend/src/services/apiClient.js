/**
 * Enhanced API Client with Authentication Integration
 * Provides centralized API communication with automatic token handling
 */
import { authService } from './auth/simpleAuthService';
import { notifyError } from '../utils/notifyTranslated';
import logger from './logger';
import { createRaceSafeWrapper } from '../utils/throttleUtils';
import secureActivityLogger from '../utils/secureActivityLogger';
import { getApiUrl } from '../config/env';

class APIClient {
  constructor() {
    this.baseURL = getApiUrl();
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Request interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];

    // Activity tracking with race condition protection
    this.activityTracker = null;
    this.safeActivityTracker = null;

    // Add default auth interceptor
    this.addRequestInterceptor(this.authInterceptor.bind(this));
    this.addResponseInterceptor(this.errorInterceptor.bind(this));
  }

  // Set activity tracker for API calls with race condition protection
  setActivityTracker(activityTracker) {
    try {
      // Clean up previous tracker
      if (this.safeActivityTracker && this.safeActivityTracker.cleanup) {
        this.safeActivityTracker.cleanup();
      }
      
      this.activityTracker = activityTracker;
      
      // Create race-safe wrapper if tracker is provided
      if (activityTracker) {
        this.safeActivityTracker = createRaceSafeWrapper(
          activityTracker,
          'api-activity-tracker'
        );
      } else {
        this.safeActivityTracker = null;
      }
    } catch (error) {
      secureActivityLogger.logActivityError(error, {
        component: 'APIClient',
        action: 'setActivityTracker'
      });
      
      // Fallback to unsafe tracker to maintain functionality
      this.activityTracker = activityTracker;
      this.safeActivityTracker = null;
    }
  }

  // Add request interceptor
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  // Add response interceptor
  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  // Auth interceptor - adds token to requests
  async authInterceptor(config) {
    const token = await authService.getToken();

    if (token && await authService.isTokenValid(token)) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  }

  // Error interceptor - handles auth errors
  async errorInterceptor(error, originalConfig) {
    if (error.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;

      try {
        // Try to refresh token
        const refreshResult = await authService.refreshToken();
        if (refreshResult.success) {
          // Update config with new token
          originalConfig.headers['Authorization'] =
            `Bearer ${refreshResult.token}`;

          // Retry original request
          return this.request(originalConfig);
        }
      } catch (refreshError) {
        logger.error('Token refresh failed', {
          category: 'api_client_error',
          error: refreshError.message,
          status: refreshError.status,
          endpoint: originalConfig.url
        });
      }

      // Clear auth data but let components handle the error gracefully
      // Only redirect if this is a critical auth endpoint
      authService.clearTokens();
      
      // Check if this is a critical endpoint that requires immediate redirect
      const criticalEndpoints = ['/auth/', '/login', '/users/me'];
      const isCriticalEndpoint = criticalEndpoints.some(endpoint => 
        originalConfig.url.includes(endpoint)
      );
      
      if (isCriticalEndpoint) {
        notifyError('notifications:toasts.auth.sessionExpiredLogin');
        window.location.href = '/login';
      } else {
        // For non-critical endpoints, just add a header to indicate auth failure
        // This allows components to handle the error appropriately
        logger.warn('Authentication failed for non-critical endpoint', {
          category: 'api_client_warning',
          endpoint: originalConfig.url,
          message: 'Authentication failed but not redirecting to preserve user experience'
        });
      }
      
      throw error;
    }

    throw error;
  }

  // Main request method
  async request(config) {
    // Apply request interceptors (declare outside try block for error logging)
    let processedConfig = { ...config };
    try {
      for (const interceptor of this.requestInterceptors) {
        processedConfig = await interceptor(processedConfig);
      } // Prepare URL
      let url = processedConfig.url.startsWith('http')
        ? processedConfig.url
        : `${this.baseURL}${processedConfig.url}`; // Add query parameters if provided
      if (processedConfig.params) {
        const urlObj = new URL(url, window.location.origin);
        Object.entries(processedConfig.params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            urlObj.searchParams.set(key, value);
          }
        });
        url = urlObj.toString();
        logger.debug('Request URL with params', {
          category: 'api_request_debug',
          url: url,
          method: processedConfig.method || 'GET',
          has_params: !!processedConfig.params
        });
      }

      // Prepare headers
      const headers = {
        ...this.defaultHeaders,
        ...processedConfig.headers,
      };

      // For FormData bodies, remove Content-Type so browser sets multipart boundary
      if (processedConfig.body instanceof FormData) {
        delete headers['Content-Type'];
      }

      // Make request
      const response = await fetch(url, {
        method: processedConfig.method || 'GET',
        headers,
        body: processedConfig.body,
        credentials: 'include', // CRITICAL: Include cookies for CORS requests
        ...processedConfig.options,
      }); // Handle response
      let data;
      const contentType = response.headers.get('content-type');

      // Check if blob response was requested
      if (processedConfig.responseType === 'blob') {
        data = await response.blob();
      } else if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const error = new Error(
          data.detail || data.message || `HTTP ${response.status}`
        );
        error.status = response.status;
        error.response = response;
        error.data = data;

        // Apply response interceptors for errors
        for (const interceptor of this.responseInterceptors) {
          try {
            return await interceptor(error, processedConfig);
          } catch (interceptorError) {
            // If interceptor throws, continue to next one
            continue;
          }
        }

        throw error;
      }

      // Track API activity for successful requests with race condition protection
      if (this.safeActivityTracker) {
        try {
          // Use race-safe wrapper
          this.safeActivityTracker({
            method: processedConfig.method || 'GET',
            status: response.status,
            // Don't log URL to prevent potential sensitive data leakage
          });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'APIClient',
            action: 'trackActivity',
            method: processedConfig.method || 'GET',
            status: response.status
          });
          
          // Fallback to direct tracker if race-safe wrapper fails
          if (this.activityTracker) {
            try {
              this.activityTracker({
                method: processedConfig.method || 'GET',
                status: response.status,
              });
            } catch (fallbackError) {
              // Log but don't throw - activity tracking failure shouldn't break API calls
              secureActivityLogger.logActivityError(fallbackError, {
                component: 'APIClient',
                action: 'trackActivity_fallback'
              });
            }
          }
        }
      } else if (this.activityTracker) {
        // Fallback to direct tracker if race-safe wrapper not available
        try {
          this.activityTracker({
            method: processedConfig.method || 'GET',
            status: response.status,
          });
        } catch (error) {
          secureActivityLogger.logActivityError(error, {
            component: 'APIClient',
            action: 'trackActivity_direct'
          });
        }
      }

      return {
        data,
        status: response.status,
        headers: response.headers,
        response,
      };
    } catch (error) {
      logger.error('API request failed', {
        category: 'api_client_error',
        error: error.message,
        status: error.status,
        url: processedConfig.url,
        method: processedConfig.method || 'GET'
      });
      throw error;
    }
  }

  // HTTP method helpers
  async get(url, config = {}) {
    return this.request({
      method: 'GET',
      url,
      ...config,
    });
  }

  async post(url, data = null, config = {}) {
    return this.request({
      method: 'POST',
      url,
      body: data ? JSON.stringify(data) : null,
      ...config,
    });
  }

  async put(url, data = null, config = {}) {
    return this.request({
      method: 'PUT',
      url,
      body: data ? JSON.stringify(data) : null,
      ...config,
    });
  }

  async patch(url, data = null, config = {}) {
    return this.request({
      method: 'PATCH',
      url,
      body: data ? JSON.stringify(data) : null,
      ...config,
    });
  }

  async delete(url, config = {}) {
    return this.request({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  // Form data helper
  async postForm(url, formData, config = {}) {
    const headers = { ...config.headers };
    delete headers['Content-Type']; // Let browser set it for FormData

    return this.request({
      method: 'POST',
      url,
      body: formData,
      headers,
      ...config,
    });
  }

  // File upload helper
  async uploadFile(url, file, additionalData = {}, config = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Add additional data to form
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.postForm(url, formData, config);
  }

  // Download file helper
  async downloadFile(url, filename = null, config = {}) {
    try {
      const response = await this.request({
        url,
        ...config,
        options: {
          ...config.options,
          // Don't parse as JSON
        },
      });

      // Create blob from response
      const blob = new Blob([response.data]);

      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Set filename
      if (filename) {
        link.download = filename;
      } else {
        // Try to get filename from headers
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            link.download = filenameMatch[1];
          }
        }
      }

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(downloadUrl);

      return response;
    } catch (error) {
      notifyError('notifications:toasts.files.downloadFailed');
      throw error;
    }
  }
}

// Create singleton instance
const apiClient = new APIClient();

// Export specific API services
export const patientsAPI = {
  getAll: (params = {}) => apiClient.get('/patients/', { params }),
  getById: id => apiClient.get(`/patients/${id}/`),
  create: data => apiClient.post('/patients/', data),
  update: (id, data) => apiClient.patch(`/patients/${id}/`, data),
  delete: id => apiClient.delete(`/patients/${id}/`),
  search: query =>
    apiClient.get(`/patients/search/?q=${encodeURIComponent(query)}`),
};

export const medicationsAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/medications/?patient_id=${patientId}`
      : '/medications/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/medications/${id}/`),
  create: data => apiClient.post('/medications/', data),
  update: (id, data) => apiClient.patch(`/medications/${id}/`, data),
  delete: id => apiClient.delete(`/medications/${id}/`),
};

export const allergiesAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/allergies/?patient_id=${patientId}`
      : '/allergies/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/allergies/${id}/`),
  create: data => apiClient.post('/allergies/', data),
  update: (id, data) => apiClient.patch(`/allergies/${id}/`, data),
  delete: id => apiClient.delete(`/allergies/${id}/`),
};

export const conditionsAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/conditions/?patient_id=${patientId}`
      : '/conditions/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/conditions/${id}/`),
  create: data => apiClient.post('/conditions/', data),
  update: (id, data) => apiClient.patch(`/conditions/${id}/`, data),
  delete: id => apiClient.delete(`/conditions/${id}/`),
};

export const labResultsAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/lab-results/?patient_id=${patientId}`
      : '/lab-results/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/lab-results/${id}`),
  create: data => apiClient.post('/lab-results/', data),
  update: (id, data) => apiClient.put(`/lab-results/${id}`, data),
  delete: id => apiClient.delete(`/lab-results/${id}`),
  uploadFile: (labResultId, file) => {
    return apiClient.uploadFile(
      `/lab-result-files/upload/${labResultId}`,
      file
    );
  },
  downloadFile: (labResultId, fileId) => {
    return apiClient.downloadFile(`/lab-result-files/${fileId}/download`);
  },
};

export const immunizationsAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/immunizations/?patient_id=${patientId}`
      : '/immunizations/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/immunizations/${id}/`),
  create: data => apiClient.post('/immunizations/', data),
  update: (id, data) => apiClient.patch(`/immunizations/${id}/`, data),
  delete: id => apiClient.delete(`/immunizations/${id}/`),
};

export const proceduresAPI = {
  getAll: (patientId = null) => {
    const url = patientId
      ? `/procedures/?patient_id=${patientId}`
      : '/procedures/';
    return apiClient.get(url);
  },
  getById: id => apiClient.get(`/procedures/${id}/`),
  create: data => apiClient.post('/procedures/', data),
  update: (id, data) => apiClient.patch(`/procedures/${id}/`, data),
  delete: id => apiClient.delete(`/procedures/${id}/`),
};

export const authAPI = {
  login: credentials => authService.login(credentials),
  logout: () => authService.logout(),
  register: userData => authService.register(userData),
  getCurrentUser: () => authService.getCurrentUser(),
  refreshToken: () => authService.refreshToken(),
  forgotPassword: email => authService.forgotPassword(email),
  resetPassword: (token, password) =>
    authService.resetPassword(token, password),
  changePassword: (currentPassword, newPassword) =>
    authService.changePassword(currentPassword, newPassword),
};

export const adminAPI = {
  getUsers: () => apiClient.get('/admin/users/'),
  getUserById: id => apiClient.get(`/admin/users/${id}/`),
  createUser: data => apiClient.post('/admin/users/', data),
  updateUser: (id, data) => apiClient.patch(`/admin/users/${id}/`, data),
  deleteUser: id => apiClient.delete(`/admin/users/${id}/`),
  getSystemStats: () => apiClient.get('/admin/stats/'),
  getLogs: (params = {}) => apiClient.get('/admin/logs/', { params }),
  getAuditTrail: (params = {}) => apiClient.get('/admin/audit/', { params }),
};

// Export main client and individual APIs
export { apiClient };
export default apiClient;
