import BaseApiService from './baseApi';

class AdminApiService extends BaseApiService {
  constructor() {
    super('/admin');
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  async getRecentActivity(limit = 20) {
    return this.get('/dashboard/recent-activity', { limit });
  }
  async getSystemHealth() {
    return this.get('/dashboard/system-health');
  }
  async getSystemMetrics() {
    return this.get('/dashboard/system-metrics');
  }

  async getStorageHealth() {
    // Note: This endpoint is not under /admin, so we use the direct path
    const response = await fetch('/api/v1/lab-result-files/health/storage', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getFrontendLogHealth() {
    // Note: This endpoint is not under /admin, so we use the direct path
    const response = await fetch('/api/v1/frontend-logs/health', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
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

  // Export data
  async exportModelData(modelName, format = 'csv') {
    return this.get(`/models/${modelName}/export`, { format });
  }

  // System statistics
  async getDetailedStats() {
    return this.get('/stats/detailed');
  }

  async getActivityLog(params = {}) {
    const {
      page = 1,
      per_page = 50,
      model_name = null,
      action = null,
    } = params;
    const queryParams = { page, per_page };
    if (model_name) queryParams.model_name = model_name;
    if (action) queryParams.action = action;

    return this.get('/activity-log', queryParams);
  }

  // Test admin access
  async testAdminAccess() {
    try {
      // Try to get available models - this requires admin access
      return await this.getAvailableModels();
    } catch (error) {
      console.error('Admin access test failed:', error);
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

  async downloadBackup(backupId) {
    const response = await fetch(
      `${this.baseURL}${this.basePath}/backups/${backupId}/download`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.blob();
  }

  async verifyBackup(backupId) {
    return this.post(`/backups/${backupId}/verify`);
  }

  async cleanupBackups() {
    return this.post('/backups/cleanup');
  }
}

// Create and export a singleton instance
export const adminApiService = new AdminApiService();
export default adminApiService;
