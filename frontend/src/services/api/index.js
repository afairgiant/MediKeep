// Main API service that combines all modular services
import AuthApiService from './authApi';
import PatientApiService from './patientApi';
import LabResultApiService from './labResultApi';
import MedicationApiService from './medicationApi';
import ImmunizationApiService from './immunizationApi';
import PractitionerApiService from './practitionerApi';

class ApiService {
  constructor() {
    // Initialize all API modules
    this.auth = new AuthApiService();
    this.patient = new PatientApiService();
    this.labResult = new LabResultApiService();
    this.medication = new MedicationApiService();
    this.immunization = new ImmunizationApiService();
    this.practitioner = new PractitionerApiService();
  }

  // Backward compatibility methods - delegate to appropriate modules
  // Auth methods
  login(username, password) {
    return this.auth.login(username, password);
  }

  // Patient methods
  getCurrentPatient() {
    return this.patient.getCurrentPatient();
  }

  createCurrentPatient(patientData) {
    return this.patient.createCurrentPatient(patientData);
  }

  updateCurrentPatient(patientData) {
    return this.patient.updateCurrentPatient(patientData);
  }

  getRecentActivity() {
    return this.patient.getRecentActivity();
  }

  // Lab Result methods
  getLabResults() {
    return this.labResult.getLabResults();
  }

  getPatientLabResults(patientId) {
    return this.labResult.getPatientLabResults(patientId);
  }

  getLabResult(labResultId) {
    return this.labResult.getLabResult(labResultId);
  }

  createLabResult(labResultData) {
    return this.labResult.createLabResult(labResultData);
  }

  updateLabResult(labResultId, labResultData) {
    return this.labResult.updateLabResult(labResultId, labResultData);
  }

  deleteLabResult(labResultId) {
    return this.labResult.deleteLabResult(labResultId);
  }

  getLabResultFiles(labResultId) {
    return this.labResult.getLabResultFiles(labResultId);
  }

  uploadLabResultFile(labResultId, file, description = '') {
    return this.labResult.uploadLabResultFile(labResultId, file, description);
  }

  downloadLabResultFile(fileId) {
    return this.labResult.downloadLabResultFile(fileId);
  }

  deleteLabResultFile(fileId) {
    return this.labResult.deleteLabResultFile(fileId);
  }

  // Medication methods
  getMedications() {
    return this.medication.getMedications();
  }

  getPatientMedications(patientId) {
    return this.medication.getPatientMedications(patientId);
  }

  createMedication(medicationData) {
    return this.medication.createMedication(medicationData);
  }

  updateMedication(medicationId, medicationData) {
    return this.medication.updateMedication(medicationId, medicationData);
  }

  deleteMedication(medicationId) {
    return this.medication.deleteMedication(medicationId);
  }

  // Immunization methods
  getImmunizations() {
    return this.immunization.getImmunizations();
  }

  getPatientImmunizations(patientId) {
    return this.immunization.getPatientImmunizations(patientId);
  }

  createImmunization(immunizationData) {
    return this.immunization.createImmunization(immunizationData);
  }

  updateImmunization(immunizationId, immunizationData) {
    return this.immunization.updateImmunization(immunizationId, immunizationData);
  }
  deleteImmunization(immunizationId) {
    return this.immunization.deleteImmunization(immunizationId);
  }

  // Practitioner methods
  getPractitioners(params) {
    return this.practitioner.getPractitioners(params);
  }

  getPractitioner(practitionerId) {
    return this.practitioner.getPractitioner(practitionerId);
  }

  createPractitioner(practitionerData) {
    return this.practitioner.createPractitioner(practitionerData);
  }

  updatePractitioner(practitionerId, practitionerData) {
    return this.practitioner.updatePractitioner(practitionerId, practitionerData);
  }

  deletePractitioner(practitionerId) {
    return this.practitioner.deletePractitioner(practitionerId);
  }
}

export const apiService = new ApiService();
export default apiService;
