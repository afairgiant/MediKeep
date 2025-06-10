import BaseApiService from './baseApi';

class PatientApiService extends BaseApiService {
  // Get current user/patient info
  async getCurrentPatient() {
    return this.get('/api/v1/patients/me', 'Failed to fetch user data');
  }

  // Create current patient information
  async createCurrentPatient(patientData) {
    return this.post('/api/v1/patients/me', patientData, 'Failed to create patient information');
  }

  // Update current patient information
  async updateCurrentPatient(patientData) {
    return this.put('/api/v1/patients/me', patientData, 'Failed to update patient information');
  }

  // Get recent activity (you'll need to implement this endpoint in FastAPI)
  async getRecentActivity() {
    try {
      return await this.get('/api/v1/activity/recent');
    } catch (error) {
      console.log('Recent activity endpoint not implemented yet');
      return [];
    }
  }
}

export default PatientApiService;
