// Base API service with common functionality
import logger from '../logger';
import { getApiUrl } from '../../config/env';
import { extractErrorMessage } from '../../utils/errorUtils.js';
import {
  handleUnauthorized,
  isNonEjectingEndpoint,
} from '../../utils/loginRedirect';

const API_BASE_URL = getApiUrl();

// Bounded retries for transient admin 401s. See handleResponse.
const MAX_401_RETRIES = 2;

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
  //
  // Callers that still have a retry to spend must absorb the 401 before calling
  // this -- see handleResponse. Once retries are exhausted the request falls
  // through here and ejects like any other. The exemption used to be permanent
  // for /admin/ URLs, and the retry meant to bound it never worked at all, so an
  // expired admin session hung rather than redirecting.
  handleAuthError(response) {
    if (response.status === 401) {
      return handleUnauthorized(response.url);
    }

    if (response.status === 429) {
      logger.warn('api_rate_limit', {
        message: 'Rate limit detected',
        status: response.status,
        url: response.url,
      });
      return false;
    }

    return false;
  } // Enhanced response handling with retry logic
  /**
   * @param {object} [retry] - how to replay this request, when it can be
   *   replayed at all. Omitted by every verb except GET: the replay is the
   *   caller's own fetch, and there is no safe way to replay a POST/PUT/DELETE
   *   from here. Omitting it means an admin 401 ejects immediately rather than
   *   being absorbed.
   * @param {number} retry.attempt - replays already made.
   * @param {() => Promise<Response>} retry.replay - re-issues the original
   *   request, with its original method and abort signal.
   */
  async handleResponse(
    response,
    errorMessage = 'API request failed',
    retry = null
  ) {
    if (!response.ok) {
      // Absorb a transient 401 before handleAuthError can eject on it. A
      // concurrent admin request is the only case worth replaying; background
      // polls are excluded because handleUnauthorized is going to swallow them
      // anyway, so retrying one spends two extra round trips and half a second
      // of backoff to arrive at "do nothing".
      const willRetry =
        response.status === 401 &&
        retry &&
        retry.attempt < MAX_401_RETRIES &&
        response.url?.includes('/admin/') &&
        !isNonEjectingEndpoint(response.url);

      if (willRetry) {
        logger.info('api_retry', {
          message: 'Retrying request due to concurrent auth issue',
          attempt: retry.attempt + 1,
          maxRetries: MAX_401_RETRIES,
          url: response.url,
          activeRequests: this.activeRequests,
        });
        await new Promise(resolve =>
          setTimeout(resolve, 200 + retry.attempt * 100)
        ); // Backoff delay

        // Replay through the caller's own thunk rather than reconstructing a
        // request from the Response. Reconstructing loses the abort signal and
        // the method, and calling get() again would re-enter the request queue -
        // which is what this retry used to do, and it deadlocked outright:
        // processQueue holds isProcessingQueue while awaiting the request, so
        // the nested one was queued and never dequeued and the caller's promise
        // never settled. An admin page whose session had expired hung on its
        // spinner forever. Verified against main before changing it.
        return this.handleResponse(await retry.replay(), errorMessage, {
          ...retry,
          // Must be threaded through, or maxRetries never binds and the hang
          // becomes an unbounded loop instead.
          attempt: retry.attempt + 1,
        });
      }

      // Not retryable, or retries exhausted -- now a 401 may eject.
      if (this.handleAuthError(response)) {
        // handleAuthError returned true, so a redirect to login is underway.
        // Throw so the calling code knows the request failed.
        throw new Error('Authentication failed - redirecting to login');
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
        finalUrl: url,
      });

      // The replay a 401 retry uses. Defined here because this is the only place
      // that knows the request - its URL, method and abort signal - and it runs
      // outside queueRequest deliberately: re-entering the queue deadlocks it.
      const sendRequest = () =>
        fetch(url, {
          credentials: 'include',
          headers: this.getAuthHeaders(),
          signal,
        });

      const response = await sendRequest();

      logger.debug('api_response', {
        message: 'GET response received',
        timestamp,
        status: response.status,
        endpoint: `${this.basePath}${endpoint}`,
        method: 'GET',
      });
      return this.handleResponse(response, errorMessage, {
        attempt: 0,
        replay: sendRequest,
      });
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
