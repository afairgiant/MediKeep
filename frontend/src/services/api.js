// API service for making requests to FastAPI backend
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  : 'http://localhost:8000'; // Direct connection for development

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Helper method to handle authentication errors
  handleAuthError(response) {
    if (response.status === 401) {
      // Clear the token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      return true;
    }
    return false;
  }
  // Login method
  async login(username, password) {
    try {
      const url = `${this.baseURL}/api/v1/auth/login`;
      console.log('Making login request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }
  }  // Get current user/patient info
  async getCurrentPatient() {
    const response = await fetch(`${this.baseURL}/api/v1/patients/me`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch user data');
    }

    return response.json();
  }// Create current patient information
  async createCurrentPatient(patientData) {
    const response = await fetch(`${this.baseURL}/api/v1/patients/me`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patientData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to create patient information');
    }

    return response.json();
  }
  // Update current patient information
  async updateCurrentPatient(patientData) {
    const response = await fetch(`${this.baseURL}/api/v1/patients/me`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(patientData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to update patient information');
    }

    return response.json();
  }

  // Get recent activity (you'll need to implement this endpoint in FastAPI)
  async getRecentActivity() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/activity/recent`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        return []; // Return empty array if endpoint doesn't exist yet
      }

      return response.json();
    } catch (error) {
      console.log('Recent activity endpoint not implemented yet');
      return [];
    }
  }
  // Get lab results
  async getLabResults() {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lab results');
    }

    return response.json();
  }

  // Get lab results for a specific patient
  async getPatientLabResults(patientId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results/patient/${patientId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch patient lab results');
    }

    return response.json();
  }

  // Get a specific lab result by ID
  async getLabResult(labResultId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results/${labResultId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lab result');
    }

    return response.json();
  }

  // Create a new lab result
  async createLabResult(labResultData) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(labResultData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to create lab result');
    }

    return response.json();
  }

  // Update a lab result
  async updateLabResult(labResultId, labResultData) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results/${labResultId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(labResultData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to update lab result');
    }

    return response.json();
  }

  // Delete a lab result
  async deleteLabResult(labResultId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-results/${labResultId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to delete lab result');
    }

    return response.json();
  }

  // Get files for a specific lab result
  async getLabResultFiles(labResultId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/lab-result/${labResultId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lab result files');
    }

    return response.json();
  }

  // Upload a file for a lab result
  async uploadLabResultFile(labResultId, file, description = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/upload/${labResultId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
        // Don't set Content-Type header for FormData, let browser set it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
  }

  // Download a lab result file
  async downloadLabResultFile(fileId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/${fileId}/download`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    return response.blob();
  }

  // Delete a lab result file
  async deleteLabResultFile(fileId) {
    const response = await fetch(`${this.baseURL}/api/v1/lab-result-files/${fileId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete file');
    }

    return response.json();
  }
  // Get medications
  async getMedications() {
    const response = await fetch(`${this.baseURL}/api/v1/medications`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch medications');
    }

    return response.json();
  }

  // Get medications for a specific patient
  async getPatientMedications(patientId) {
    const response = await fetch(`${this.baseURL}/api/v1/medications/patient/${patientId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch patient medications');
    }

    return response.json();
  }
  // Create a new medication
  async createMedication(medicationData) {
    const response = await fetch(`${this.baseURL}/api/v1/medications`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(medicationData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to create medication');
    }

    return response.json();
  }
  // Update a medication
  async updateMedication(medicationId, medicationData) {
    const response = await fetch(`${this.baseURL}/api/v1/medications/${medicationId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(medicationData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to update medication');
    }

    return response.json();
  }
  // Delete a medication
  async deleteMedication(medicationId) {
    const response = await fetch(`${this.baseURL}/api/v1/medications/${medicationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to delete medication');
    }

    return response.json();
  }

  // ===== IMMUNIZATION METHODS =====
  
  // Get immunizations
  async getImmunizations() {
    const response = await fetch(`${this.baseURL}/api/v1/immunizations/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch immunizations');
    }

    return response.json();
  }
  // Get immunizations for a specific patient
  async getPatientImmunizations(patientId) {
    const response = await fetch(`${this.baseURL}/api/v1/immunizations/?patient_id=${patientId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch patient immunizations');
    }

    return response.json();
  }
  // Create new immunization
  async createImmunization(immunizationData) {
    const response = await fetch(`${this.baseURL}/api/v1/immunizations/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(immunizationData)
    });

    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to create immunization');
    }

    return response.json();
  }
  // Update an immunization
  async updateImmunization(immunizationId, immunizationData) {
    const response = await fetch(`${this.baseURL}/api/v1/immunizations/${immunizationId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(immunizationData)
    });

    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to update immunization');
    }

    return response.json();
  }
  // Delete an immunization
  async deleteImmunization(immunizationId) {
    const response = await fetch(`${this.baseURL}/api/v1/immunizations/${immunizationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      // Check for authentication errors first
      if (this.handleAuthError(response)) {
        return; // Will redirect to login
      }
      
      const error = await response.json();
      
      // Handle validation errors (Pydantic errors)
      if (Array.isArray(error.detail)) {
        const validationErrors = error.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation errors: ${validationErrors}`);
      }
      
      throw new Error(error.detail || 'Failed to delete immunization');
    }

    return response.json();
  }

  // Add more API methods as needed for other endpoints
}

export const apiService = new ApiService();
export default apiService;
