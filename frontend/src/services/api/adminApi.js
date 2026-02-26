import logger from '../logger';

import BaseApiService from './baseApi';
import { secureStorage, legacyMigration } from '../../utils/secureStorage';

class AdminApiService extends BaseApiService {
  constructor() {
    super('/admin');
  }

  // Fetch a binary blob from an endpoint (used by CSV export methods)
  async _fetchBlob(endpoint, queryParams = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value != null) searchParams.set(key, value);
    }
    const queryString = searchParams.toString();
    const url = `${this.baseURL}${this.basePath}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const headers = await this.getAuthHeaders();
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    return response.blob();
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  async getRecentActivity(limit = 20, actionFilterOrSignal = null, entityFilter = null) {
    const params = { limit };
    
    // Handle backward compatibility: if second parameter looks like a signal, treat it as such
    let signal = null;
    let actionFilter = null;
    
    if (actionFilterOrSignal && typeof actionFilterOrSignal === 'object' && actionFilterOrSignal.aborted !== undefined) {
      // Second parameter is an AbortSignal
      signal = actionFilterOrSignal;
    } else if (typeof actionFilterOrSignal === 'string') {
      // Second parameter is an action filter
      actionFilter = actionFilterOrSignal;
    }
    
    if (actionFilter) params.action_filter = actionFilter;
    if (entityFilter) params.entity_filter = entityFilter;
    
    const options = signal ? { signal } : {};
    return this.get('/dashboard/recent-activity', params, options);
  }
  async getSystemHealth() {
    return this.get('/dashboard/system-health');
  }
  async getSystemMetrics() {
    return this.get('/dashboard/system-metrics');
  }

  async getStorageHealth() {
    return this.get('/dashboard/storage-health');
  }

  async getAnalyticsData(days = 7) {
    return this.get('/dashboard/analytics-data', { days });
  }

  async getFrontendLogHealth() {
    // Note: This endpoint is not under /admin, so we use the direct path
    // Migrate legacy data first
    legacyMigration.migrateFromLocalStorage();
    const token = secureStorage.getItem('token');
    const response = await fetch('/api/v1/frontend-logs/health', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getSSOConfig() {
    // Note: This endpoint is not under /admin, so we use the direct path
    // Migrate legacy data first
    legacyMigration.migrateFromLocalStorage();
    const token = secureStorage.getItem('token');
    const response = await fetch('/api/v1/auth/sso/config', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Model management endpoints
  async getAvailableModels() {
    return this.get('/models/');
  }

  async getModelMetadata(modelName) {
    return this.get(`/models/${modelName}/metadata`);
  }

  async getModelRecords(modelName, params = {}) {
    const { page = 1, per_page = 25, search = null } = params;
    const queryParams = { page, per_page };
    if (search) queryParams.search = search;

    return this.get(`/models/${modelName}/`, queryParams);
  }

  async getModelRecord(modelName, recordId) {
    return this.get(`/models/${modelName}/${recordId}`);
  }

  async deleteModelRecord(modelName, recordId) {
    return this.delete(`/models/${modelName}/${recordId}`);
  }

  async createModelRecord(modelName, data) {
    return this.post(`/models/${modelName}/`, data);
  }

  async updateModelRecord(modelName, recordId, data) {
    return this.put(`/models/${modelName}/${recordId}`, data);
  }

  // Bulk operations
  async bulkDeleteRecords(modelName, recordIds) {
    return this.post('/bulk/delete', {
      model_name: modelName,
      record_ids: recordIds,
    });
  }

  async bulkUpdateRecords(modelName, recordIds, updateData) {
    return this.post('/bulk/update', {
      model_name: modelName,
      record_ids: recordIds,
      update_data: updateData,
    });
  }

  // Search across models
  async globalSearch(query, models = null) {
    const params = { query };
    if (models) params.models = models.join(',');

    return this.get('/search', params);
  }

  // Export model data as CSV
  async exportModelData(modelName, params = {}) {
    const queryParams = {};
    if (params.search) queryParams.search = params.search;
    return this._fetchBlob(`/models/${modelName}/export`, queryParams);
  }

  // Export backup history as CSV
  async exportBackups() {
    return this._fetchBlob('/backups/export');
  }

  // System statistics
  async getDetailedStats() {
    return this.get('/stats/detailed');
  }

  async getActivityLog(params = {}) {
    const { page = 1, per_page = 50, ...filters } = params;
    const queryParams = { page, per_page };
    for (const [key, value] of Object.entries(filters)) {
      if (value) queryParams[key] = value;
    }
    return this.get('/activity-log', { params: queryParams });
  }

  async getActivityLogFilters() {
    return this.get('/activity-log/filters');
  }

  async exportActivityLog(params = {}) {
    const queryParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value) queryParams[key] = value;
    }
    return this._fetchBlob('/activity-log/export', queryParams);
  }

  // Test admin access
  async testAdminAccess() {
    try {
      // Try to get available models - this requires admin access
      return await this.getAvailableModels();
    } catch (error) {
      logger.error('Admin access test failed:', error);
      throw error;
    }
  }

  // Backup management endpoints
  async getBackups() {
    return this.get('/backups/');
  }

  async createDatabaseBackup(description) {
    return this.post('/backups/create-database', { description });
  }

  async createFilesBackup(description) {
    return this.post('/backups/create-files', { description });
  }

  async createFullBackup(description) {
    return this.post('/backups/create-full', { description });
  }

  async downloadBackup(backupId) {
    return this._fetchBlob(`/backups/${backupId}/download`);
  }

  async verifyBackup(backupId) {
    return this.post(`/backups/${backupId}/verify`);
  }

  async deleteBackup(backupId) {
    return this.delete(`/backups/${backupId}`);
  }

  async cleanupBackups() {
    return this.post('/backups/cleanup');
  }

  async cleanupOrphanedFiles() {
    return this.post('/backups/cleanup-orphaned');
  }

  async cleanupAllOldData() {
    return this.post('/backups/cleanup-all');
  }

  // Trash management endpoints
  async listTrashContents() {
    return this.get('/trash/');
  }

  async cleanupTrash() {
    return this.post('/trash/cleanup');
  }

  async restoreFromTrash(trashPath, restorePath = null) {
    const body = { trash_path: trashPath };
    if (restorePath) body.restore_path = restorePath;
    return this.post('/trash/restore', body);
  }

  async permanentlyDeleteFromTrash(trashPath) {
    return this.delete(
      `/trash/permanently-delete?trash_path=${encodeURIComponent(trashPath)}`
    );
  }

  // Settings management endpoints
  async getRetentionSettings() {
    return this.get('/backups/settings/retention');
  }

  async updateRetentionSettings(settings) {
    return this.post('/backups/settings/retention', settings);
  }

  // Auto-backup schedule endpoints
  async getAutoBackupSchedule() {
    return this.get('/backups/settings/schedule');
  }

  async updateAutoBackupSchedule(scheduleData) {
    return this.post('/backups/settings/schedule', scheduleData);
  }

  // Restore management endpoints
  async previewRestore(backupId) {
    return this.post(`/restore/preview/${backupId}`);
  }

  async getConfirmationToken(backupId) {
    return this.get(`/restore/confirmation-token/${backupId}`);
  }

  async executeRestore(backupId, confirmationToken) {
    return this.post(`/restore/execute/${backupId}`, {
      confirmation_token: confirmationToken,
    });
  }

  // Upload backup file
  async uploadBackup(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${this.baseURL}${this.basePath}/restore/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(() => {
            legacyMigration.migrateFromLocalStorage();
            return secureStorage.getItem('token');
          })()}`,
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: 'Upload failed' }));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`
      );
    }

    return response.json();
  }

  // Admin password reset
  async adminResetPassword(userId, newPassword) {
    return this.post(`/models/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
  }

  // Admin User Management endpoints
  async searchAllPatients(query, limit = 200) {
    const params = { limit };
    if (query) params.q = query;
    return this.get('/user-management/patients/search', params);
  }

  async createUserWithPatientLink(userData) {
    return this.post('/user-management/users/create', userData);
  }

  // Test Library Maintenance endpoints
  async getTestLibraryInfo() {
    return this.get('/maintenance/test-library/info');
  }

  async reloadTestLibrary() {
    return this.post('/maintenance/test-library/reload');
  }

  async syncTestLibrary(forceAll = false) {
    return this.post('/maintenance/test-library/sync', { force_all: forceAll });
  }
}

// Create and export a singleton instance
export const adminApiService = new AdminApiService();
export default adminApiService;
