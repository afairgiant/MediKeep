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
    console.log('=== STARTING VERSION FETCH ===');

    // First, let's try using the health endpoint directly via fetch
    console.log('Trying direct fetch to /health...');
    try {
      const directResponse = await fetch('/health');
      console.log('Direct fetch - Response status:', directResponse.status);
      console.log('Direct fetch - Response ok:', directResponse.ok);
      console.log('Direct fetch - Response URL:', directResponse.url);

      if (directResponse.ok) {
        const data = await directResponse.json();
        console.log(
          'Direct fetch - Raw response:',
          JSON.stringify(data, null, 2)
        );

        if (data.app && data.version) {
          console.log('Direct fetch SUCCESS - Found app and version');
          return {
            app_name: data.app,
            version: data.version,
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (directError) {
      console.log('Direct fetch failed:', directError);
    }

    // If direct fetch fails, try using apiClient (which might work better)
    console.log('Trying apiClient approach...');
    try {
      // Since the main health endpoint is at the root, not under /api/v1
      // Let's try a raw fetch to the backend
      const backendResponse = await fetch('http://localhost:8000/health');
      console.log('Backend fetch - Response status:', backendResponse.status);
      console.log('Backend fetch - Response ok:', backendResponse.ok);

      if (backendResponse.ok) {
        const data = await backendResponse.json();
        console.log(
          'Backend fetch - Raw response:',
          JSON.stringify(data, null, 2)
        );

        if (data.app && data.version) {
          console.log('Backend fetch SUCCESS - Found app and version');
          return {
            app_name: data.app,
            version: data.version,
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (backendError) {
      console.log('Backend fetch failed:', backendError);
    }

    // If all else fails, return fallback
    console.log('All fetch attempts failed, returning fallback');
    return {
      app_name: 'Medical Records Management System',
      version: '0.7.3',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('=== VERSION FETCH ERROR ===');
    console.error('Failed to fetch version information:', error);

    // Return hardcoded fallback instead of throwing
    return {
      app_name: 'Medical Records Management System',
      version: '0.7.3',
      timestamp: new Date().toISOString(),
    };
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
    console.error('Failed to fetch system health:', error);
    throw error;
  }
};

export default {
  getVersionInfo,
  getSystemHealth,
};
