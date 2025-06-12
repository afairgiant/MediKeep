import BaseApiService from './baseApi';

class TreatmentApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/treatments';
  }

  // Get all treatments
  async getTreatments(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.skip !== undefined) {
      queryParams.append('skip', params.skip);
    }
    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit);
    }
    if (params.patient_id) {
      queryParams.append('patient_id', params.patient_id);
    }
    if (params.condition_id) {
      queryParams.append('condition_id', params.condition_id);
    }
    if (params.status) {
      queryParams.append('status', params.status);
    }

    const endpoint = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    return this.get(endpoint, 'Failed to fetch treatments');
  }

  // Get treatments for a specific patient
  async getPatientTreatments(patientId, params = {}) {
    return this.getTreatments({ ...params, patient_id: patientId });
  }

  // Get active treatments for a patient
  async getActiveTreatments(patientId) {
    return this.get(`${this.endpoint}/patient/${patientId}/active`, 'Failed to fetch active treatments');
  }

  // Get ongoing treatments
  async getOngoingTreatments(patientId = null) {
    const queryParams = patientId ? `?patient_id=${patientId}` : '';
    return this.get(`${this.endpoint}/ongoing${queryParams}`, 'Failed to fetch ongoing treatments');
  }

  // Get a specific treatment by ID
  async getTreatment(treatmentId) {
    return this.get(`${this.endpoint}/${treatmentId}`, 'Failed to fetch treatment');
  }

  // Create a new treatment
  async createTreatment(treatmentData) {
    return this.post(this.endpoint, treatmentData, 'Failed to create treatment');
  }

  // Update a treatment
  async updateTreatment(treatmentId, treatmentData) {
    return this.put(`${this.endpoint}/${treatmentId}`, treatmentData, 'Failed to update treatment');
  }

  // Delete a treatment
  async deleteTreatment(treatmentId) {
    return this.delete(`${this.endpoint}/${treatmentId}`, 'Failed to delete treatment');
  }
}

export default TreatmentApiService;
