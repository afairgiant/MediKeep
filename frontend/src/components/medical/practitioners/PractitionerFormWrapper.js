import React, { useState, useEffect } from 'react';
import { Text, Anchor } from '@mantine/core';
import BaseMedicalForm from '../BaseMedicalForm';
import { practitionerFormFields } from '../../../utils/medicalFormFields';
import { formatPhoneInput, isValidPhoneNumber } from '../../../utils/phoneUtils';
import { fetchMedicalSpecialties } from '../../../config/medicalSpecialties';
import logger from '../../../services/logger';

const PractitionerFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  isLoading,
  statusMessage,
}) => {
  // State for dynamic specialties
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  
  // Load specialties on component mount
  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        setIsLoadingSpecialties(true);
        const specialties = await fetchMedicalSpecialties();
        // Remove the "Other" option as we'll allow custom input directly
        const filteredSpecialties = specialties.filter(s => s.value !== 'Other');
        setSpecialtyOptions(filteredSpecialties);
      } catch (error) {
        logger.error('load_specialties_failed', 'Failed to load medical specialties', {
          component: 'PractitionerFormWrapper',
          error: error.message
        });
      } finally {
        setIsLoadingSpecialties(false);
      }
    };
    
    if (isOpen) {
      loadSpecialties();
    }
  }, [isOpen]);

  const dynamicOptions = {
    specialties: specialtyOptions,
  };

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Clear field errors when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
    }
  }, [isOpen]);

  // Validate website URL
  const isValidWebsite = url => {
    if (!url) return true; // Optional field
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Enhanced input change handler with phone formatting and validation
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Clear any existing error for this field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    
    // Handle phone number formatting and validation
    if (name === 'phone_number') {
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
    
    onInputChange(e);
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

  // Custom content for website validation and link
  const customContent = (
    <>
      {formData.website && isValidWebsite(formData.website) && (
        <div style={{ marginTop: '-16px', marginBottom: '16px', textAlign: 'right' }}>
          <Anchor
            href={
              formData.website.startsWith('http')
                ? formData.website
                : `https://${formData.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--mantine-color-blue-6)' }}
          >
            Visit Website ↗
          </Anchor>
        </div>
      )}
      {websiteError && (
        <Text size="sm" c="red" style={{ marginTop: '-16px', marginBottom: '16px' }}>
          {websiteError}
        </Text>
      )}
    </>
  );

  if (!isOpen) return null;

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingItem}
      fields={practitionerFormFields}
      dynamicOptions={dynamicOptions}
      fieldErrors={fieldErrors}
      isLoading={isLoading || isLoadingSpecialties}
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default PractitionerFormWrapper;