/**
 * VitalsForm Component - Enhanced Version
 * Modern form for creating and editing patient vital signs with improved UX
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Save,
  X,
  AlertTriangle,
  Info,
  Heart,
  Activity,
  Thermometer,
  Weight,
  Zap,
  Calendar,
  User,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { vitalsService } from '../../services/medical/vitalsService';
import { useTimezone } from '../../hooks';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import { validateDateTime } from '../../utils/helpers';
import './VitalsForm.css';

// Form field configurations with enhanced metadata
const FORM_FIELDS = {
  basic: {
    title: 'Basic Information',
    icon: Calendar,
    fields: ['recorded_date'],
  },
  bloodPressure: {
    title: 'Blood Pressure',
    icon: Heart,
    fields: ['systolic_bp', 'diastolic_bp'],
    description: 'Measured in mmHg',
  },
  physical: {
    title: 'Physical Measurements',
    icon: Weight,
    fields: ['weight'],
    description: 'Weight in lbs',
  },
  vitals: {
    title: 'Vital Signs',
    icon: Activity,
    fields: [
      'heart_rate',
      'temperature',
      'respiratory_rate',
      'oxygen_saturation',
    ],
    description: 'Core physiological measurements',
  },
  notes: {
    title: 'Additional Information',
    icon: FileText,
    fields: ['notes'],
  },
};

// Field definitions with validation and display metadata
const FIELD_CONFIGS = {
  recorded_date: {
    label: 'Measurement Date',
    type: 'date',
    required: true,
    icon: Calendar,
    validation: {
      required: 'Measurement date is required',
      custom: value => {
        const result = validateDateTime(value, 'Recorded Date');
        return result.isValid ? null : result.error;
      },
    },
  },
  systolic_bp: {
    label: 'Systolic BP',
    type: 'number',
    unit: 'mmHg',
    placeholder: '120',
    icon: Heart,
    min: 50,
    max: 300,
    step: 1,
    validation: {
      min: { value: 50, message: 'Systolic BP must be at least 50 mmHg' },
      max: { value: 300, message: 'Systolic BP cannot exceed 300 mmHg' },
    },
  },
  diastolic_bp: {
    label: 'Diastolic BP',
    type: 'number',
    unit: 'mmHg',
    placeholder: '80',
    icon: Heart,
    min: 30,
    max: 200,
    step: 1,
    validation: {
      min: { value: 30, message: 'Diastolic BP must be at least 30 mmHg' },
      max: { value: 200, message: 'Diastolic BP cannot exceed 200 mmHg' },
    },
  },
  heart_rate: {
    label: 'Heart Rate',
    type: 'number',
    unit: 'BPM',
    placeholder: '72',
    icon: Activity,
    min: 30,
    max: 250,
    step: 1,
    validation: {
      min: { value: 30, message: 'Heart rate must be at least 30 BPM' },
      max: { value: 250, message: 'Heart rate cannot exceed 250 BPM' },
    },
  },
  temperature: {
    label: 'Temperature',
    type: 'number',
    unit: '°F',
    placeholder: '98.6',
    icon: Thermometer,
    min: 90,
    max: 110,
    step: 0.1,
    validation: {
      min: { value: 90, message: 'Temperature must be at least 90°F' },
      max: { value: 110, message: 'Temperature cannot exceed 110°F' },
    },
  },
  weight: {
    label: 'Weight',
    type: 'number',
    unit: 'lbs',
    placeholder: '150',
    icon: Weight,
    min: 0.1,
    max: 2200,
    step: 0.1,
    validation: {
      min: { value: 0.1, message: 'Weight must be at least 0.1 lbs' },
      max: { value: 2200, message: 'Weight cannot exceed 2200 lbs' },
    },
  },
  respiratory_rate: {
    label: 'Respiratory Rate',
    type: 'number',
    unit: '/min',
    placeholder: '16',
    icon: Activity,
    min: 5,
    max: 100,
    step: 1,
    validation: {
      min: { value: 5, message: 'Respiratory rate must be at least 5/min' },
      max: { value: 100, message: 'Respiratory rate cannot exceed 100/min' },
    },
  },
  oxygen_saturation: {
    label: 'Oxygen Saturation',
    type: 'number',
    unit: '%',
    placeholder: '98',
    icon: Zap,
    min: 50,
    max: 100,
    step: 1,
    validation: {
      min: { value: 50, message: 'Oxygen saturation must be at least 50%' },
      max: { value: 100, message: 'Oxygen saturation cannot exceed 100%' },
    },
  },
  notes: {
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Additional notes about the vital signs measurement...',
    icon: FileText,
    rows: 3,
  },
};

const VitalsForm = ({
  vitals = null,
  patientId,
  practitionerId,
  onSave,
  onCancel,
  isEdit = false,
}) => {
  const { isReady, getCurrentTime, facilityTimezone } = useTimezone();
  const { patient: currentPatient } = useCurrentPatient();

  // Form state
  const [formData, setFormData] = useState({
    patient_id: patientId || '',
    practitioner_id: practitionerId || null,
    recorded_date: getCurrentTime().split('T')[0],
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    weight: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [touchedFields, setTouchedFields] = useState(new Set());

  // Get height from patient profile
  const patientHeight = useMemo(() => {
    return currentPatient?.height || null;
  }, [currentPatient?.height]);

  // Initialize form data when editing
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

  // Calculated values
  const calculatedBMI = useMemo(() => {
    if (formData.weight && patientHeight) {
      return vitalsService.calculateBMI(
        parseFloat(formData.weight),
        parseFloat(patientHeight)
      );
    }
    return null;
  }, [formData.weight, patientHeight]);

  // Field validation
  const validateField = useCallback((fieldName, value) => {
    const config = FIELD_CONFIGS[fieldName];
    if (!config || !config.validation) return null;

    const validation = config.validation;

    // Required validation
    if (validation.required && (!value || value.toString().trim() === '')) {
      return validation.required;
    }

    // Skip other validations if field is empty (and not required)
    if (!value || value.toString().trim() === '') return null;

    // Numeric validations
    if (config.type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return 'Must be a valid number';

      if (validation.min && numValue < validation.min.value) {
        return validation.min.message;
      }
      if (validation.max && numValue > validation.max.value) {
        return validation.max.message;
      }
    }

    // Custom validation
    if (validation.custom) {
      return validation.custom(value);
    }

    return null;
  }, []);

  // Real-time validation
  const validateForm = useCallback(() => {
    const newErrors = {};
    const newWarnings = [];

    Object.keys(FIELD_CONFIGS).forEach(fieldName => {
      const error = validateField(fieldName, formData[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    // No longer generating warnings for normal ranges
    // Healthcare providers will interpret values within individual patient context

    setErrors(newErrors);
    setWarnings(newWarnings);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Validate on form change
  useEffect(() => {
    if (touchedFields.size > 0) {
      validateForm();
    }
  }, [formData, validateForm, touchedFields]);

  // Handle input changes
  const handleInputChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Mark field as touched
    setTouchedFields(prev => new Set([...prev, name]));
  }, []);

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    setTouchedFields(new Set(Object.keys(FIELD_CONFIGS)));

    if (!validateForm()) {
      toast.error('Please correct the form errors');
      return;
    }

    setIsLoading(true);

    try {
      // Process data for API - include height from patient profile
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
        height: patientHeight ? parseFloat(patientHeight) : null, // Use height from patient profile
        respiratory_rate: formData.respiratory_rate
          ? parseInt(formData.respiratory_rate)
          : null,
        oxygen_saturation: formData.oxygen_saturation
          ? parseInt(formData.oxygen_saturation)
          : null,
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
      console.error('Error saving vitals:', error);
      toast.error(error.response?.data?.detail || 'Failed to save vitals');
    } finally {
      setIsLoading(false);
    }
  };

  // Form steps for better organization
  const formSteps = Object.entries(FORM_FIELDS);

  // Render field function
  const renderField = fieldName => {
    const config = FIELD_CONFIGS[fieldName];
    const value = formData[fieldName];
    const error = touchedFields.has(fieldName) ? errors[fieldName] : null;

    const Icon = config.icon;

    return (
      <motion.div
        key={fieldName}
        className={`form-field ${error ? 'error' : ''}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <label htmlFor={fieldName} className="field-label">
          <div className="label-content">
            <Icon size={16} className="label-icon" />
            <span>
              {config.label}
              {config.required && <span className="required">*</span>}
            </span>
            {config.unit && <span className="unit">({config.unit})</span>}
          </div>
        </label>

        <div className="field-input-container">
          {config.type === 'textarea' ? (
            <textarea
              id={fieldName}
              name={fieldName}
              value={value}
              onChange={handleInputChange}
              placeholder={config.placeholder}
              rows={config.rows}
              className="field-input"
            />
          ) : (
            <input
              type={config.type}
              id={fieldName}
              name={fieldName}
              value={value}
              onChange={handleInputChange}
              placeholder={config.placeholder}
              min={config.min}
              max={config.max}
              step={config.step}
              required={config.required}
              className="field-input"
            />
          )}
        </div>

        {/* Field error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="field-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AlertTriangle size={14} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Render calculated values
  const renderCalculatedValues = () => (
    <motion.div
      className="calculated-values"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h4>Calculated Values</h4>
      <div className="calculated-grid">
        {calculatedBMI && (
          <div className="calculated-item">
            <label>BMI</label>
            <div className="calculated-value">
              <span className="value">{calculatedBMI}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="vitals-form-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="form-header">
        <div className="header-content">
          <h2>{isEdit ? 'Edit Vitals' : 'Record New Vitals'}</h2>
          {isReady && (
            <div className="timezone-info">
              <Info size={14} />
              <span>Times shown in {facilityTimezone}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="close-btn"
          disabled={isLoading}
        >
          <X size={20} />
        </button>
      </div>

      {/* Warnings */}
      <AnimatePresence>
        {warnings.length > 0 && (
          <motion.div
            className="warnings-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="warnings-header">
              <AlertTriangle size={16} />
              <span>Health Alerts</span>
            </div>
            <div className="warnings-list">
              {warnings.map((warning, index) => (
                <div key={index} className="warning-item">
                  {warning}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="vitals-form">
        <div className="form-sections">
          {formSteps.map(([sectionKey, section], index) => {
            const SectionIcon = section.icon;
            return (
              <motion.div
                key={sectionKey}
                className="form-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className="section-header">
                  <div className="section-title">
                    <SectionIcon size={20} />
                    <h3>{section.title}</h3>
                  </div>
                  {section.description && (
                    <p className="section-description">{section.description}</p>
                  )}
                </div>

                <div className="section-fields">
                  {section.fields.map(fieldName => renderField(fieldName))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Patient Height Info */}
        {patientHeight ? (
          <motion.div
            className="patient-height-info"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="height-info-content">
              <TrendingUp size={16} />
              <span>Patient Height: {patientHeight} inches (from profile)</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="patient-height-warning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="height-warning-content">
              <AlertTriangle size={16} />
              <span>
                Height not set in patient profile - BMI calculation unavailable
              </span>
            </div>
          </motion.div>
        )}

        {/* Calculated values */}
        {calculatedBMI && renderCalculatedValues()}

        {/* Form actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={isLoading}
          >
            <X size={16} />
            Cancel
          </button>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="loading-spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                {isEdit ? 'Update Vitals' : 'Save Vitals'}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default VitalsForm;
