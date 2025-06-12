import BaseApiService from './baseApi';

class ProcedureApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/procedures';
  }

  // Get all procedures
  async getProcedures(params = {}) {
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
    if (params.procedure_type) {
      queryParams.append('procedure_type', params.procedure_type);
    }
    if (params.status) {
      queryParams.append('status', params.status);
    }

    const endpoint = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    return this.get(endpoint, 'Failed to fetch procedures');
  }

  // Get procedures for a specific patient
  async getPatientProcedures(patientId, params = {}) {
    return this.getProcedures({ ...params, patient_id: patientId });
  }

  // Get recent procedures for a patient
  async getRecentProcedures(patientId, days = 90) {
    return this.get(`${this.endpoint}/patient/${patientId}/recent?days=${days}`, 'Failed to fetch recent procedures');
  }

  // Get a specific procedure by ID
  async getProcedure(procedureId) {
    return this.get(`${this.endpoint}/${procedureId}`, 'Failed to fetch procedure');
  }

  // Create a new procedure
  async createProcedure(procedureData) {
    return this.post(this.endpoint, procedureData, 'Failed to create procedure');
  }

  // Update a procedure
  async updateProcedure(procedureId, procedureData) {
    return this.put(`${this.endpoint}/${procedureId}`, procedureData, 'Failed to update procedure');
  }

  // Delete a procedure
  async deleteProcedure(procedureId) {
    return this.delete(`${this.endpoint}/${procedureId}`, 'Failed to delete procedure');
  }
}

export default ProcedureApiService;
