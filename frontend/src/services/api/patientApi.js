/**
 * V1 Patient Management API Service
 * Handles Netflix-style patient switching and management
 */

import BaseApiService from './baseApi';
import logger from '../logger';

class PatientApiService extends BaseApiService {
  constructor() {
    super('/patient-management');
  }

  /**
   * Create a new patient record
   * @param {Object} patientData - Patient data
   * @returns {Promise<Object>} Created patient
   */
  async createPatient(patientData) {
    logger.info('patient_api_create', {
      message: 'Creating patient record',
      isSelfRecord: patientData.is_self_record
    });

    try {
      const result = await this.post('/', patientData, 'Failed to create patient');
      logger.info('patient_api_create_success', {
        message: 'Patient created successfully',
        patientId: result.id
      });
      return result;
    } catch (error) {
      logger.error('patient_api_create_error', {
        message: 'Failed to create patient',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all accessible patients
   * @param {string} permission - Required permission level
   * @returns {Promise<Object>} Patient list response
   */
  async getAccessiblePatients(permission = 'view') {
    logger.debug('patient_api_list', {
      message: 'Getting accessible patients',
      permission
    });

    try {
      const result = await this.get(`/?permission=${permission}`, { errorMessage: 'Failed to get patients' });
      logger.debug('patient_api_list_success', {
        message: 'Patients retrieved successfully',
        count: result.total_count
      });
      return result;
    } catch (error) {
      logger.error('patient_api_list_error', {
        message: 'Failed to get patients',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get a specific patient by ID
   * @param {number} patientId - Patient ID
   * @returns {Promise<Object>} Patient data
   */
  async getPatient(patientId) {
    logger.debug('patient_api_get', {
      message: 'Getting patient by ID',
      patientId
    });

    try {
      const result = await this.get(`/${patientId}`, { errorMessage: 'Failed to get patient' });
      logger.debug('patient_api_get_success', {
        message: 'Patient retrieved successfully',
        patientId
      });
      return result;
    } catch (error) {
      logger.error('patient_api_get_error', {
        message: 'Failed to get patient',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update a patient record
   * @param {number} patientId - Patient ID
   * @param {Object} patientData - Updated patient data
   * @returns {Promise<Object>} Updated patient
   */
  async updatePatient(patientId, patientData) {
    logger.info('patient_api_update', {
      message: 'Updating patient record',
      patientId
    });

    try {
      const result = await this.put(`/${patientId}`, patientData, 'Failed to update patient');
      logger.info('patient_api_update_success', {
        message: 'Patient updated successfully',
        patientId
      });
      return result;
    } catch (error) {
      logger.error('patient_api_update_error', {
        message: 'Failed to update patient',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete a patient record
   * @param {number} patientId - Patient ID
   * @returns {Promise<Object>} Success message
   */
  async deletePatient(patientId) {
    logger.info('patient_api_delete', {
      message: 'Deleting patient record',
      patientId
    });

    try {
      const result = await this.delete(`/${patientId}`, 'Failed to delete patient');
      logger.info('patient_api_delete_success', {
        message: 'Patient deleted successfully',
        patientId
      });
      return result;
    } catch (error) {
      logger.error('patient_api_delete_error', {
        message: 'Failed to delete patient',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get patients owned by current user
   * @returns {Promise<Array>} Owned patients
   */
  async getOwnedPatients() {
    logger.debug('patient_api_owned', {
      message: 'Getting owned patients'
    });

    try {
      const result = await this.get('/owned/list', { errorMessage: 'Failed to get owned patients' });
      logger.debug('patient_api_owned_success', {
        message: 'Owned patients retrieved successfully',
        count: result.length
      });
      return result;
    } catch (error) {
      logger.error('patient_api_owned_error', {
        message: 'Failed to get owned patients',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's self-record patient
   * @returns {Promise<Object|null>} Self-record patient or null
   */
  async getSelfRecord() {
    logger.debug('patient_api_self', {
      message: 'Getting self-record patient'
    });

    try {
      const result = await this.get('/self-record', { errorMessage: 'Failed to get self-record' });
      logger.debug('patient_api_self_success', {
        message: 'Self-record retrieved successfully',
        hasSelfRecord: !!result
      });
      return result;
    } catch (error) {
      logger.error('patient_api_self_error', {
        message: 'Failed to get self-record',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Switch active patient (Netflix-style switching)
   * @param {number} patientId - Patient ID to switch to
   * @returns {Promise<Object>} Active patient data
   */
  async switchActivePatient(patientId) {
    logger.info('patient_api_switch', {
      message: 'Switching active patient',
      patientId
    });

    try {
      const result = await this.post('/switch', { patient_id: patientId }, 'Failed to switch patient');
      logger.info('patient_api_switch_success', {
        message: 'Patient switched successfully',
        patientId
      });
      return result;
    } catch (error) {
      logger.error('patient_api_switch_error', {
        message: 'Failed to switch patient',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get currently active patient
   * @returns {Promise<Object|null>} Active patient or null
   */
  async getActivePatient() {
    logger.debug('patient_api_active', {
      message: 'Getting active patient'
    });

    try {
      const result = await this.get('/active/current', { errorMessage: 'Failed to get active patient' });
      logger.debug('patient_api_active_success', {
        message: 'Active patient retrieved successfully',
        hasActivePatient: !!result
      });
      return result;
    } catch (error) {
      logger.error('patient_api_active_error', {
        message: 'Failed to get active patient',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get patient statistics
   * @returns {Promise<Object>} Patient statistics
   */
  async getPatientStats() {
    logger.debug('patient_api_stats', {
      message: 'Getting patient statistics'
    });

    try {
      const result = await this.get('/stats', { errorMessage: 'Failed to get patient statistics' });
      logger.debug('patient_api_stats_success', {
        message: 'Patient statistics retrieved successfully',
        ownedCount: result.owned_count,
        accessibleCount: result.accessible_count
      });
      return result;
    } catch (error) {
      logger.error('patient_api_stats_error', {
        message: 'Failed to get patient statistics',
        error: error.message
      });
      throw error;
    }
  }
}

export default new PatientApiService();