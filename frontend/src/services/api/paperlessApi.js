import { apiService } from './index';

/**
 * Paperless-ngx API service
 * Handles paperless integration API calls including connection testing,
 * settings management, and storage statistics.
 */

/**
 * Test connection to paperless-ngx instance
 * @param {string} paperlessUrl - Paperless-ngx instance URL
 * @param {string} username - Username for authentication (optional if apiToken provided)
 * @param {string} password - Password for authentication (optional if apiToken provided)
 * @param {string} apiToken - API token for authentication (optional)
 * @returns {Promise} Connection test results
 */
export const testPaperlessConnection = async (paperlessUrl, username, password, apiToken) => {
  const payload = {
    paperless_url: paperlessUrl
  };

  // Add API token if provided (prioritized over username/password)
  if (apiToken) {
    payload.paperless_api_token = apiToken;
  } else {
    // Only add username/password if no API token is provided
    payload.paperless_username = username;
    payload.paperless_password = password;
  }

  return apiService.post('/paperless/test-connection', payload);
};

/**
 * Update paperless settings for current user
 * @param {Object} settings - Paperless settings to update
 * @param {boolean} settings.paperless_enabled - Enable/disable paperless integration
 * @param {string} settings.paperless_url - Paperless-ngx instance URL
 * @param {string} settings.paperless_api_token - API token for authentication (optional)
 * @param {string} settings.paperless_username - Username for authentication (optional if token provided)
 * @param {string} settings.paperless_password - Password for authentication (optional if token provided)
 * @param {string} settings.default_storage_backend - Default storage backend ('local' or 'paperless')
 * @param {boolean} settings.paperless_auto_sync - Enable automatic sync
 * @param {boolean} settings.paperless_sync_tags - Enable tag synchronization
 * @returns {Promise} Updated settings
 */
export const updatePaperlessSettings = async (settings) => {
  return apiService.put('/paperless/settings', settings);
};

/**
 * Get paperless settings for current user
 * @returns {Promise} Current paperless settings
 */
export const getPaperlessSettings = async () => {
  return apiService.get('/paperless/settings');
};

/**
 * Get storage usage statistics
 * @returns {Promise} Storage usage statistics for local and paperless backends
 */
export const getStorageUsageStats = async () => {
  return apiService.get('/paperless/storage-stats');
};

/**
 * Trigger manual sync of documents to paperless-ngx
 * @param {Object} options - Sync options
 * @param {string[]} options.entity_types - Entity types to sync (optional)
 * @param {boolean} options.force - Force re-sync of existing documents
 * @returns {Promise} Sync operation status and progress
 */
export const triggerPaperlessSync = async (options = {}) => {
  return apiService.post('/paperless/sync', options);
};

/**
 * Get sync status and recent activity
 * @returns {Promise} Sync status information
 */
export const getPaperlessSyncStatus = async () => {
  return apiService.get('/paperless/sync-status');
};

/**
 * Search documents in paperless-ngx (user-isolated)
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.pageSize - Results per page (default: 25)
 * @returns {Promise} Search results
 */
export const searchPaperlessDocuments = async (query = '', options = {}) => {
  const params = {
    query,
    page: options.page || 1,
    page_size: options.pageSize || 25
  };
  
  return apiService.get('/paperless/documents/search', { params });
};

/**
 * Migrate documents between storage backends
 * @param {Object} migrationOptions - Migration configuration
 * @param {string} migrationOptions.from_backend - Source backend ('local' or 'paperless')
 * @param {string} migrationOptions.to_backend - Target backend ('local' or 'paperless')
 * @param {string[]} migrationOptions.entity_types - Entity types to migrate
 * @param {boolean} migrationOptions.keep_originals - Keep original files as backup
 * @returns {Promise} Migration task information
 */
export const migrateDocuments = async (migrationOptions) => {
  return apiService.post('/paperless/migrate', migrationOptions);
};

/**
 * Get migration status
 * @param {string} taskId - Migration task ID
 * @returns {Promise} Migration status and progress
 */
export const getMigrationStatus = async (taskId) => {
  return apiService.get(`/paperless/migrate/${taskId}/status`);
};

/**
 * Cancel ongoing migration
 * @param {string} taskId - Migration task ID
 * @returns {Promise} Cancellation status
 */
export const cancelMigration = async (taskId) => {
  return apiService.post(`/paperless/migrate/${taskId}/cancel`);
};

/**
 * Delete paperless configuration and cleanup user data
 * @returns {Promise} Cleanup operation status
 */
export const deletePaperlessConfiguration = async () => {
  return apiService.delete('/paperless/settings');
};

/**
 * Export user's paperless data for compliance (GDPR, etc.)
 * @returns {Promise} Exported data archive
 */
export const exportPaperlessData = async () => {
  return apiService.get('/paperless/export', {
    responseType: 'blob' // For file download
  });
};

/**
 * Poll Paperless task status by UUID
 * @param {string} taskUuid - Task UUID returned from Paperless upload
 * @param {number} maxAttempts - Maximum polling attempts (default: 30)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 1000)
 * @returns {Promise} Task status and result
 */
export const pollPaperlessTaskStatus = async (taskUuid, maxAttempts = 30, intervalMs = 1000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await apiService.get(`/paperless/tasks/${taskUuid}/status`);
      
      // Check if task is completed (SUCCESS or FAILURE)
      if (response.status === 'SUCCESS' || response.status === 'FAILURE') {
        return response;
      }
      
      // Wait before next attempt if task is still pending/running
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      // If we can't get task status, continue polling unless it's the last attempt
      if (attempt === maxAttempts - 1) {
        throw new Error(`Task status polling failed: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  throw new Error('Task polling timeout - task may still be processing');
};

/**
 * Clean up out-of-sync EntityFile records
 * @returns {Promise} Cleanup results with counts of cleaned items
 */
export const cleanupOutOfSyncFiles = async () => {
  return apiService.post('/paperless/cleanup');
};

export default {
  testPaperlessConnection,
  updatePaperlessSettings,
  getPaperlessSettings,
  getStorageUsageStats,
  triggerPaperlessSync,
  getPaperlessSyncStatus,
  searchPaperlessDocuments,
  migrateDocuments,
  getMigrationStatus,
  cancelMigration,
  deletePaperlessConfiguration,
  exportPaperlessData,
  pollPaperlessTaskStatus,
  cleanupOutOfSyncFiles
};