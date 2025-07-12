import React from 'react';

import { Text } from '@mantine/core';

import BaseMedicalForm from './BaseMedicalForm';
import { pharmacyFormFields } from '../../utils/medicalFormFields';

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

  // Custom handler for phone formatting
  const handlePhoneChange = (event) => {
    let value = event.target.value;

    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    let formatted = cleaned;
    if (cleaned.length >= 6) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length > 0) {
      formatted = cleaned;
    }

    const syntheticEvent = {
      target: {
        name: 'phone_number',
        value: formatted,
      },
    };
    onInputChange(syntheticEvent);
  };

  // Override form data handling for custom formatted fields
  const handleInputChange = (event) => {
    const { name } = event.target;
    
    if (name === 'store_number') {
      handleStoreNumberChange(event);
    } else if (name === 'phone_number') {
      handlePhoneChange(event);
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

    >
      {customContent}
    </BaseMedicalForm>

  );
};

export default MantinePharmacyForm;