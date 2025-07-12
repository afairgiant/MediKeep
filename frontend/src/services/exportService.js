import { apiClient } from './apiClient';
import logger from './logger';

export const exportService = {
  /**
   * Get summary of available data for export
   */
  async getSummary() {
    try {
      const response = await apiClient.get('/export/summary');
      return response.data;
    } catch (error) {
      logger.error('Failed to get export summary', {
        category: 'export_error',
        error: error.message,
        status: error.status,
        endpoint: '/export/summary'
      });
      throw error;
    }
  },

  /**
   * Get supported export formats and scopes
   */
  async getSupportedFormats() {
    try {
      const response = await apiClient.get('/export/formats');
      return response.data;
    } catch (error) {
      logger.error('Failed to get supported formats', {
        category: 'export_error',
        error: error.message,
        status: error.status,
        endpoint: '/export/formats'
      });
      throw error;
    }
  },

  /**
   * Download single export
   */
  async downloadExport(params) {
    try {
      const response = await apiClient.get('/export/data', {
        params: params,
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = this._generateDefaultFilename(params);

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      // Validate response
      if (!response.data || response.data.size === 0) {
        throw new Error('Export data is empty');
      }

      // Download the file
      this._downloadBlob(response.data, filename);

      return { success: true, filename };
    } catch (error) {
      logger.error('Export download failed', {
        category: 'export_error',
        error: error.message,
        status: error.status,
        endpoint: '/export/data',
        params: params
      });
      throw error;
    }
  },

  /**
   * Download bulk export
   */
  async downloadBulkExport(data) {
    try {
      const response = await apiClient.post('/export/bulk', data, {
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'medical_records_bulk_export.zip';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      // Validate response
      if (!response.data || response.data.size === 0) {
        throw new Error('Bulk export data is empty');
      }

      // Download the file
      this._downloadBlob(response.data, filename);

      return { success: true, filename };
    } catch (error) {
      logger.error('Bulk export download failed', {
        category: 'export_error',
        error: error.message,
        status: error.status,
        endpoint: '/export/bulk',
        data_keys: data ? Object.keys(data) : []
      });
      throw error;
    }
  },

  /**
   * Validate export parameters
   */
  validateExportParams(params) {
    const errors = [];

    if (!params.format) {
      errors.push('Export format is required');
    }

    if (!params.scope) {
      errors.push('Export scope is required');
    }

    if (params.start_date && params.end_date) {
      const startDate = new Date(params.start_date);
      const endDate = new Date(params.end_date);

      if (startDate > endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Generate default filename for export
   */
  _generateDefaultFilename(params) {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, '')
      .replace('T', '_');

    const scope = params.scope || 'export';
    const format = params.format || 'json';

    // Check if this should be a ZIP file
    const isZipFile =
      params.include_files === true || params.include_files === 'true';

    if (isZipFile) {
      return `medical_records_${scope}_with_files_${timestamp}.zip`;
    } else {
      return `medical_records_${scope}_${timestamp}.${format}`;
    }
  },

  /**
   * Download blob as file
   */
  _downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
