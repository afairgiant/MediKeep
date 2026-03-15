import { apiClient } from './apiClient';
import { env } from '../config/env';

/**
 * System service for fetching system information from the backend
 */

/**
 * Get application version information
 * @returns {Promise<Object>} Version information including app name and version
 */
export const getVersionInfo = async () => {
  // Try the proxied version endpoint first
  let response = await fetch('/api/v1/system/version');

  if (!response.ok && env.DEV) {
    // If proxy fails in development, try direct backend connection
    response = await fetch('http://localhost:8000/api/v1/system/version');
  }

  if (response.ok) {
    const data = await response.json();

    if (data.app_name && data.version) {
      return {
        app_name: data.app_name,
        version: data.version,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }
  }

  throw new Error('Version endpoint returned invalid data');
};

/**
 * Get system health information
 * @returns {Promise<Object>} System health status
 */
export const getSystemHealth = async () => {
  const response = await apiClient.get('/system/health');
  return response.data;
};

/**
 * Get application release notes from GitHub
 * @param {number} limit - Maximum number of releases to return
 * @returns {Promise<Object>} Release notes including releases array and current version
 */
export const getReleaseNotes = async (limit = 10) => {
  let response = await fetch(`/api/v1/system/releases?limit=${limit}`);

  if (!response.ok && env.DEV) {
    response = await fetch(`http://localhost:8000/api/v1/system/releases?limit=${limit}`);
  }

  if (response.ok) {
    const data = await response.json();
    return {
      releases: data.releases || [],
      current_version: data.current_version,
      timestamp: data.timestamp,
    };
  }

  throw new Error('Release notes endpoint returned invalid data');
};

const systemService = {
  getVersionInfo,
  getSystemHealth,
  getReleaseNotes,
};

export default systemService;
