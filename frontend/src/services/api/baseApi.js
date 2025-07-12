// Base API service with common functionality
import logger from '../logger';
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_API_URL || '' // Use relative URLs in production
    : 'http://localhost:8000/api/v1';

class BaseApiService {
  constructor(basePath = '') {
    this.baseURL = API_BASE_URL;
    this.basePath = basePath;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentRequests = 3; // Limit concurrent requests
    this.activeRequests = 0;
    this.tokenRefreshPromise = null;
  }

  // Helper method to get auth headers with validation
  getAuthHeaders() {
    const token = localStorage.getItem('token');

    // Validate token before using it
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        // Check if token expires soon (within 5 minutes)
        if (payload.exp - currentTime < 300) {
          logger.warn('api_token_warning', {
            message: 'Token expires soon, consider refresh',
            expiresIn: payload.exp - currentTime,
            currentTime
          });
        }

        // Check if token is already expired
        if (payload.exp < currentTime) {
          logger.error('api_token_error', {
            message: 'Token expired, removing',
            tokenExpired: payload.exp,
            currentTime
          });
          localStorage.removeItem('token');
          return { 'Content-Type': 'application/json' };
        }
      } catch (e) {
        logger.error('api_token_error', {
          message: 'Invalid token, removing',
          error: e.message,
          action: 'token_removed'
        });
        localStorage.removeItem('token');
        return { 'Content-Type': 'application/json' };
      }
    }

    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Queue management for preventing concurrent request issues
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (
      this.isProcessingQueue ||
      this.activeRequests >= this.maxConcurrentRequests
    ) {
      return;
    }

    this.isProcessingQueue = true;

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.maxConcurrentRequests
    ) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      this.activeRequests++;

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.activeRequests--;
        // Small delay to prevent request flooding
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.isProcessingQueue = false;

    // Continue processing if there are more requests
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  } // Enhanced authentication error handling
  handleAuthError(response) {
    const timestamp = new Date().toISOString();
    logger.info('api_auth_handler', {
      message: 'Auth error handler called',
      timestamp,
      status: response.status,
      url: response.url,
      activeRequests: this.activeRequests
    });

    if (response.status === 401) {
      const url = response.url;

      // For admin endpoints, be more lenient due to concurrent request issues
      if (url && url.includes('/admin/')) {
        logger.warn('api_admin_access_denied', {
          message: 'Admin access denied - checking token validity',
          url,
          activeRequests: this.activeRequests
        });

        try {
          const token = localStorage.getItem('token');
          if (!token) {
            logger.error('api_auth_error', {
              message: 'No token found for admin request',
              url,
              action: 'redirect_to_login'
            });
            localStorage.removeItem('token');
            window.location.href = '/login';
            return true;
          }

          const payload = JSON.parse(atob(token.split('.')[1]));
          const currentTime = Date.now() / 1000;

          if (payload.exp < currentTime) {
            logger.error('api_auth_error', {
              message: 'Token expired for admin request',
              tokenExpired: payload.exp,
              currentTime,
              url,
              action: 'redirect_to_login'
            });
            localStorage.removeItem('token');
            window.location.href = '/login';
            return true;
          }

          // Token is valid but got 401 - likely concurrent request issue
          logger.warn('api_admin_access_denied', {
            message: 'Valid token but 401 on admin endpoint - concurrent request issue',
            url,
            tokenValid: true,
            activeRequests: this.activeRequests,
            action: 'retry_will_handle'
          });
          return false; // Don't redirect, let retry logic handle it
        } catch (e) {
          logger.error('api_auth_error', {
            message: 'Token decode error',
            error: e.message,
            url,
            action: 'redirect_to_login'
          });
          localStorage.removeItem('token');
          window.location.href = '/login';
          return true;
        }
      }

      // For non-admin endpoints, handle normally
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return true;
        }

        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        if (payload.exp < currentTime) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return true;
        }

        logger.warn('api_auth_error', {
          message: '401 error but token seems valid, not redirecting',
          status: response.status,
          url: response.url,
          tokenValid: true,
          action: 'no_redirect'
        });
        return false;
      } catch (e) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return true;
      }
    }

    if (response.status === 429) {
      logger.warn('api_rate_limit', {
        message: 'Rate limit detected',
        status: response.status,
        url: response.url
      });
      return false;
    }

    return false;
  } // Enhanced response handling with retry logic
  async handleResponse(
    response,
    errorMessage = 'API request failed',
    retryCount = 0
  ) {
    const maxRetries = 2;

    if (!response.ok) {
      // Handle auth errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }

      // For 401 errors on admin endpoints with valid tokens, retry once
      if (
        response.status === 401 &&
        response.url?.includes('/admin/') &&
        retryCount < maxRetries
      ) {
        logger.info('api_retry', {
          message: 'Retrying request due to concurrent auth issue',
          attempt: retryCount + 1,
          maxRetries,
          url: response.url
        });
        await new Promise(resolve =>
          setTimeout(resolve, 200 + retryCount * 100)
        ); // Backoff delay

        // Retry the original request
        const url = response.url.replace(this.baseURL + this.basePath, '');
        return this.get(url, errorMessage);
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(
          `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
        );
      }

      const error = await response.json().catch(() => ({}));

      // Handle validation errors
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }

      throw new Error(error.detail || errorMessage);
    }

    return response.json();
  }

  // Enhanced GET method with queuing
  async get(endpoint, errorMessage) {
    return this.queueRequest(async () => {
      const timestamp = new Date().toISOString();
      logger.debug('api_request', {
        message: 'GET request queued',
        timestamp,
        endpoint: `${this.basePath}${endpoint}`,
        method: 'GET'
      });

      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      logger.debug('api_response', {
        message: 'GET response received',
        timestamp,
        status: response.status,
        endpoint: `${this.basePath}${endpoint}`,
        method: 'GET'
      });
      return this.handleResponse(response, errorMessage);
    });
  }

  // Enhanced POST method with queuing
  async post(endpoint, data, errorMessage) {
    return this.queueRequest(async () => {
      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }

  // Enhanced PUT method with queuing
  async put(endpoint, data, errorMessage) {
    return this.queueRequest(async () => {
      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }

  // Enhanced DELETE method with queuing
  async delete(endpoint, errorMessage) {
    return this.queueRequest(async () => {
      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }
}

export default BaseApiService;
