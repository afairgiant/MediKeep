import BaseApiService from './baseApi';

class MedicationApiService extends BaseApiService {
  // Get medications
  async getMedications() {
    return this.get('/api/v1/medications', 'Failed to fetch medications');
  }

  // Get medications for a specific patient
  async getPatientMedications(patientId) {
    return this.get(`/api/v1/medications/patient/${patientId}`, 'Failed to fetch patient medications');
  }

  // Create a new medication
  async createMedication(medicationData) {
    return this.post('/api/v1/medications', medicationData, 'Failed to create medication');
  }

  // Update a medication
  async updateMedication(medicationId, medicationData) {
    return this.put(`/api/v1/medications/${medicationId}`, medicationData, 'Failed to update medication');
  }

  // Delete a medication
  async deleteMedication(medicationId) {
    return this.delete(`/api/v1/medications/${medicationId}`, 'Failed to delete medication');
  }
}

export default MedicationApiService;
