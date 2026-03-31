// Base API service with common functionality
import logger from '../logger';
import { getApiUrl } from '../../config/env';
import { extractErrorMessage } from '../../utils/errorUtils.js';

const API_BASE_URL = getApiUrl();

class BaseApiService {
  constructor(basePath = '') {
    this.baseURL = API_BASE_URL;
    this.basePath = basePath;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentRequests = 3;
    this.activeRequests = 0;
  }

  // No Authorization header needed; credentials: 'include' sends the session cookie.
  getAuthHeaders() {
    return { 'Content-Type': 'application/json' };
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
  }

  // Handle authentication errors. Cookie is HttpOnly so we cannot inspect it;
  // a 401 means the session cookie is invalid/expired.
  handleAuthError(response) {
    if (response.status === 401) {
      const url = response.url;

      // For admin endpoints, allow retry logic to handle transient issues
      if (url && url.includes('/admin/')) {
        logger.warn('api_admin_access_denied', {
          message: 'Admin access denied (401)',
          url,
          activeRequests: this.activeRequests,
          action: 'retry_will_handle'
        });
        return false;
      }

      // For non-admin endpoints, redirect to login
      logger.warn('api_auth_error', {
        message: 'Session expired or invalid (401)',
        url: response.url,
        action: 'redirect_to_login'
      });
      window.location.href = '/login';
      return true;
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
        // If handleAuthError returns true, it means we're redirecting to login
        // We should throw an error so the calling code knows the request failed
        throw new Error('Authentication failed - redirecting to login');
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

      // Use extractErrorMessage for consistent error handling
      const errorMsg = extractErrorMessage(error, response.status);
      throw new Error(errorMsg);
    }

    // Handle 204 No Content responses (common for DELETE operations)
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // Enhanced GET method with queuing
  async get(endpoint, options = {}) {
    const { params, signal, ...rest } = options;
    const errorMessage = rest.errorMessage || 'Request failed';
    
    // Build URL with query parameters BEFORE queuing
    let url = `${this.baseURL}${this.basePath}${endpoint}`;
    
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    
    return this.queueRequest(async () => {
      const timestamp = new Date().toISOString();
      
      logger.debug('api_request', {
        message: 'GET request queued',
        timestamp,
        endpoint: `${this.basePath}${endpoint}`,
        method: 'GET',
        params: params || null,
        finalUrl: url
      });

      const response = await fetch(url, {
        credentials: 'include',
        headers: this.getAuthHeaders(),
        signal,
      });

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
          credentials: 'include',
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
          credentials: 'include',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }

  // Enhanced PATCH method with queuing
  async patch(endpoint, data, errorMessage) {
    return this.queueRequest(async () => {
      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          method: 'PATCH',
          credentials: 'include',
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
          credentials: 'include',
          headers: this.getAuthHeaders(),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }

  // Enhanced DELETE method with body support and queuing
  async deleteWithBody(endpoint, data, errorMessage) {
    return this.queueRequest(async () => {
      const response = await fetch(
        `${this.baseURL}${this.basePath}${endpoint}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      return this.handleResponse(response, errorMessage);
    });
  }
}

export default BaseApiService;
