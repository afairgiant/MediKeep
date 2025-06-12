import BaseApiService from './baseApi';

class ConditionApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/conditions';
  }

  // Get all conditions
  async getConditions(params = {}) {
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
    if (params.condition_type) {
      queryParams.append('condition_type', params.condition_type);
    }
    if (params.status) {
      queryParams.append('status', params.status);
    }

    const endpoint = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    return this.get(endpoint, 'Failed to fetch conditions');
  }

  // Get conditions for a specific patient
  async getPatientConditions(patientId, params = {}) {
    return this.getConditions({ ...params, patient_id: patientId });
  }

  // Get active conditions for a patient
  async getActiveConditions(patientId) {
    return this.get(`${this.endpoint}/patient/${patientId}/active`, 'Failed to fetch active conditions');
  }

  // Get chronic conditions for a patient
  async getChronicConditions(patientId) {
    return this.get(`${this.endpoint}/patient/${patientId}/chronic`, 'Failed to fetch chronic conditions');
  }

  // Get a specific condition by ID
  async getCondition(conditionId) {
    return this.get(`${this.endpoint}/${conditionId}`, 'Failed to fetch condition');
  }

  // Create a new condition
  async createCondition(conditionData) {
    return this.post(this.endpoint, conditionData, 'Failed to create condition');
  }

  // Update a condition
  async updateCondition(conditionId, conditionData) {
    return this.put(`${this.endpoint}/${conditionId}`, conditionData, 'Failed to update condition');
  }

  // Delete a condition
  async deleteCondition(conditionId) {
    return this.delete(`${this.endpoint}/${conditionId}`, 'Failed to delete condition');
  }
}

export default ConditionApiService;
