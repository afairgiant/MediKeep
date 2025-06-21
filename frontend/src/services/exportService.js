import { apiClient } from './apiClient';

export const exportService = {
  /**
   * Get summary of available data for export
   */
  async getSummary() {
    try {
      const response = await apiClient.get('/export/summary');
      return response.data;
    } catch (error) {
      console.error('Failed to get export summary:', error);
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
      console.error('Failed to get supported formats:', error);
      throw error;
    }
  },

  /**
   * Download single export
   */ async downloadExport(params) {
    try {
      console.log('Starting download with params:', params);

      // Debug: First call our debug endpoint to see what's being sent
      try {
        const debugResponse = await apiClient.get('/export/debug', {
          params: params,
        });
        console.log(
          'Debug response - what backend received:',
          debugResponse.data
        );
      } catch (debugError) {
        console.log('Debug endpoint failed:', debugError);
      }

      // Always use blob response type for file downloads
      const response = await apiClient.get('/export/data', {
        params: params,
        responseType: 'blob',
      });

      console.log('Response received:', response);
      console.log('Response data type:', typeof response.data);
      console.log('Response data:', response.data);

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'medical_records_export.json';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      } else {
        // Fallback filename generation
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[-:]/g, '')
          .replace('T', '_');
        const extension = params.format || 'json';
        filename = `medical_records_${params.scope || 'export'}_${timestamp}.${extension}`;
      }

      // Check if response.data is actually a Blob
      let blob;
      if (response.data instanceof Blob) {
        console.log('Response is already a Blob, size:', response.data.size);
        blob = response.data;
      } else {
        console.log('Response is not a Blob, creating one from data');
        // Convert the data to a proper blob
        let content;
        if (typeof response.data === 'string') {
          content = response.data;
        } else if (typeof response.data === 'object') {
          content = JSON.stringify(response.data, null, 2);
        } else {
          content = String(response.data);
        }

        // Create blob with appropriate MIME type
        const mimeType =
          params.format === 'json'
            ? 'application/json'
            : params.format === 'csv'
              ? 'text/csv'
              : params.format === 'pdf'
                ? 'application/pdf'
                : 'text/plain';

        blob = new Blob([content], { type: mimeType });
      }

      console.log('Final blob:', blob, 'size:', blob.size, 'type:', blob.type);

      if (blob.size === 0) {
        throw new Error('Export data is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      console.error('Export download failed:', error);
      throw error;
    }
  },
  /**
   * Download bulk export
   */
  async downloadBulkExport(data) {
    try {
      console.log('Starting bulk export with data:', data);

      const response = await apiClient.post('/export/bulk', data, {
        responseType: 'blob',
      });

      console.log('Bulk export response:', response);

      // Get filename from Content-Disposition header
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

      // Check if response.data is actually a Blob for ZIP files
      let blob;
      if (response.data instanceof Blob) {
        console.log(
          'Bulk export response is already a Blob, size:',
          response.data.size
        );
        blob = response.data;
      } else {
        console.log('Bulk export response is not a Blob, creating one');
        blob = new Blob([response.data], { type: 'application/zip' });
      }

      console.log('Final bulk export blob:', blob, 'size:', blob.size);

      if (blob.size === 0) {
        throw new Error('Bulk export data is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      console.error('Bulk export download failed:', error);
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
   * Get export history (if implemented in backend)
   */
  async getExportHistory() {
    try {
      const response = await apiClient.get('/export/history');
      return response.data;
    } catch (error) {
      // This endpoint might not be implemented yet
      console.warn('Export history not available:', error);
      return { exports: [] };
    }
  },

  /**
   * Get estimated export size
   */
  async getEstimatedSize(params) {
    try {
      const response = await apiClient.post('/export/estimate', params);
      return response.data;
    } catch (error) {
      // This endpoint might not be implemented yet
      console.warn('Export size estimation not available:', error);
      return { estimated_size: 'Unknown' };
    }
  },

  /**
   * Debug export parameters
   */
  async debugExportParams(params) {
    try {
      console.log('Debug: Starting with params:', params);

      const response = await apiClient.get('/export/debug', {
        params: params,
      });

      console.log('Debug response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Debug failed:', error);
      throw error;
    }
  },
};
