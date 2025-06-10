// Practitioner API Service
import BaseApiService from './baseApi';

class PractitionerApiService extends BaseApiService {
  constructor() {
    super();
    this.endpoint = '/api/v1/practitioners';
  }

  /**
   * Get all practitioners
   * @param {Object} params - Query parameters
   * @param {number} params.skip - Number of records to skip
   * @param {number} params.limit - Maximum number of records to return
   * @param {string} params.specialty - Filter by specialty
   * @returns {Promise<Array>} List of practitioners
   */  async getPractitioners(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.skip !== undefined) {
        queryParams.append('skip', params.skip);
      }
      if (params.limit !== undefined) {
        queryParams.append('limit', params.limit);
      }
      if (params.specialty) {
        queryParams.append('specialty', params.specialty);
      }

      const endpoint = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
      return await this.get(endpoint, 'Failed to fetch practitioners');
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      throw error;
    }
  }

  /**
   * Get a specific practitioner by ID
   * @param {number} practitionerId - The practitioner ID
   * @returns {Promise<Object>} Practitioner details
   */  async getPractitioner(practitionerId) {
    try {
      return await this.get(`${this.endpoint}/${practitionerId}`, 'Failed to fetch practitioner');
    } catch (error) {
      console.error('Error fetching practitioner:', error);
      throw error;
    }
  }

  /**
   * Create a new practitioner
   * @param {Object} practitionerData - Practitioner data
   * @param {string} practitionerData.name - Practitioner name
   * @param {string} practitionerData.specialty - Practitioner specialty
   * @param {string} practitionerData.practice - Practitioner practice
   * @returns {Promise<Object>} Created practitioner
   */  async createPractitioner(practitionerData) {
    try {
      return await this.post(this.endpoint, practitionerData, 'Failed to create practitioner');
    } catch (error) {
      console.error('Error creating practitioner:', error);
      throw error;
    }
  }

  /**
   * Update an existing practitioner
   * @param {number} practitionerId - The practitioner ID
   * @param {Object} practitionerData - Updated practitioner data
   * @returns {Promise<Object>} Updated practitioner
   */  async updatePractitioner(practitionerId, practitionerData) {
    try {
      return await this.put(`${this.endpoint}/${practitionerId}`, practitionerData, 'Failed to update practitioner');
    } catch (error) {
      console.error('Error updating practitioner:', error);
      throw error;
    }
  }

  /**
   * Delete a practitioner
   * @param {number} practitionerId - The practitioner ID
   * @returns {Promise<Object>} Deletion confirmation
   */  async deletePractitioner(practitionerId) {
    try {
      return await this.delete(`${this.endpoint}/${practitionerId}`, 'Failed to delete practitioner');
    } catch (error) {
      console.error('Error deleting practitioner:', error);
      throw error;
    }
  }
}

export default PractitionerApiService;
