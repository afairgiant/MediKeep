import BaseApiService from './baseApi';

class AllergyApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/allergies';
  }

  // Get all allergies
  async getAllergies() {
    return this.get(this.endpoint, 'Failed to fetch allergies');
  }

  // Get allergies for a specific patient
  async getPatientAllergies(patientId) {
    return this.get(`${this.endpoint}?patient_id=${patientId}`, 'Failed to fetch patient allergies');
  }

  // Get active allergies for a patient
  async getActiveAllergies(patientId) {
    return this.get(`${this.endpoint}/patient/${patientId}/active`, 'Failed to fetch active allergies');
  }

  // Get critical allergies for a patient
  async getCriticalAllergies(patientId) {
    return this.get(`${this.endpoint}/patient/${patientId}/critical`, 'Failed to fetch critical allergies');
  }

  // Get a specific allergy by ID
  async getAllergy(allergyId) {
    return this.get(`${this.endpoint}/${allergyId}`, 'Failed to fetch allergy');
  }

  // Create a new allergy
  async createAllergy(allergyData) {
    return this.post(this.endpoint, allergyData, 'Failed to create allergy');
  }

  // Update an allergy
  async updateAllergy(allergyId, allergyData) {
    return this.put(`${this.endpoint}/${allergyId}`, allergyData, 'Failed to update allergy');
  }

  // Delete an allergy
  async deleteAllergy(allergyId) {
    return this.delete(`${this.endpoint}/${allergyId}`, 'Failed to delete allergy');
  }

  // Check for allergen conflicts
  async checkAllergenConflict(patientId, allergen) {
    return this.get(`${this.endpoint}/patient/${patientId}/check/${allergen}`, 'Failed to check allergen conflict');
  }
}

export default AllergyApiService;
