import BaseApiService from './baseApi';

class EncounterApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/encounters';
  }

  // Get all encounters
  async getEncounters(params = {}) {
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
    if (params.practitioner_id) {
      queryParams.append('practitioner_id', params.practitioner_id);
    }
    if (params.encounter_type) {
      queryParams.append('encounter_type', params.encounter_type);
    }
    if (params.status) {
      queryParams.append('status', params.status);
    }

    const endpoint = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
    return this.get(endpoint, 'Failed to fetch encounters');
  }

  // Get encounters for a specific patient
  async getPatientEncounters(patientId, params = {}) {
    return this.getEncounters({ ...params, patient_id: patientId });
  }

  // Get recent encounters for a patient
  async getRecentEncounters(patientId, days = 30) {
    return this.get(`${this.endpoint}/patient/${patientId}/recent?days=${days}`, 'Failed to fetch recent encounters');
  }

  // Get encounters for a specific practitioner
  async getPractitionerEncounters(practitionerId, params = {}) {
    return this.getEncounters({ ...params, practitioner_id: practitionerId });
  }

  // Get a specific encounter by ID
  async getEncounter(encounterId) {
    return this.get(`${this.endpoint}/${encounterId}`, 'Failed to fetch encounter');
  }

  // Create a new encounter
  async createEncounter(encounterData) {
    return this.post(this.endpoint, encounterData, 'Failed to create encounter');
  }

  // Update an encounter
  async updateEncounter(encounterId, encounterData) {
    return this.put(`${this.endpoint}/${encounterId}`, encounterData, 'Failed to update encounter');
  }

  // Delete an encounter
  async deleteEncounter(encounterId) {
    return this.delete(`${this.endpoint}/${encounterId}`, 'Failed to delete encounter');
  }
}

export default EncounterApiService;
