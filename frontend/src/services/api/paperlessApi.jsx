import logger from '../logger';

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
export const pollPaperlessTaskStatus = async (taskUuid, maxAttempts = 60, intervalMs = 1000, onBackgroundTransition = null) => {
  logger.info(`🔍 Starting task polling for ${taskUuid} with ${maxAttempts} max attempts`);
  
  const FOREGROUND_ATTEMPTS = 30; // 30 seconds of foreground polling
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await apiService.get(`/paperless/tasks/${taskUuid}/status`);
      
      logger.info(`🔍 Attempt ${attempt + 1}/${maxAttempts}: Task status = ${response.status}`, response);
      
      // Check if task is completed (SUCCESS or FAILURE)
      if (response.status === 'SUCCESS' || response.status === 'FAILURE') {
        logger.info(`✅ Task completed after ${attempt + 1} attempts with status: ${response.status}`);
        return response;
      }
      
      // After 30 seconds (30 attempts), transition to background processing
      if (attempt === FOREGROUND_ATTEMPTS - 1 && onBackgroundTransition) {
        logger.info(`🔄 Transitioning to background processing after ${FOREGROUND_ATTEMPTS} attempts`);
        
        // Notify caller that we're going to background
        onBackgroundTransition(taskUuid);
        
        // Return a special "processing" status to indicate background mode
        return {
          status: 'PROCESSING_BACKGROUND',
          task_uuid: taskUuid,
          message: 'Task is taking longer than expected, continuing in background'
        };
      }
      
      // Wait before next attempt if task is still pending/running
      if (attempt < maxAttempts - 1) {
        // Use longer intervals after transitioning to background (if we somehow get here)
        const currentInterval = attempt >= FOREGROUND_ATTEMPTS ? 10000 : intervalMs;
        logger.info(`⏱️ Waiting ${currentInterval}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, currentInterval));
      }
    } catch (error) {
      logger.info(`❌ Attempt ${attempt + 1}/${maxAttempts} failed:`, error.message);
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
 * Poll a background task and update the entity file when complete
 * @param {string} taskUuid - The task UUID to poll
 * @param {string} entityType - Type of entity (e.g., 'visit')  
 * @param {number} entityId - ID of the entity
 * @param {string} fileName - Name of the file
 * @returns {Promise} Resolution result
 */
export const resolveBackgroundTask = async (taskUuid, entityType, entityId, fileName) => {
  logger.info(`🔄 Starting background task resolution for ${taskUuid}`);
  
  const MAX_BACKGROUND_ATTEMPTS = 60; // 10 minutes with 10-second intervals
  const BACKGROUND_INTERVAL = 10000; // 10 seconds
  
  for (let attempt = 0; attempt < MAX_BACKGROUND_ATTEMPTS; attempt++) {
    try {
      const response = await apiService.get(`/paperless/tasks/${taskUuid}/status`);
      
      logger.info(`🔄 Background attempt ${attempt + 1}/${MAX_BACKGROUND_ATTEMPTS}: Task status = ${response.status}`);
      
      // Check if task is completed (SUCCESS or FAILURE)
      if (response.status === 'SUCCESS' || response.status === 'FAILURE') {
        logger.info(`✅ Background task completed after ${attempt + 1} attempts with status: ${response.status}`);
        
        // Update the entity file with the final result
        try {
          await apiService.post('/paperless/entity-files/update-background-task', {
            entity_type: entityType,
            entity_id: entityId,
            file_name: fileName,
            task_uuid: taskUuid,
            task_result: response,
            sync_status: response.status === 'SUCCESS' ? 'synced' : 'failed'
          });
          
          // Show success notification
          import('@mantine/notifications').then(({ notifications }) => {
            notifications.show({
              title: response.status === 'SUCCESS' ? 'Upload Complete' : 'Upload Failed',
              message: response.status === 'SUCCESS' 
                ? `${fileName} has been successfully processed by Paperless` 
                : `${fileName} failed to process in Paperless`,
              color: response.status === 'SUCCESS' ? 'green' : 'red',
              autoClose: 8000,
              withCloseButton: true,
            });
          }).catch((err) => {
            logger.warn('paperless_notification_import_failed', 'Failed to import Mantine notifications', {
              error: err.message,
              component: 'paperlessApi'
            });
          });
          
        } catch (updateError) {
          logger.error('❌ Failed to update entity file after background resolution:', updateError);
        }
        
        return response;
      }
      
      // Wait before next attempt if task is still pending/running
      if (attempt < MAX_BACKGROUND_ATTEMPTS - 1) {
        logger.info(`⏱️ Background waiting ${BACKGROUND_INTERVAL}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, BACKGROUND_INTERVAL));
      }
    } catch (error) {
      logger.info(`❌ Background attempt ${attempt + 1}/${MAX_BACKGROUND_ATTEMPTS} failed:`, error.message);
      
      // If we can't get task status, continue polling unless it's the last attempt
      if (attempt === MAX_BACKGROUND_ATTEMPTS - 1) {
        logger.error('❌ Background task resolution failed after all attempts');
        
        // Mark as failed
        try {
          await apiService.post('/paperless/entity-files/update-background-task', {
            entity_type: entityType,
            entity_id: entityId,
            file_name: fileName,
            task_uuid: taskUuid,
            task_result: { status: 'FAILURE', error: error.message },
            sync_status: 'failed'
          });
        } catch (updateError) {
          logger.error('❌ Failed to mark task as failed:', updateError);
        }
        
        throw new Error(`Background task resolution failed: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, BACKGROUND_INTERVAL));
    }
  }
  
  logger.error('❌ Background task resolution timed out');
  throw new Error('Background task resolution timeout');
};

/**
 * Clean up out-of-sync EntityFile records
 * @returns {Promise} Cleanup results with counts of cleaned items
 */
export const cleanupOutOfSyncFiles = async () => {
  return apiService.post('/paperless/cleanup');
};

/**
 * Search for a document in Paperless by filename and approximate upload time
 * Used as fallback when task monitoring returns invalid document IDs
 * @param {string} filename - Original filename to search for
 * @param {Date} uploadTime - Approximate upload time (optional, defaults to recent)
 * @returns {Promise<number|null>} Document ID if found, null otherwise
 */
export const searchDocumentByFilenameAndTime = async (filename, uploadTime = null) => {
  try {
    // Calculate search time window (default: last 30 minutes)
    const searchTime = uploadTime || new Date();
    const searchStart = new Date(searchTime.getTime() - 30 * 60 * 1000); // 30 minutes ago
    const searchEnd = new Date(searchTime.getTime() + 30 * 60 * 1000);   // 30 minutes from now
    
    // Format dates for API
    const startDate = searchStart.toISOString().split('T')[0];
    const endDate = searchEnd.toISOString().split('T')[0];
    
    // Try searching by title first
    try {
      const titleSearchResults = await apiService.get(`/paperless/documents/search?query=title:${encodeURIComponent(filename)}`);
      
      if (titleSearchResults && titleSearchResults.length > 0) {
        // Check if any results are within our time window
        for (const doc of titleSearchResults) {
          if (doc.created) {
            const docTime = new Date(doc.created);
            if (docTime >= searchStart && docTime <= searchEnd) {
              return doc.id;
            }
          }
        }
      }
    } catch (titleSearchError) {
      logger.warn('Title search failed, trying date-based search:', titleSearchError);
    }
    
    // Fallback: search with filename without title: prefix
    try {
      // Try searching just the filename without title prefix
      const baseFilename = filename.replace(/\.[^/.]+$/, ""); // Remove extension
      const simpleSearchResults = await apiService.get(`/paperless/documents/search?query=${encodeURIComponent(baseFilename)}`);
      
      if (simpleSearchResults && simpleSearchResults.length > 0) {
        const lowerFilename = filename.toLowerCase();
        
        for (const doc of simpleSearchResults) {
          const docTitle = (doc.title || '').toLowerCase();
          const docOriginalName = (doc.original_file_name || '').toLowerCase();
          
          // Check if document is within our time window
          if (doc.created) {
            const docTime = new Date(doc.created);
            if (docTime >= searchStart && docTime <= searchEnd) {
              // Check for filename matches
              if (lowerFilename === docTitle || 
                  lowerFilename === docOriginalName ||
                  docTitle.includes(lowerFilename) ||
                  docOriginalName.includes(lowerFilename)) {
                return doc.id;
              }
            }
          }
        }
      }
    } catch (dateSearchError) {
      logger.warn('Simple filename search failed:', dateSearchError);
    }
    
    return null;
    
  } catch (error) {
    logger.error('Error searching for document by filename and time:', error);
    return null;
  }
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
  cleanupOutOfSyncFiles,
  searchDocumentByFilenameAndTime
};