import { apiClient } from './apiClient';

/**
 * System service for fetching system information from the backend
 */

/**
 * Get application version information
 * @returns {Promise<Object>} Version information including app name and version
 */
export const getVersionInfo = async () => {
  try {
    // Try the proxied version endpoint first
    let response = await fetch('/api/v1/system/version');

    if (!response.ok && process.env.NODE_ENV === 'development') {
      // If proxy fails in development, try direct backend connection
      response = await fetch('http://localhost:8000/api/v1/system/version');
    }

    if (response.ok) {
      const data = await response.json();

      // Check if we got the expected response format
      if (data.app_name && data.version) {
        return {
          app_name: data.app_name,
          version: data.version,
          timestamp: data.timestamp || new Date().toISOString(),
        };
      }
    }

    // If endpoint fails, throw error to properly handle it
    throw new Error('Version endpoint returned invalid data');
  } catch (error) {
    // Propagate the error instead of returning fallback
    throw error;
  }
};

/**
 * Get system health information
 * @returns {Promise<Object>} System health status
 */
export const getSystemHealth = async () => {
  try {
    const response = await apiClient.get('/system/health');
    return response.data;
  } catch (error) {
    throw error;
  }
};

const systemService = {
  getVersionInfo,
  getSystemHealth,
};

export default systemService;
