/**
 * Medical data service for handling patient medical records
 */

import { apiService } from '../api';

class MedicalService {
  /**
   * Get patient medications
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getMedications(patientId) {
    return await apiService.getPatientMedications(patientId);
  }

  /**
   * Create new medication
   * @param {Object} medicationData
   * @returns {Promise<Object>}
   */
  async createMedication(medicationData) {
    return await apiService.createMedication(medicationData);
  }

  /**
   * Update medication
   * @param {number} medicationId
   * @param {Object} medicationData
   * @returns {Promise<Object>}
   */
  async updateMedication(medicationId, medicationData) {
    return await apiService.updateMedication(medicationId, medicationData);
  }

  /**
   * Delete medication
   * @param {number} medicationId
   * @returns {Promise<void>}
   */
  async deleteMedication(medicationId) {
    return await apiService.deleteMedication(medicationId);
  }

  /**
   * Get lab results for patient
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getLabResults(patientId) {
    return await apiService.getLabResults();
  }

  /**
   * Create new lab result
   * @param {Object} labResultData
   * @returns {Promise<Object>}
   */
  async createLabResult(labResultData) {
    return await apiService.createLabResult(labResultData);
  }

  /**
   * Update lab result
   * @param {number} labResultId
   * @param {Object} labResultData
   * @returns {Promise<Object>}
   */
  async updateLabResult(labResultId, labResultData) {
    return await apiService.updateLabResult(labResultId, labResultData);
  }

  /**
   * Delete lab result
   * @param {number} labResultId
   * @returns {Promise<void>}
   */
  async deleteLabResult(labResultId) {
    return await apiService.deleteLabResult(labResultId);
  }

  /**
   * Upload file for lab result
   * @param {number} labResultId
   * @param {File} file
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async uploadLabResultFile(labResultId, file, description = '') {
    return await apiService.uploadLabResultFile(labResultId, file, description);
  }

  /**
   * Get files for lab result
   * @param {number} labResultId
   * @returns {Promise<Array>}
   */
  async getLabResultFiles(labResultId) {
    return await apiService.getLabResultFiles(labResultId);
  }

  /**
   * Download lab result file
   * @param {number} fileId
   * @returns {Promise<Blob>}
   */
  async downloadLabResultFile(fileId) {
    return await apiService.downloadLabResultFile(fileId);
  }

  /**
   * Delete lab result file
   * @param {number} fileId
   * @returns {Promise<void>}
   */
  async deleteLabResultFile(fileId) {
    return await apiService.deleteLabResultFile(fileId);
  }

  /**
   * Get patient information
   * @returns {Promise<Object>}
   */
  async getPatientInfo() {
    return await apiService.getCurrentPatient();
  }

  /**
   * Update patient information
   * @param {Object} patientData
   * @returns {Promise<Object>}
   */
  async updatePatientInfo(patientData) {
    return await apiService.updateCurrentPatient(patientData);
  }

  /**
   * Create patient record
   * @param {Object} patientData
   * @returns {Promise<Object>}
   */
  async createPatientInfo(patientData) {
    return await apiService.createCurrentPatient(patientData);
  }

  /**
   * Get recent medical activity
   * @returns {Promise<Array>}
   */
  async getRecentActivity() {
    return await apiService.getRecentActivity();
  }

  /**
   * Get vitals for patient
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getVitals(patientId) {
    return await apiService.getPatientVitals(patientId);
  }

  /**
   * Create new vitals record
   * @param {Object} vitalsData
   * @returns {Promise<Object>}
   */
  async createVitals(vitalsData) {
    return await apiService.createVitals(vitalsData);
  }

  /**
   * Update vitals record
   * @param {number} vitalsId
   * @param {Object} vitalsData
   * @returns {Promise<Object>}
   */
  async updateVitals(vitalsId, vitalsData) {
    return await apiService.updateVitals(vitalsId, vitalsData);
  }

  /**
   * Delete vitals record
   * @param {number} vitalsId
   * @returns {Promise<void>}
   */
  async deleteVitals(vitalsId) {
    return await apiService.deleteVitals(vitalsId);
  }

  /**
   * Get vitals statistics for patient
   * @param {number} patientId
   * @returns {Promise<Object>}
   */
  async getVitalsStats(patientId) {
    return await apiService.getPatientVitalsStats(patientId);
  }
}

export const medicalService = new MedicalService();
export default medicalService;
