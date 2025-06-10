import BaseApiService from './baseApi';

class ImmunizationApiService extends BaseApiService {
  // Get immunizations
  async getImmunizations() {
    return this.get('/api/v1/immunizations/', 'Failed to fetch immunizations');
  }

  // Get immunizations for a specific patient
  async getPatientImmunizations(patientId) {
    return this.get(`/api/v1/immunizations/?patient_id=${patientId}`, 'Failed to fetch patient immunizations');
  }

  // Create new immunization
  async createImmunization(immunizationData) {
    return this.post('/api/v1/immunizations/', immunizationData, 'Failed to create immunization');
  }

  // Update an immunization
  async updateImmunization(immunizationId, immunizationData) {
    return this.put(`/api/v1/immunizations/${immunizationId}`, immunizationData, 'Failed to update immunization');
  }

  // Delete an immunization
  async deleteImmunization(immunizationId) {
    return this.delete(`/api/v1/immunizations/${immunizationId}`, 'Failed to delete immunization');
  }
}

export default ImmunizationApiService;
