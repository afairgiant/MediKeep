/**
 * Vitals Service
 * Handles all API calls related to patient vital signs
 */

import { apiClient } from '../apiClient';

class VitalsService {
  /**
   * Get all vitals with optional pagination
   * @param {Object} params - Query parameters (skip, limit)
   * @returns {Promise<Array>}
   */
  async getVitals(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/vitals/?${queryParams}` : '/vitals/';
      return await apiClient.get(url);
    } catch (error) {
      // Error fetching vitals
      throw error;
    }
  }

  /**
   * Get vitals by ID
   * @param {number} vitalsId
   * @returns {Promise<Object>}
   */
  async getVitalsById(vitalsId) {
    try {
      return await apiClient.get(`/vitals/${vitalsId}`);
    } catch (error) {
      // Error fetching vitals by ID
      throw error;
    }
  }

  /**
   * Create new vitals record
   * @param {Object} vitalsData
   * @returns {Promise<Object>}
   */
  async createVitals(vitalsData) {
    try {
      return await apiClient.post('/vitals/', vitalsData);
    } catch (error) {
      // Error creating vitals
      throw error;
    }
  }

  /**
   * Update vitals record
   * @param {number} vitalsId
   * @param {Object} vitalsData
   * @returns {Promise<Object>}
   */
  async updateVitals(vitalsId, vitalsData) {
    try {
      return await apiClient.put(`/vitals/${vitalsId}`, vitalsData);
    } catch (error) {
      // Error updating vitals
      throw error;
    }
  }

  /**
   * Delete vitals record
   * @param {number} vitalsId
   * @returns {Promise<void>}
   */
  async deleteVitals(vitalsId) {
    try {
      return await apiClient.delete(`/vitals/${vitalsId}`);
    } catch (error) {
      // Error deleting vitals
      throw error;
    }
  }

  /**
   * Get vitals for a specific patient
   * @param {number} patientId
   * @param {Object} params - Query parameters (skip, limit, start_date, end_date)
   * @returns {Promise<Array>}
   */
  async getPatientVitals(patientId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams
        ? `/vitals/patient/${patientId}?${queryParams}`
        : `/vitals/patient/${patientId}`;
      return await apiClient.get(url);
    } catch (error) {
      // Error fetching patient vitals
      throw error;
    }
  }

  /**
   * Get paginated vitals for a specific patient with total count
   * @param {number} patientId
   * @param {Object} params - Query parameters (skip, limit, vital_type)
   * @returns {Promise<{items: Array, total: number, skip: number, limit: number}>}
   */
  async getPatientVitalsPaginated(patientId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams
        ? `/vitals/patient/${patientId}/paginated?${queryParams}`
        : `/vitals/patient/${patientId}/paginated`;
      const response = await apiClient.get(url);
      // Unwrap data from API client response wrapper
      return response?.data ?? response;
    } catch (error) {
      // Error fetching paginated patient vitals
      throw error;
    }
  }

  /**
   * Get vitals statistics for a patient
   * @param {number} patientId
   * @param {Object} params - Query parameters (start_date, end_date)
   * @returns {Promise<Object>}
   */
  async getPatientVitalsStats(patientId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams
        ? `/vitals/patient/${patientId}/stats?${queryParams}`
        : `/vitals/patient/${patientId}/stats`;
      return await apiClient.get(url);
    } catch (error) {
      // Error fetching patient vitals stats
      throw error;
    }
  }

  /**
   * Get vitals for a patient within date range
   * @param {number} patientId
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Array>}
   */
  async getPatientVitalsDateRange(patientId, startDate, endDate, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        ...params,
      }).toString();
      return await apiClient.get(
        `/vitals/patient/${patientId}/date-range?${queryParams}`
      );
    } catch (error) {
      // Error fetching patient vitals by date range
      throw error;
    }
  }
  /**
   * Calculate BMI from height and weight
   * @param {number} weight - Weight in lbs
   * @param {number} height - Height in inches
   * @returns {number} BMI value
   */
  calculateBMI(weight, height) {
    if (!weight || !height || weight <= 0 || height <= 0) {
      return null;
    }

    // Convert weight from lbs to kg
    const weightInKg = weight / 2.205;

    // Convert height from inches to meters
    const heightInMeters = height * 0.0254;

    // Calculate BMI: weight(kg) / height(m)²
    const bmi = weightInKg / (heightInMeters * heightInMeters);

    return parseFloat(bmi.toFixed(1));
  }
  /**
   * Get BMI category
   * @param {number} bmi
   * @returns {string} BMI category
   */
  getBMICategory(bmi) {
    if (!bmi || bmi <= 0) return 'Unknown';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Above normal weight';
  }

  /**
   * Get blood pressure category
   * @param {number} systolic
   * @param {number} diastolic
   * @returns {string} Blood pressure category
   */
  getBloodPressureCategory(systolic, diastolic) {
    if (!systolic || !diastolic) return 'Unknown';

    if (systolic < 120 && diastolic < 80) return 'Normal';
    if (systolic < 130 && diastolic < 80) return 'Elevated';
    if (
      (systolic >= 130 && systolic < 140) ||
      (diastolic >= 80 && diastolic < 90)
    ) {
      return 'Stage 1 Hypertension';
    }
    if (
      (systolic >= 140 && systolic < 180) ||
      (diastolic >= 90 && diastolic < 120)
    ) {
      return 'Stage 2 Hypertension';
    }
    if (systolic >= 180 || diastolic >= 120) return 'Hypertensive Crisis';

    return 'Unknown';
  }

  /**
   * Validate vitals data
   * @param {Object} vitalsData
   * @returns {Object} Validation result
   */
  validateVitalsData(vitalsData) {
    const errors = {};
    const warnings = []; // Required fields
    if (!vitalsData.patient_id) errors.patient_id = 'Patient is required';
    if (!vitalsData.recorded_date)
      errors.recorded_date = 'Measurement date is required';

    // Blood pressure validation
    if (vitalsData.systolic_bp) {
      if (vitalsData.systolic_bp < 50 || vitalsData.systolic_bp > 300) {
        errors.systolic_bp = 'Systolic BP must be between 50-300 mmHg';
      }
    }
    if (vitalsData.diastolic_bp) {
      if (vitalsData.diastolic_bp < 30 || vitalsData.diastolic_bp > 200) {
        errors.diastolic_bp = 'Diastolic BP must be between 30-200 mmHg';
      }
    }

    // Heart rate validation
    if (vitalsData.heart_rate) {
      if (vitalsData.heart_rate < 30 || vitalsData.heart_rate > 250) {
        errors.heart_rate = 'Heart rate must be between 30-250 BPM';
      }
    }

    // Temperature validation
    if (vitalsData.temperature) {
      if (vitalsData.temperature < 90 || vitalsData.temperature > 110) {
        errors.temperature = 'Temperature must be between 90-110°F';
      }
    } // Weight validation
    if (vitalsData.weight) {
      if (vitalsData.weight < 0.1 || vitalsData.weight > 2200) {
        errors.weight = 'Weight must be between 0.1-2200 lbs';
      }
    } // Height validation (in inches)
    if (vitalsData.height) {
      if (vitalsData.height < 12 || vitalsData.height > 120) {
        errors.height = 'Height must be between 12-120 inches';
      }
    }

    // Blood glucose validation
    if (vitalsData.blood_glucose) {
      if (vitalsData.blood_glucose < 20 || vitalsData.blood_glucose > 800) {
        errors.blood_glucose = 'Blood glucose must be between 20-800 mg/dL';
      }
    }

    // A1C validation
    if (vitalsData.a1c) {
      if (vitalsData.a1c < 0 || vitalsData.a1c > 20) {
        errors.a1c = 'A1C must be between 0-20%';
      }
    }

    // Add warnings for unusual values
    if (vitalsData.systolic_bp && vitalsData.diastolic_bp) {
      const bpCategory = this.getBloodPressureCategory(
        vitalsData.systolic_bp,
        vitalsData.diastolic_bp
      );
      if (
        bpCategory.includes('Hypertension') ||
        bpCategory === 'Hypertensive Crisis'
      ) {
        warnings.push(`Blood pressure indicates ${bpCategory}`);
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get vitals statistics for the current user
   * @param {Object} params - Query parameters (start_date, end_date)
   * @returns {Promise<Object>}
   */
  async getVitalsStats(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams
        ? `/vitals/stats?${queryParams}`
        : `/vitals/stats`;
      return await apiClient.get(url);
    } catch (error) {
      // Error fetching current user vitals stats
      throw error;
    }
  }
}

export const vitalsService = new VitalsService();
