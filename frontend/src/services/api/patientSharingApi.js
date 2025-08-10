/**
 * V1 Patient Sharing API Service
 * Handles individual patient sharing functionality
 */

import BaseApiService from './baseApi';
import logger from '../logger';

class PatientSharingApiService extends BaseApiService {
  constructor() {
    super('/patient-sharing');
  }

  /**
   * Share a patient with another user
   * @param {Object} shareData - Sharing data
   * @returns {Promise<Object>} Created share
   */
  async sharePatient(shareData) {
    logger.info('patient_sharing_create', {
      message: 'Creating patient share',
      patientId: shareData.patient_id,
      sharedWithIdentifier: shareData.shared_with_user_identifier,
      permissionLevel: shareData.permission_level
    });

    try {
      const result = await this.post('/', shareData, 'Failed to share patient');
      logger.info('patient_sharing_create_success', {
        message: 'Patient shared successfully',
        shareId: result.id,
        patientId: shareData.patient_id,
        sharedWithIdentifier: shareData.shared_with_user_identifier
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_create_error', {
        message: 'Failed to share patient',
        patientId: shareData.patient_id,
        sharedWithIdentifier: shareData.shared_with_user_identifier,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove current user's access to a shared patient
   * @param {number} patientId - Patient ID
   * @returns {Promise<Object>} Success message
   */
  async removeMyAccess(patientId) {
    logger.info('patient_sharing_remove_my_access', {
      message: 'Removing my access to shared patient',
      patientId
    });

    try {
      const data = await this.delete(`/remove-my-access/${patientId}`, 'Failed to remove access');
      
      logger.info('patient_sharing_remove_my_access_success', {
        message: 'Successfully removed my access to patient',
        patientId
      });
      return data;
    } catch (error) {
      logger.error('patient_sharing_remove_my_access_error', {
        message: 'Failed to remove my access to patient',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Revoke patient sharing access (owner revoking access from another user)
   * @param {number} patientId - Patient ID
   * @param {number} sharedWithUserId - User ID to revoke access from
   * @returns {Promise<Object>} Success message
   */
  async revokePatientShare(patientId, sharedWithUserId) {
    logger.info('patient_sharing_revoke', {
      message: 'Revoking patient share',
      patientId,
      sharedWithUserId
    });

    try {
      const data = await this.deleteWithBody('/revoke', {
        patient_id: patientId,
        shared_with_user_id: sharedWithUserId
      }, 'Failed to revoke patient share');
      
      logger.info('patient_sharing_revoke_success', {
        message: 'Patient share revoked successfully',
        patientId,
        sharedWithUserId
      });
      return data;
    } catch (error) {
      logger.error('patient_sharing_revoke_error', {
        message: 'Failed to revoke patient share',
        patientId,
        sharedWithUserId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update an existing patient share
   * @param {number} patientId - Patient ID
   * @param {number} sharedWithUserId - User ID with access
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated share
   */
  async updatePatientShare(patientId, sharedWithUserId, updateData) {
    logger.info('patient_sharing_update', {
      message: 'Updating patient share',
      patientId,
      sharedWithUserId
    });

    try {
      const result = await this.put(
        `/?patient_id=${patientId}&shared_with_user_id=${sharedWithUserId}`,
        updateData,
        'Failed to update patient share'
      );
      
      logger.info('patient_sharing_update_success', {
        message: 'Patient share updated successfully',
        shareId: result.id,
        patientId,
        sharedWithUserId
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_update_error', {
        message: 'Failed to update patient share',
        patientId,
        sharedWithUserId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all active shares for a patient
   * @param {number} patientId - Patient ID
   * @returns {Promise<Object>} Patient shares response
   */
  async getPatientShares(patientId) {
    logger.debug('patient_sharing_get_shares', {
      message: 'Getting patient shares',
      patientId
    });

    try {
      const result = await this.get(`/${patientId}`, { errorMessage: 'Failed to get patient shares' });
      logger.debug('patient_sharing_get_shares_success', {
        message: 'Patient shares retrieved successfully',
        patientId,
        shareCount: result.total_count
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_get_shares_error', {
        message: 'Failed to get patient shares',
        patientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user sharing statistics
   * @returns {Promise<Object>} User sharing statistics
   */
  async getUserSharingStats() {
    logger.debug('patient_sharing_get_stats', {
      message: 'Getting user sharing statistics'
    });

    try {
      const result = await this.get('/stats/user', { errorMessage: 'Failed to get sharing statistics' });
      logger.debug('patient_sharing_get_stats_success', {
        message: 'Sharing statistics retrieved successfully',
        sharedByMe: result.shared_by_me,
        sharedWithMe: result.shared_with_me
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_get_stats_error', {
        message: 'Failed to get sharing statistics',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get shares received by current user
   * @returns {Promise<Array>} Shares received
   */
  async getSharesReceived() {
    logger.debug('patient_sharing_get_received', {
      message: 'Getting shares received'
    });

    try {
      const result = await this.get('/shared-with-me', { errorMessage: 'Failed to get received shares' });
      logger.debug('patient_sharing_get_received_success', {
        message: 'Received shares retrieved successfully',
        count: result.length
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_get_received_error', {
        message: 'Failed to get received shares',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get shares created by current user
   * @returns {Promise<Array>} Shares created
   */
  async getSharesCreated() {
    logger.debug('patient_sharing_get_created', {
      message: 'Getting shares created'
    });

    try {
      const result = await this.get('/shared-by-me', { errorMessage: 'Failed to get created shares' });
      logger.debug('patient_sharing_get_created_success', {
        message: 'Created shares retrieved successfully',
        count: result.length
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_get_created_error', {
        message: 'Failed to get created shares',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired shares (admin function)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpiredShares() {
    logger.info('patient_sharing_cleanup', {
      message: 'Cleaning up expired shares'
    });

    try {
      const result = await this.post('/cleanup-expired', {}, 'Failed to cleanup expired shares');
      logger.info('patient_sharing_cleanup_success', {
        message: 'Expired shares cleaned up successfully',
        result: result.message
      });
      return result;
    } catch (error) {
      logger.error('patient_sharing_cleanup_error', {
        message: 'Failed to cleanup expired shares',
        error: error.message
      });
      throw error;
    }
  }
}

export default new PatientSharingApiService();