import BaseApiService from './baseApi';

class LabResultApiService extends BaseApiService {
  // Get lab results
  async getLabResults() {
    return this.get('/api/v1/lab-results', 'Failed to fetch lab results');
  }

  // Get lab results for a specific patient
  async getPatientLabResults(patientId) {
    return this.get(`/api/v1/lab-results/patient/${patientId}`, 'Failed to fetch patient lab results');
  }

  // Get a specific lab result by ID
  async getLabResult(labResultId) {
    return this.get(`/api/v1/lab-results/${labResultId}`, 'Failed to fetch lab result');
  }

  // Create a new lab result
  async createLabResult(labResultData) {
    return this.post('/api/v1/lab-results', labResultData, 'Failed to create lab result');
  }

  // Update a lab result
  async updateLabResult(labResultId, labResultData) {
    return this.put(`/api/v1/lab-results/${labResultId}`, labResultData, 'Failed to update lab result');
  }

  // Delete a lab result
  async deleteLabResult(labResultId) {
    return this.delete(`/api/v1/lab-results/${labResultId}`, 'Failed to delete lab result');
  }

  // Get files for a specific lab result
  async getLabResultFiles(labResultId) {
    return this.get(`/api/v1/lab-result-files/lab-result/${labResultId}`, 'Failed to fetch lab result files');
  }
  // Upload a file for a lab result
  async uploadLabResultFile(labResultId, file, description = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/upload/${labResultId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
        // Don't set Content-Type header for FormData, let browser set it with boundary
      },
      body: formData
    });    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
      }
      
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
  }

  // Download a lab result file
  async downloadLabResultFile(fileId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/${fileId}/download`, {
      headers: this.getAuthHeaders()
    });    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
      }
      
      throw new Error('Failed to download file');
    }

    return response.blob();
  }

  // Delete a lab result file
  async deleteLabResultFile(fileId) {
    return this.delete(`/api/v1/lab-result-files/${fileId}`, 'Failed to delete file');
  }
}

export default LabResultApiService;
