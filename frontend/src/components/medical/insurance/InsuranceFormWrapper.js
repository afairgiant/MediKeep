import React, { useState, useEffect } from 'react';
import BaseMedicalForm from '../BaseMedicalForm';
import { getFormFields } from '../../../utils/medicalFormFields';
import { formatPhoneInput, cleanPhoneNumber, isValidPhoneNumber, isPhoneField } from '../../../utils/phoneUtils';
import logger from '../../../services/logger';

const InsuranceFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem = null,
  children,
}) => {
  // Get insurance form fields
  const fields = getFormFields('insurance');
  
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Clear field errors when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
    }
  }, [isOpen]);

  // Enhanced input change handler with phone formatting, validation, and logging
  const handleInputChange = (e) => {
    try {
      const { name, value } = e.target;
      
      // Clear any existing error for this field
      if (fieldErrors[name]) {
        setFieldErrors(prev => ({
          ...prev,
          [name]: null
        }));
      }
      
      // Handle phone number formatting and validation using centralized detection
      const fieldInfo = fields.find(f => f.name === name);
      const isPhoneFieldCheck = isPhoneField(name, fieldInfo?.type);
      if (isPhoneFieldCheck) {
        // Validate phone number if not empty
        if (value.trim() !== '' && !isValidPhoneNumber(value)) {
          setFieldErrors(prev => ({
            ...prev,
            [name]: 'Please enter a valid phone number (10-15 digits)'
          }));
        }
        
        // Format phone number as user types
        const formattedValue = formatPhoneInput(value);
        
        // Create a new event with formatted value
        const formattedEvent = {
          ...e,
          target: {
            ...e.target,
            value: formattedValue
          }
        };
        
        onInputChange(formattedEvent);
        return;
      }
      
      // Log important field changes
      if (['insurance_type', 'company_name', 'status'].includes(name)) {
        logger.info('Insurance form field changed', {
          field: name,
          value: value,
          editing: !!editingItem,
          insurance_id: editingItem?.id,
        });
      }

      onInputChange(e);
    } catch (error) {
      logger.error('Error handling insurance form input change:', error);
    }
  };

  // Validate form data based on insurance type
  const validateForm = () => {
    const errors = [];
    const selectedType = formData.insurance_type;
    
    // Basic required fields validation
    const basicRequiredFields = ['insurance_type', 'company_name', 'member_name', 'member_id', 'effective_date', 'status'];
    basicRequiredFields.forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === '') {
        errors.push(`${field.replace(/_/g, ' ')} is required`);
      }
    });
    
    // Conditional required fields based on insurance type
    if (selectedType === 'prescription') {
      if (!formData.bin_number || formData.bin_number.trim() === '') {
        errors.push('BIN Number is required for prescription insurance');
      }
      if (!formData.pcn_number || formData.pcn_number.trim() === '') {
        errors.push('PCN Number is required for prescription insurance');
      }
    }
    
    // Date validation
    if (formData.expiration_date && formData.effective_date) {
      const effectiveDate = new Date(formData.effective_date);
      const expirationDate = new Date(formData.expiration_date);
      if (expirationDate <= effectiveDate) {
        errors.push('Expiration date must be after effective date');
      }
    }
    
    // Numeric field validation
    const numericFields = [
      'deductible_individual', 'deductible_family', 'copay_primary_care', 'copay_specialist',
      'copay_emergency_room', 'copay_urgent_care', 'annual_maximum', 'preventive_coverage',
      'basic_coverage', 'major_coverage', 'exam_copay', 'frame_allowance', 'contact_allowance',
      'copay_generic', 'copay_brand', 'copay_specialty'
    ];
    
    numericFields.forEach(field => {
      if (formData[field] && formData[field] !== '') {
        const value = parseFloat(formData[field]);
        if (isNaN(value) || value < 0) {
          errors.push(`${field.replace(/_/g, ' ')} must be a positive number`);
        }
        
        // Percentage validation
        if (field.includes('coverage') && value > 100) {
          errors.push(`${field.replace(/_/g, ' ')} cannot exceed 100%`);
        }
      }
    });
    
    // Phone number validation
    const phoneFields = ['customer_service_phone', 'preauth_phone', 'provider_services_phone'];
    phoneFields.forEach(field => {
      if (formData[field] && formData[field].trim() !== '') {
        if (!isValidPhoneNumber(formData[field])) {
          errors.push(`${field.replace(/_/g, ' ')} must be a valid phone number`);
        }
      }
    });
    
    return errors;
  };

  // Enhanced submit handler with field-level validation and logging
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      logger.info('Insurance form submission started', {
        editing: !!editingItem,
        insurance_id: editingItem?.id,
        insurance_type: formData.insurance_type,
        company: formData.company_name,
      });

      // Validate all fields and collect errors
      const newFieldErrors = {};
      let hasErrors = false;
      
      // Basic required fields validation
      const basicRequiredFields = ['insurance_type', 'company_name', 'member_name', 'member_id', 'effective_date', 'status'];
      basicRequiredFields.forEach(field => {
        if (!formData[field] || formData[field].toString().trim() === '') {
          newFieldErrors[field] = `${field.replace(/_/g, ' ')} is required`;
          hasErrors = true;
        }
      });
      
      // Phone validation using centralized detection
      const filteredFields = getFilteredFields();
      Object.keys(formData).forEach(fieldName => {
        const fieldConfig = filteredFields.find(f => f.name === fieldName);
        const isPhoneFieldCheck = isPhoneField(fieldName, fieldConfig?.type);
                            
        if (isPhoneFieldCheck && formData[fieldName] && formData[fieldName].trim() !== '') {
          if (!isValidPhoneNumber(formData[fieldName])) {
            newFieldErrors[fieldName] = 'Please enter a valid phone number (10-15 digits)';
            hasErrors = true;
          }
        }
      });
      
      // Conditional required fields validation
      const selectedType = formData.insurance_type;
      if (selectedType === 'prescription') {
        if (!formData.bin_number || formData.bin_number.trim() === '') {
          newFieldErrors.bin_number = 'BIN Number is required for prescription insurance';
          hasErrors = true;
        }
        if (!formData.pcn_number || formData.pcn_number.trim() === '') {
          newFieldErrors.pcn_number = 'PCN Number is required for prescription insurance';
          hasErrors = true;
        }
      }
      
      // Date validation
      if (formData.expiration_date && formData.effective_date) {
        const effectiveDate = new Date(formData.effective_date);
        const expirationDate = new Date(formData.expiration_date);
        if (expirationDate <= effectiveDate) {
          newFieldErrors.expiration_date = 'Expiration date must be after effective date';
          hasErrors = true;
        }
      }

      // If there are validation errors, set them and prevent submission
      if (hasErrors) {
        setFieldErrors(newFieldErrors);
        logger.warn('Insurance form validation failed', {
          fieldErrors: newFieldErrors,
          insurance_type: formData.insurance_type,
        });
        return; // Don't proceed with submission
      }

      // Clear any existing field errors
      setFieldErrors({});

      await onSubmit(e);

      logger.info('Insurance form submission completed', {
        editing: !!editingItem,
        insurance_id: editingItem?.id,
        insurance_type: formData.insurance_type,
      });
    } catch (error) {
      logger.error('Error in insurance form submission:', error);
      throw error; // Re-throw to let parent handle UI feedback
    }
  };

  // Filter fields based on insurance type for dynamic rendering
  const getFilteredFields = () => {
    const selectedInsuranceType = formData.insurance_type;
    
    // If no insurance type is selected, show basic fields up to insurance type
    if (!selectedInsuranceType) {
      return fields.filter(field => {
        // Show fields without showFor property and insurance_type field
        return !field.showFor || field.name === 'insurance_type';
      });
    }

    // Filter fields based on showFor property
    return fields.filter(field => {
      // Always show fields without showFor property (universal fields)
      if (!field.showFor) {
        return true;
      }
      
      // Show fields that are specified for the current insurance type
      if (field.showFor.includes(selectedInsuranceType)) {
        return true;
      }
      
      // Hide fields not meant for this insurance type
      return false;
    }).map(field => {
      // Handle conditional required fields
      if (field.requiredFor && field.requiredFor.includes(selectedInsuranceType)) {
        return {
          ...field,
          required: true
        };
      }
      return field;
    });
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingItem}
      fields={getFilteredFields()}
      dynamicOptions={{}}
      fieldErrors={fieldErrors}
    >
      {children}
    </BaseMedicalForm>
  );
};

export default InsuranceFormWrapper;