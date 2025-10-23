import React, { useState, useEffect } from 'react';

import { Text } from '@mantine/core';

import BaseMedicalForm from './BaseMedicalForm';
import { pharmacyFormFields } from '../../utils/medicalFormFields';
import { formatPhoneInput, isValidPhoneNumber } from '../../utils/phoneUtils';

const MantinePharmacyForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPharmacy = null,
}) => {
  // Custom handler for store number formatting
  const handleStoreNumberChange = (event) => {
    let value = event.target.value;

    // Remove any non-alphanumeric characters except spaces and hyphens
    value = value.replace(/[^a-zA-Z0-9\s\-#]/g, '');

    // Auto-format common store number patterns
    if (/^\d+$/.test(value) && value.length > 0) {
      // Pure numbers - add # prefix if more than 2 digits
      if (value.length > 2) {
        value = `#${value}`;
      }
    }

    const syntheticEvent = {
      target: {
        name: 'store_number',
        value: value,
      },
    };
    onInputChange(syntheticEvent);
  };

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Clear field errors when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
    }
  }, [isOpen]);

  // Enhanced input change handler with phone formatting and validation
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    
    // Clear any existing error for this field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    
    if (name === 'store_number') {
      handleStoreNumberChange(event);
    } else if (name === 'phone_number') {
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
        ...event,
        target: {
          ...event.target,
          value: formattedValue
        }
      };
      
      onInputChange(formattedEvent);
    } else {
      onInputChange(event);
    }
  };

  // Validate website URL
  const isValidWebsite = (url) => {
    if (!url) return true; // Optional field
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const websiteError =
    formData.website && !isValidWebsite(formData.website)
      ? 'Please enter a valid website URL'
      : null;

  // Custom validation for submit - prevent submission if website is invalid

  const handleSubmit = (e) => {
    if (websiteError) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  };

  // Custom content for inline website validation error
  const customContent = (
    <>
      {websiteError && (
        <Text size="sm" c="red" style={{ marginTop: '-16px', marginBottom: '16px' }}>
          {websiteError}
        </Text>
      )}
    </>
  );

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingPharmacy}
      fields={pharmacyFormFields}
      modalSize="lg"
      fieldErrors={fieldErrors}
    >
      {customContent}
    </BaseMedicalForm>

  );
};

export default MantinePharmacyForm;