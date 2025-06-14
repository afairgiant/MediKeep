import { apiService } from '../services/api/index';

export const apiMethods = {
  allergies: {
    getAll: (signal) => apiService.get('/allergies/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/allergies/`, { signal }),
    create: (data, signal) => apiService.post('/allergies/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/allergies/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/allergies/${id}/`, { signal })
  },
    conditions: {
    getAll: (signal) => apiService.get('/conditions/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/conditions/`, { signal }),
    create: (data, signal) => {
      debugger; // 🔍 BREAKPOINT: API method create called
      console.log('🌐 API: Creating condition with data:', data);
      return apiService.post('/conditions/', data, { signal });
    },
    update: (id, data, signal) => apiService.put(`/conditions/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/conditions/${id}/`, { signal })
  },
  
  immunizations: {
    getAll: (signal) => apiService.get('/immunizations/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/immunizations/`, { signal }),
    create: (data, signal) => apiService.post('/immunizations/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/immunizations/${id}/`, data, { signal }),    delete: (id, signal) => apiService.delete(`/immunizations/${id}/`, { signal })
  },
  
  medications: {
    getAll: (signal) => apiService.get('/medications/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/medications/`, { signal }),
    create: (data, signal) => apiService.post(`/patients/${data.patient_id || 'current'}/medications/`, data, { signal }),
    update: (id, data, signal) => apiService.put(`/medications/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/medications/${id}/`, { signal })
  },
  
  procedures: {
    getAll: (signal) => apiService.get('/procedures/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/procedures/`, { signal }),
    create: (data, signal) => apiService.post('/procedures/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/procedures/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/procedures/${id}/`, { signal })
  },
  
  treatments: {
    getAll: (signal) => apiService.get('/treatments/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/treatments/`, { signal }),
    create: (data, signal) => apiService.post('/treatments/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/treatments/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/treatments/${id}/`, { signal })
  },
  
  encounters: {
    getAll: (signal) => apiService.get('/encounters/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/patients/${patientId}/encounters/`, { signal }),
    create: (data, signal) => apiService.post('/encounters/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/encounters/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/encounters/${id}/`, { signal })
  },
  
  practitioners: {
    getAll: (signal) => apiService.get('/practitioners/', { signal }),
    create: (data, signal) => apiService.post('/practitioners/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/practitioners/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/practitioners/${id}/`, { signal })
  },
  
  labResults: {
    getAll: (signal) => apiService.get('/lab-results/', { signal }),
    getByPatient: (patientId, signal) => apiService.get(`/lab-results/patient/${patientId}/`, { signal }),
    create: (data, signal) => apiService.post('/lab-results/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/lab-results/${id}/`, { signal }), 
    delete: (id, signal) => apiService.delete(`/lab-results/${id}/`, { signal }),
    // File operations
    getFiles: (labResultId, signal) => apiService.get(`/lab-results/${labResultId}/files/`, { signal }),
    uploadFile: (labResultId, file, description, signal) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      return apiService.post(`/lab-results/${labResultId}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal
      });
    },
    downloadFile: (fileId, signal) => apiService.get(`/lab-result-files/${fileId}/download/`, { 
      responseType: 'blob',
      signal 
    }),
    deleteFile: (fileId, signal) => apiService.delete(`/lab-result-files/${fileId}/`, { signal }) // Added trailing slash
  },

  patients: {
    getCurrent: (signal) => apiService.get('/patients/current/', { signal }),    getAll: (signal) => apiService.get('/patients/', { signal }),
    getById: (id, signal) => apiService.get(`/patients/${id}`, { signal }),
    create: (data, signal) => apiService.post('/patients/', data, { signal }),
    update: (id, data, signal) => apiService.put(`/patients/${id}/`, data, { signal }),
    delete: (id, signal) => apiService.delete(`/patients/${id}/`, { signal })
  }
};