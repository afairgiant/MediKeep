// New streamlined API service with abort signal support

class ApiService {  
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  }  // Core request method with abort signal support
  async request(endpoint, options = {}) {    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    // Debug logging - REMOVE THIS LATER
    console.log('🔍 API REQUEST DEBUG:', {
      url,
      method: config.method,
      hasToken: !!token,
      tokenLength: token?.length,
      headers: config.headers,
      authHeader: config.headers.Authorization
    });

    // Pass through abort signal
    if (options.signal) {
      config.signal = options.signal;
    }
    
    try {
      const response = await fetch(url, config);
      
      // Debug logging for response - REMOVE THIS LATER
      if (!response.ok) {
        console.error('🚨 API REQUEST FAILED:', {
          url,
          method: config.method,
          status: response.status,
          statusText: response.statusText,
          headers: config.headers
        });
        
        // Try to get the error response body
        try {
          const errorBody = await response.clone().text();
          console.error('🚨 ERROR RESPONSE BODY:', errorBody);
        } catch (e) {
          console.error('🚨 Could not read error response body');
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      if (options.responseType === 'blob') {
        return response.blob();
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response.text();
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  // Generic HTTP methods with signal support
  get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }
  post(endpoint, data, options = {}) {
    const isFormData = data instanceof FormData;
    const body = isFormData ? data : JSON.stringify(data);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const additionalHeaders = isFormData 
      ? {} 
      : { 'Content-Type': 'application/json' };
      return this.request(endpoint, {
      method: 'POST',
      body,
      headers: {
        ...additionalHeaders,
        ...options.headers
      },
      ...options,
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  // Simplified API methods for backward compatibility
  // Auth methods
  login(username, password, signal) {
    // FastAPI OAuth2PasswordRequestForm expects form-encoded data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    return this.request('/auth/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      signal
    });
  }

  register(username, password, email, fullName, signal) {
    return this.post('/auth/register/', { 
      username, 
      password, 
      email, 
      full_name: fullName 
    }, { signal });
  }

  // Patient methods
  getCurrentPatient(signal) {
    return this.get('/patients/current/', { signal });
  }

  createCurrentPatient(patientData, signal) {
    return this.post('/patients/', patientData, { signal });
  }

  updateCurrentPatient(patientData, signal) {
    return this.put('/patients/current/', patientData, { signal });
  }

  getRecentActivity(signal) {
    return this.get('/patients/recent-activity/', { signal });
  }

  // Lab Result methods
  getLabResults(signal) {
    return this.get('/lab-results/', { signal });
  }

  getPatientLabResults(patientId, signal) {
    return this.get(`/patients/${patientId}/lab-results/`, { signal });
  }

  getLabResult(labResultId, signal) {
    return this.get(`/lab-results/${labResultId}/`, { signal });
  }

  createLabResult(labResultData, signal) {
    return this.post('/lab-results/', labResultData, { signal });
  }

  updateLabResult(labResultId, labResultData, signal) {
    return this.put(`/lab-results/${labResultId}/`, labResultData, { signal });
  }

  deleteLabResult(labResultId, signal) {
    return this.delete(`/lab-results/${labResultId}/`, { signal });
  }

  getLabResultFiles(labResultId, signal) {
    return this.get(`/lab-results/${labResultId}/files/`, { signal });
  }

  uploadLabResultFile(labResultId, file, description = '', signal) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    return this.post(`/lab-results/${labResultId}/files/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal
    });
  }

  downloadLabResultFile(fileId, signal) {
    return this.get(`/lab-result-files/${fileId}/download/`, { 
      responseType: 'blob',
      signal 
    });
  }

  deleteLabResultFile(fileId, signal) {
    return this.delete(`/lab-result-files/${fileId}/`, { signal });
  }

  // Medication methods
  getMedications(signal) {
    return this.get('/medications/', { signal });
  }  getPatientMedications(patientId, signal) {
    return this.get(`/patients/${patientId}/medications/`, { signal });
  }
  
  createMedication(medicationData, signal) {
    // Use the original medications endpoint that we know works
    return this.post('/medications/', medicationData, { signal });
  }

  updateMedication(medicationId, medicationData, signal) {
    return this.put(`/medications/${medicationId}/`, medicationData, { signal });
  }

  deleteMedication(medicationId, signal) {
    return this.delete(`/medications/${medicationId}/`, { signal });
  }

  // Immunization methods
  getImmunizations(signal) {
    return this.get('/immunizations/', { signal });
  }

  getPatientImmunizations(patientId, signal) {
    return this.get(`/patients/${patientId}/immunizations/`, { signal });
  }

  createImmunization(immunizationData, signal) {
    return this.post('/immunizations/', immunizationData, { signal });
  }

  updateImmunization(immunizationId, immunizationData, signal) {
    return this.put(`/immunizations/${immunizationId}/`, immunizationData, { signal });
  }

  deleteImmunization(immunizationId, signal) {
    return this.delete(`/immunizations/${immunizationId}/`, { signal });
  }

  // Practitioner methods
  getPractitioners(signal) {
    return this.get('/practitioners/', { signal });
  }

  getPractitioner(practitionerId, signal) {
    return this.get(`/practitioners/${practitionerId}/`, { signal });
  }

  createPractitioner(practitionerData, signal) {
    return this.post('/practitioners/', practitionerData, { signal });
  }

  updatePractitioner(practitionerId, practitionerData, signal) {
    return this.put(`/practitioners/${practitionerId}/`, practitionerData, { signal });
  }

  deletePractitioner(practitionerId, signal) {
    return this.delete(`/practitioners/${practitionerId}/`, { signal });
  }

  // Allergy methods
  getAllergies(signal) {
    return this.get('/allergies/', { signal });
  }

  getPatientAllergies(patientId, signal) {
    return this.get(`/patients/${patientId}/allergies/`, { signal });
  }

  getAllergy(allergyId, signal) {
    return this.get(`/allergies/${allergyId}/`, { signal });
  }

  createAllergy(allergyData, signal) {
    return this.post('/allergies/', allergyData, { signal });
  }

  updateAllergy(allergyId, allergyData, signal) {
    return this.put(`/allergies/${allergyId}/`, allergyData, { signal });
  }

  deleteAllergy(allergyId, signal) {
    return this.delete(`/allergies/${allergyId}/`, { signal });
  }

  // Treatment methods
  getTreatments(signal) {
    return this.get('/treatments/', { signal });
  }

  getPatientTreatments(patientId, signal) {
    return this.get(`/patients/${patientId}/treatments/`, { signal });
  }

  getTreatment(treatmentId, signal) {
    return this.get(`/treatments/${treatmentId}/`, { signal });
  }

  createTreatment(treatmentData, signal) {
    return this.post('/treatments/', treatmentData, { signal });
  }

  updateTreatment(treatmentId, treatmentData, signal) {
    return this.put(`/treatments/${treatmentId}/`, treatmentData, { signal });
  }

  deleteTreatment(treatmentId, signal) {
    return this.delete(`/treatments/${treatmentId}/`, { signal });
  }

  // Procedure methods
  getProcedures(signal) {
    return this.get('/procedures/', { signal });
  }

  getPatientProcedures(patientId, signal) {
    return this.get(`/patients/${patientId}/procedures/`, { signal });
  }

  getProcedure(procedureId, signal) {
    return this.get(`/procedures/${procedureId}/`, { signal });
  }

  createProcedure(procedureData, signal) {
    return this.post('/procedures/', procedureData, { signal });
  }

  updateProcedure(procedureId, procedureData, signal) {
    return this.put(`/procedures/${procedureId}/`, procedureData, { signal });
  }

  deleteProcedure(procedureId, signal) {
    return this.delete(`/procedures/${procedureId}/`, { signal });
  }

  // Condition methods
  getConditions(signal) {
    return this.get('/conditions/', { signal });
  }

  getPatientConditions(patientId, signal) {
    return this.get(`/patients/${patientId}/conditions/`, { signal });
  }

  getCondition(conditionId, signal) {
    return this.get(`/conditions/${conditionId}/`, { signal });
  }

  createCondition(conditionData, signal) {
    return this.post('/conditions/', conditionData, { signal });
  }

  updateCondition(conditionId, conditionData, signal) {
    return this.put(`/conditions/${conditionId}/`, conditionData, { signal });
  }

  deleteCondition(conditionId, signal) {
    return this.delete(`/conditions/${conditionId}/`, { signal });
  }

  // Encounter methods
  getEncounters(signal) {
    return this.get('/encounters/', { signal });
  }

  getPatientEncounters(patientId, signal) {
    return this.get(`/patients/${patientId}/encounters/`, { signal });
  }

  getEncounter(encounterId, signal) {
    return this.get(`/encounters/${encounterId}/`, { signal });
  }

  createEncounter(encounterData, signal) {
    return this.post('/encounters/', encounterData, { signal });
  }

  updateEncounter(encounterId, encounterData, signal) {
    return this.put(`/encounters/${encounterId}/`, encounterData, { signal });
  }

  deleteEncounter(encounterId, signal) {
    return this.delete(`/encounters/${encounterId}/`, { signal });
  }
}

export const apiService = new ApiService();
export default apiService;