import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Anchor } from '@mantine/core';
import BaseMedicalForm from './BaseMedicalForm';
import { practitionerFormFields } from '../../utils/medicalFormFields';
import { isValidPhoneNumber } from '../../utils/phoneUtils';
import { fetchMedicalSpecialties, clearSpecialtiesCache } from '../../config/medicalSpecialties';
import logger from '../../services/logger';

const MantinePractitionerForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPractitioner = null,
}) => {
  const { t } = useTranslation(['medical', 'common']);

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
          component: 'MantinePractitionerForm',
          error: error.message
        });
      } finally {
        setIsLoadingSpecialties(false);
      }
    };
    
    if (isOpen) {
      // Clear cache to get fresh data including any newly added specialties
      clearSpecialtiesCache();
      loadSpecialties();
    }
  }, [isOpen]);

  const dynamicOptions = {
    specialties: specialtyOptions,
  };

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

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Clear field errors when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
    }
  }, [isOpen]);

  // Input change handler with phone validation
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Clear any existing error for this field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    
    // Handle phone number validation
    if (name === 'phone_number' && value.trim() !== '' && !isValidPhoneNumber(value)) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: t('form.invalidPhoneDigits')
      }));
    }

    onInputChange(e);
  };



  const websiteError =
    formData.website && !isValidWebsite(formData.website)
      ? t('form.invalidWebsiteUrl')
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
            {t('common:labels.visitWebsite')}
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

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingPractitioner}
      fields={practitionerFormFields}
      dynamicOptions={dynamicOptions}
      fieldErrors={fieldErrors}
      isLoading={isLoadingSpecialties}
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default MantinePractitionerForm;