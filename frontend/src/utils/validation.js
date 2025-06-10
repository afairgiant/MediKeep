/**
 * Validation utilities for forms
 */

import { VALIDATION_RULES } from './constants';
import { isValidEmail, isValidPhone } from './helpers';

/**
 * Common validation schemas
 */
export const validationSchemas = {
  // Patient Information Validation
  patientInfo: (values) => {
    const errors = {};
    
    if (!values.first_name?.trim()) {
      errors.first_name = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.last_name?.trim()) {
      errors.last_name = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.birthDate) {
      errors.birthDate = VALIDATION_RULES.REQUIRED;
    } else {
      const birthDate = new Date(values.birthDate);
      const today = new Date();
      if (birthDate > today) {
        errors.birthDate = 'Birth date cannot be in the future';
      }
    }
    
    if (!values.gender) {
      errors.gender = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.address?.trim()) {
      errors.address = VALIDATION_RULES.REQUIRED;
    }
    
    if (values.email && !isValidEmail(values.email)) {
      errors.email = VALIDATION_RULES.EMAIL;
    }
    
    if (values.phone && !isValidPhone(values.phone)) {
      errors.phone = VALIDATION_RULES.PHONE;
    }
    
    return errors;
  },

  // Login Validation
  login: (values) => {
    const errors = {};
    
    if (!values.username?.trim()) {
      errors.username = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.password?.trim()) {
      errors.password = VALIDATION_RULES.REQUIRED;
    }
    
    return errors;
  },

  // Medication Validation
  medication: (values) => {
    const errors = {};
    
    if (!values.medication_name?.trim()) {
      errors.medication_name = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.status) {
      errors.status = VALIDATION_RULES.REQUIRED;
    }
    
    if (values.effectivePeriod_end && values.effectivePeriod_start) {
      const startDate = new Date(values.effectivePeriod_start);
      const endDate = new Date(values.effectivePeriod_end);
      
      if (endDate < startDate) {
        errors.effectivePeriod_end = 'End date must be after start date';
      }
    }
    
    return errors;
  },

  // Lab Result Validation
  labResult: (values) => {
    const errors = {};
    
    if (!values.test_name?.trim()) {
      errors.test_name = VALIDATION_RULES.REQUIRED;
    }
    
    if (!values.status) {
      errors.status = VALIDATION_RULES.REQUIRED;
    }
    
    if (values.completed_date && values.ordered_date) {
      const orderedDate = new Date(values.ordered_date);
      const completedDate = new Date(values.completed_date);
      
      if (completedDate < orderedDate) {
        errors.completed_date = 'Completed date must be after ordered date';
      }
    }
    
    return errors;
  }
};

/**
 * Generic field validators
 */
export const validators = {
  required: (value) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return VALIDATION_RULES.REQUIRED;
    }
    return null;
  },

  email: (value) => {
    if (value && !isValidEmail(value)) {
      return VALIDATION_RULES.EMAIL;
    }
    return null;
  },

  phone: (value) => {
    if (value && !isValidPhone(value)) {
      return VALIDATION_RULES.PHONE;
    }
    return null;
  },

  minLength: (length) => (value) => {
    if (value && value.length < length) {
      return VALIDATION_RULES.MIN_LENGTH(length);
    }
    return null;
  },

  maxLength: (length) => (value) => {
    if (value && value.length > length) {
      return VALIDATION_RULES.MAX_LENGTH(length);
    }
    return null;
  },

  date: (value) => {
    if (value && isNaN(new Date(value).getTime())) {
      return VALIDATION_RULES.DATE;
    }
    return null;
  },

  futureDate: (value) => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (date <= today) {
        return 'Date must be in the future';
      }
    }
    return null;
  },

  pastDate: (value) => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      
      if (date > today) {
        return 'Date cannot be in the future';
      }
    }
    return null;
  }
};

/**
 * Validate multiple fields with different validators
 * @param {Object} values - Form values
 * @param {Object} fieldValidators - Object mapping field names to validator functions
 * @returns {Object} - Errors object
 */
export const validateFields = (values, fieldValidators) => {
  const errors = {};
  
  Object.keys(fieldValidators).forEach(field => {
    const fieldValidatorList = Array.isArray(fieldValidators[field]) 
      ? fieldValidators[field] 
      : [fieldValidators[field]];
    
    for (const validator of fieldValidatorList) {
      const error = validator(values[field]);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  });
  
  return errors;
};
