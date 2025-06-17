import logger from '../logger';

// Streamlined API service with proper logging integration
class ApiService {
  constructor() {
    // Always use relative URLs in production for Docker compatibility
    this.baseURL =
      process.env.NODE_ENV === 'production'
        ? '/api/v1'
        : 'http://localhost:8000/api/v1';
    // Fallback URLs for better Docker compatibility
    this.fallbackURL = '/api/v1';
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };

    if (token) {
      try {
        // Check if token is expired
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        if (payload.exp < currentTime) {
          logger.warn('Token expired, removing from storage');
          localStorage.removeItem('token');
          return headers;
        }

        headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        logger.error('Invalid token format', { error: e.message });
        localStorage.removeItem('token');
      }
    }

    return headers;
  }
  async handleResponse(response, method, url) {
    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage;
      let fullErrorData;

      try {
        fullErrorData = JSON.parse(errorData);
        errorMessage =
          fullErrorData.detail || fullErrorData.message || errorData; // For 422 errors, log the full validation details
        if (response.status === 422) {
          console.error('Validation Error Details:', fullErrorData);
          if (fullErrorData.detail && Array.isArray(fullErrorData.detail)) {
            const validationErrors = fullErrorData.detail
              .map(err => `${err.loc?.join('.')} - ${err.msg}`)
              .join('; ');
            errorMessage = `Validation Error: ${validationErrors}`;
          }
        }
      } catch {
        errorMessage =
          errorData ||
          `HTTP error! status: ${response.status} - ${response.statusText}`;
      }

      logger.apiError('API Error', method, url, response.status, errorMessage);
      throw new Error(errorMessage);
    }

    logger.debug('API request successful', {
      method,
      url,
      status: response.status,
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else if (
      contentType &&
      (contentType.includes('application/octet-stream') ||
        contentType.includes('image/') ||
        contentType.includes('application/pdf'))
    ) {
      return response.blob();
    }
    return response.text();
  } // Core request method with logging and fallback
  async request(method, url, data = null, options = {}) {
    const { signal, headers: customHeaders = {}, responseType } = options;

    // Get token and validate it exists
    const token = localStorage.getItem('token');
    if (!token) {
      logger.error('No authentication token found');
      throw new Error('Authentication required. Please log in again.');
    }

    const config = {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`, // Always include auth token
        ...customHeaders,
      },
    };

    // Handle different data types
    if (data instanceof FormData) {
      delete config.headers['Content-Type']; // Let browser set the boundary
      config.body = data;
    } else if (data instanceof URLSearchParams) {
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      config.body = data;
    } else if (data) {
      config.body = JSON.stringify(data);
    }

    // Try multiple URLs for Docker compatibility
    const urls = [this.baseURL + url, this.fallbackURL + url];
    let lastError = null;

    for (let i = 0; i < urls.length; i++) {
      const fullUrl = urls[i];
      try {
        logger.debug(
          `${method} request attempt ${i + 1}/${urls.length} to ${fullUrl}`,
          {
            url: fullUrl,
            hasAuth: !!token,
          }
        );

        const response = await fetch(fullUrl, config);

        // Handle blob responses specially
        if (responseType === 'blob' && response.ok) {
          return response.blob();
        }

        return this.handleResponse(response, fullUrl, method);
      } catch (error) {
        console.warn(`Failed to connect to ${fullUrl}:`, error.message);
        lastError = error;

        // Continue to next URL if this one fails and we have more URLs to try
        if (i < urls.length - 1) {
          continue;
        }
      }
    }

    // If all URLs failed, log and throw the last error
    logger.apiError(lastError, url, method);
    throw (
      lastError ||
      new Error(`Failed to connect to any API endpoint for ${method} ${url}`)
    );
  }
  // Generic HTTP methods with signal support
  get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  }

  post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }

  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  }

  // Simplified API methods for backward compatibility  // Auth methods
  login(username, password, signal) {
    // FastAPI OAuth2PasswordRequestForm expects form-encoded data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    return this.request('POST', '/auth/login/', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal,
    });
  }

  register(username, password, email, fullName, signal) {
    return this.post(
      '/auth/register/',
      {
        username,
        password,
        email,
        full_name: fullName,
      },
      { signal }
    );
  }
  // Patient methods
  getCurrentPatient(signal) {
    return this.get('/patients/me/', { signal });
  }

  createCurrentPatient(patientData, signal) {
    return this.post('/patients/me/', patientData, { signal });
  }

  updateCurrentPatient(patientData, signal) {
    return this.put('/patients/me/', patientData, { signal });
  }

  getRecentActivity(signal) {
    return this.get('/patients/recent-activity/', { signal });
  }

  // Lab Result methods
  getLabResults(signal) {
    return this.get('/lab-results/', { signal });
  }
  getPatientLabResults(patientId, signal) {
    return this.get(`/lab-results/?patient_id=${patientId}`, { signal });
  }
  getLabResult(labResultId, signal) {
    return this.get(`/lab-results/${labResultId}`, { signal });
  }

  createLabResult(labResultData, signal) {
    return this.post('/lab-results/', labResultData, { signal });
  }

  updateLabResult(labResultId, labResultData, signal) {
    return this.put(`/lab-results/${labResultId}`, labResultData, { signal });
  }

  deleteLabResult(labResultId, signal) {
    return this.delete(`/lab-results/${labResultId}`, { signal });
  }
  getLabResultFiles(labResultId, signal) {
    return this.get(`/lab-results/${labResultId}/files`, { signal });
  }
  uploadLabResultFile(labResultId, file, description = '', signal) {
    const formData = new FormData();
    formData.append('file', file);
    if (description && description.trim()) {
      formData.append('description', description);
    }
    return this.post(`/lab-results/${labResultId}/files`, formData, { signal });
  }
  downloadLabResultFile(fileId, signal) {
    return this.get(`/lab-result-files/${fileId}/download`, {
      responseType: 'blob',
      signal,
    });
  }
  deleteLabResultFile(fileId, signal) {
    return this.delete(`/lab-result-files/${fileId}`, { signal });
  }

  // Medication methods
  getMedications(signal) {
    return this.get('/medications/', { signal });
  }
  getPatientMedications(patientId, signal) {
    return this.get(`/medications/?patient_id=${patientId}`, { signal });
  }

  createMedication(medicationData, signal) {
    // Clean up empty strings which might cause backend validation issues
    const cleanPayload = {};
    Object.keys(medicationData).forEach(key => {
      const value = medicationData[key];
      if (value !== '' && value !== null && value !== undefined) {
        cleanPayload[key] = value;
      }
    });

    // Ensure required fields
    if (!cleanPayload.medication_name) {
      throw new Error('Medication name is required');
    }

    return this.post(`/medications/`, cleanPayload, { signal });
  }
  updateMedication(medicationId, medicationData, signal) {
    return this.put(`/medications/${medicationId}`, medicationData, { signal });
  }

  deleteMedication(medicationId, signal) {
    return this.delete(`/medications/${medicationId}`, { signal });
  }

  // Immunization methods
  getImmunizations(signal) {
    return this.get('/immunizations/', { signal });
  }
  getPatientImmunizations(patientId, signal) {
    return this.get(`/immunizations/?patient_id=${patientId}`, { signal });
  }

  createImmunization(immunizationData, signal) {
    return this.post('/immunizations/', immunizationData, { signal });
  }
  updateImmunization(immunizationId, immunizationData, signal) {
    return this.put(`/immunizations/${immunizationId}`, immunizationData, {
      signal,
    });
  }

  deleteImmunization(immunizationId, signal) {
    return this.delete(`/immunizations/${immunizationId}`, { signal });
  }

  // Practitioner methods
  getPractitioners(signal) {
    return this.get('/practitioners/', { signal });
  }

  getPractitioner(practitionerId, signal) {
    return this.get(`/practitioners/${practitionerId}`, { signal });
  }

  createPractitioner(practitionerData, signal) {
    return this.post('/practitioners/', practitionerData, { signal });
  }

  updatePractitioner(practitionerId, practitionerData, signal) {
    return this.put(`/practitioners/${practitionerId}`, practitionerData, {
      signal,
    });
  }

  deletePractitioner(practitionerId, signal) {
    return this.delete(`/practitioners/${practitionerId}`, { signal });
  }

  // Allergy methods
  getAllergies(signal) {
    return this.get('/allergies/', { signal });
  }
  getPatientAllergies(patientId, signal) {
    return this.get(`/allergies/?patient_id=${patientId}`, { signal });
  }
  getAllergy(allergyId, signal) {
    return this.get(`/allergies/${allergyId}`, { signal });
  }

  createAllergy(allergyData, signal) {
    return this.post('/allergies/', allergyData, { signal });
  }

  updateAllergy(allergyId, allergyData, signal) {
    return this.put(`/allergies/${allergyId}`, allergyData, { signal });
  }

  deleteAllergy(allergyId, signal) {
    return this.delete(`/allergies/${allergyId}`, { signal });
  }

  // Treatment methods
  getTreatments(signal) {
    return this.get('/treatments/', { signal });
  }
  getPatientTreatments(patientId, signal) {
    return this.get(`/treatments/?patient_id=${patientId}`, { signal });
  }
  getTreatment(treatmentId, signal) {
    return this.get(`/treatments/${treatmentId}`, { signal });
  }

  createTreatment(treatmentData, signal) {
    return this.post('/treatments/', treatmentData, { signal });
  }

  updateTreatment(treatmentId, treatmentData, signal) {
    return this.put(`/treatments/${treatmentId}`, treatmentData, { signal });
  }

  deleteTreatment(treatmentId, signal) {
    return this.delete(`/treatments/${treatmentId}`, { signal });
  }

  // Procedure methods
  getProcedures(signal) {
    return this.get('/procedures/', { signal });
  }
  getPatientProcedures(patientId, signal) {
    return this.get(`/procedures/?patient_id=${patientId}`, { signal });
  }
  getProcedure(procedureId, signal) {
    return this.get(`/procedures/${procedureId}`, { signal });
  }

  createProcedure(procedureData, signal) {
    return this.post('/procedures/', procedureData, { signal });
  }
  updateProcedure(procedureId, procedureData, signal) {
    return this.put(`/procedures/${procedureId}`, procedureData, { signal });
  }

  deleteProcedure(procedureId, signal) {
    return this.delete(`/procedures/${procedureId}`, { signal });
  }

  // Condition methods
  getConditions(signal) {
    return this.get('/conditions/', { signal });
  }
  getPatientConditions(patientId, signal) {
    return this.get(`/conditions/?patient_id=${patientId}`, { signal });
  }
  getCondition(conditionId, signal) {
    return this.get(`/conditions/${conditionId}`, { signal });
  }

  createCondition(conditionData, signal) {
    return this.post('/conditions/', conditionData, { signal });
  }

  updateCondition(conditionId, conditionData, signal) {
    return this.put(`/conditions/${conditionId}`, conditionData, { signal });
  }

  deleteCondition(conditionId, signal) {
    return this.delete(`/conditions/${conditionId}`, { signal });
  }

  // Encounter methods
  getEncounters(signal) {
    return this.get('/encounters/', { signal });
  }
  getPatientEncounters(patientId, signal) {
    return this.get(`/encounters/?patient_id=${patientId}`, { signal });
  }
  getEncounter(encounterId, signal) {
    return this.get(`/encounters/${encounterId}`, { signal });
  }

  createEncounter(encounterData, signal) {
    return this.post('/encounters/', encounterData, { signal });
  }

  updateEncounter(encounterId, encounterData, signal) {
    return this.put(`/encounters/${encounterId}`, encounterData, { signal });
  }

  deleteEncounter(encounterId, signal) {
    return this.delete(`/encounters/${encounterId}`, { signal });
  }
}

export const apiService = new ApiService();
export default apiService;
