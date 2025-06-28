/**
 * VitalsForm Component
 * Form for creating and editing patient vital signs
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { vitalsService } from '../../services/medical/vitalsService';
import { useTimezone } from '../../hooks';
import { validateDateTime } from '../../utils/helpers';
import './VitalsForm.css';

const VitalsForm = ({
  vitals = null,
  patientId,
  practitionerId,
  onSave,
  onCancel,
  isEdit = false,
}) => {
  const { isReady, getCurrentTime, facilityTimezone } = useTimezone();

  const [formData, setFormData] = useState({
    patient_id: patientId || '',
    practitioner_id: practitionerId || null, // Use null instead of empty string
    recorded_date: getCurrentTime().split('T')[0], // Use facility timezone for default
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    weight: '',
    height: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedBMI, setCalculatedBMI] = useState(null);

  useEffect(() => {
    if (vitals && isEdit) {
      setFormData({
        ...vitals,
        recorded_date: vitals.recorded_date
          ? new Date(vitals.recorded_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      });
    }
  }, [vitals, isEdit]);

  useEffect(() => {
    // Calculate BMI when weight or height changes
    if (formData.weight && formData.height) {
      const bmi = vitalsService.calculateBMI(
        parseFloat(formData.weight),
        parseFloat(formData.height)
      );
      setCalculatedBMI(bmi);
    } else {
      setCalculatedBMI(null);
    }
  }, [formData.weight, formData.height]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const validation = vitalsService.validateVitalsData(formData);
    let newErrors = { ...validation.errors };

    // Additional timezone-aware date validation
    if (formData.recorded_date) {
      const dateValidation = validateDateTime(
        formData.recorded_date,
        'Recorded Date'
      );
      if (!dateValidation.isValid) {
        newErrors.recorded_date = dateValidation.error;
      }
    }

    setErrors(newErrors);
    setWarnings(validation.warnings);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please correct the form errors');
      return;
    }

    setIsLoading(true);

    try {
      // Convert string values to numbers where appropriate
      const processedData = {
        ...formData,
        systolic_bp: formData.systolic_bp
          ? parseInt(formData.systolic_bp)
          : null,
        diastolic_bp: formData.diastolic_bp
          ? parseInt(formData.diastolic_bp)
          : null,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
        temperature: formData.temperature
          ? parseFloat(formData.temperature)
          : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        respiratory_rate: formData.respiratory_rate
          ? parseInt(formData.respiratory_rate)
          : null,
        oxygen_saturation: formData.oxygen_saturation
          ? parseInt(formData.oxygen_saturation)
          : null,
        // Set practitioner_id to null if not provided or invalid
        practitioner_id: formData.practitioner_id || null,
      };

      let result;
      if (isEdit && vitals?.id) {
        result = await vitalsService.updateVitals(vitals.id, processedData);
        toast.success('Vitals updated successfully');
      } else {
        result = await vitalsService.createVitals(processedData);
        toast.success('Vitals recorded successfully');
      }

      if (onSave) {
        onSave(result);
      }
    } catch (error) {
      // Error handling for vitals save operation
      toast.error(error.response?.data?.detail || 'Failed to save vitals');
    } finally {
      setIsLoading(false);
    }
  };

  const getBMICategory = () => {
    if (!calculatedBMI) return '';
    return vitalsService.getBMICategory(calculatedBMI);
  };

  const getBPCategory = () => {
    if (!formData.systolic_bp || !formData.diastolic_bp) return '';
    return vitalsService.getBloodPressureCategory(
      parseInt(formData.systolic_bp),
      parseInt(formData.diastolic_bp)
    );
  };

  return (
    <div className="vitals-form">
      <h3>{isEdit ? 'Edit Vitals' : 'Record New Vitals'}</h3>

      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((warning, index) => (
            <div key={index} className="warning-message">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="recorded_date">
              Measurement Date <span className="required">*</span>
              {isReady && (
                <small className="timezone-info">({facilityTimezone})</small>
              )}
            </label>
            <input
              type="date"
              id="recorded_date"
              name="recorded_date"
              value={formData.recorded_date}
              onChange={handleInputChange}
              required
              className={errors.recorded_date ? 'error' : ''}
            />
            {errors.recorded_date && (
              <span className="error-text">{errors.recorded_date}</span>
            )}
          </div>
        </div>

        <div className="form-section">
          <h4>Blood Pressure</h4>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="systolic_bp">Systolic (mmHg)</label>
              <input
                type="number"
                id="systolic_bp"
                name="systolic_bp"
                value={formData.systolic_bp}
                onChange={handleInputChange}
                placeholder="120"
                min="50"
                max="300"
                className={errors.systolic_bp ? 'error' : ''}
              />
              {errors.systolic_bp && (
                <span className="error-text">{errors.systolic_bp}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="diastolic_bp">Diastolic (mmHg)</label>
              <input
                type="number"
                id="diastolic_bp"
                name="diastolic_bp"
                value={formData.diastolic_bp}
                onChange={handleInputChange}
                placeholder="80"
                min="30"
                max="200"
                className={errors.diastolic_bp ? 'error' : ''}
              />
              {errors.diastolic_bp && (
                <span className="error-text">{errors.diastolic_bp}</span>
              )}
            </div>

            {getBPCategory() && (
              <div className="form-group category-display">
                <label>Category</label>
                <div
                  className={`bp-category ${getBPCategory().toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {getBPCategory()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h4>Physical Measurements</h4>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="weight">Weight (lbs)</label>{' '}
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                placeholder="150"
                step="0.1"
                min="0.1"
                max="2200"
                className={errors.weight ? 'error' : ''}
              />
              {errors.weight && (
                <span className="error-text">{errors.weight}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="height">Height (inches)</label>
              <input
                type="number"
                id="height"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                placeholder="175"
                step="0.1"
                min="10"
                max="300"
                className={errors.height ? 'error' : ''}
              />
              {errors.height && (
                <span className="error-text">{errors.height}</span>
              )}
            </div>

            {calculatedBMI && (
              <div className="form-group category-display">
                <label>BMI</label>
                <div className="bmi-display">
                  <div className="bmi-value">{calculatedBMI}</div>
                  <div
                    className={`bmi-category ${getBMICategory().toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {getBMICategory()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h4>Vital Signs</h4>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="heart_rate">Heart Rate (BPM)</label>
              <input
                type="number"
                id="heart_rate"
                name="heart_rate"
                value={formData.heart_rate}
                onChange={handleInputChange}
                placeholder="72"
                min="30"
                max="250"
                className={errors.heart_rate ? 'error' : ''}
              />
              {errors.heart_rate && (
                <span className="error-text">{errors.heart_rate}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="temperature">Temperature (°F)</label>
              <input
                type="number"
                id="temperature"
                name="temperature"
                value={formData.temperature}
                onChange={handleInputChange}
                placeholder="98.6"
                step="0.1"
                min="90"
                max="110"
                className={errors.temperature ? 'error' : ''}
              />
              {errors.temperature && (
                <span className="error-text">{errors.temperature}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="respiratory_rate">
                Respiratory Rate (breaths/min)
              </label>
              <input
                type="number"
                id="respiratory_rate"
                name="respiratory_rate"
                value={formData.respiratory_rate}
                onChange={handleInputChange}
                placeholder="16"
                min="5"
                max="100"
                className={errors.respiratory_rate ? 'error' : ''}
              />
              {errors.respiratory_rate && (
                <span className="error-text">{errors.respiratory_rate}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="oxygen_saturation">Oxygen Saturation (%)</label>
              <input
                type="number"
                id="oxygen_saturation"
                name="oxygen_saturation"
                value={formData.oxygen_saturation}
                onChange={handleInputChange}
                placeholder="98"
                min="50"
                max="100"
                className={errors.oxygen_saturation ? 'error' : ''}
              />
              {errors.oxygen_saturation && (
                <span className="error-text">{errors.oxygen_saturation}</span>
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes about the vital signs measurement..."
              rows="3"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Update Vitals' : 'Save Vitals'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VitalsForm;
