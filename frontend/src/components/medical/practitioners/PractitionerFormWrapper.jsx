import React, { useState, useEffect } from 'react';
import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from '../BaseMedicalForm';
import { practitionerFormFields } from '../../../utils/medicalFormFields';
import { isValidPhoneNumber } from '../../../utils/phoneUtils';
import { fetchMedicalSpecialties, clearSpecialtiesCache } from '../../../config/medicalSpecialties';
import { apiService } from '../../../services/api';
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
  const { t } = useTranslation(['medical', 'common']);

  // State for dynamic specialties
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);

  // State for dynamic practices
  const [practiceOptions, setPracticeOptions] = useState([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(true);

  // Load specialties and practices on component mount
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

    const loadPractices = async () => {
      try {
        setIsLoadingPractices(true);
        const practices = await apiService.getPractices();
        const safePractices = Array.isArray(practices) ? practices : [];
        setPracticeOptions(
          safePractices.map(p => ({
            value: String(p.id),
            label: p.name,
          }))
        );
      } catch (error) {
        logger.error('load_practices_failed', 'Failed to load practices', {
          component: 'PractitionerFormWrapper',
          error: error.message,
        });
      } finally {
        setIsLoadingPractices(false);
      }
    };

    if (isOpen) {
      // Clear cache to get fresh data including any newly added specialties
      clearSpecialtiesCache();
      loadSpecialties();
      loadPractices();
    }
  }, [isOpen]);

  const dynamicOptions = {
    specialties: specialtyOptions,
    practices: practiceOptions,
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

  // Input change handler with phone validation and inline practice creation
  const handleInputChange = async (e) => {
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
        [name]: t('medical:form.invalidPhoneDigits', 'Please enter a valid phone number')
      }));
    }

    // Handle inline practice creation when user types a new practice name in the combobox
    if (name === 'practice_id' && value && !practiceOptions.find(opt => opt.value === value)) {
      // User typed a new practice name - create it inline
      try {
        const newPractice = await apiService.createPractice({ name: value });
        if (newPractice && newPractice.id) {
          const newOption = { value: String(newPractice.id), label: newPractice.name };
          setPracticeOptions(prev => [...prev, newOption]);
          // Set the practice_id to the new ID
          onInputChange({ target: { name: 'practice_id', value: String(newPractice.id) } });
          return;
        }
      } catch (error) {
        logger.error('create_practice_inline_failed', 'Failed to create practice inline', {
          component: 'PractitionerFormWrapper',
          error: error.message,
        });
      }
    }

    onInputChange(e);
  };

  const websiteError =
    formData.website && !isValidWebsite(formData.website)
      ? t('medical:form.invalidWebsiteUrl', 'Please enter a valid website URL')
      : null;

  // Custom validation for submit - prevent submission if website is invalid
  const handleSubmit = (e) => {
    if (websiteError) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  };

  // Custom content for website validation error
  const customContent = websiteError ? (
    <Text size="sm" c="red" style={{ marginTop: '-16px', marginBottom: '16px' }}>
      {websiteError}
    </Text>
  ) : null;

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
      isLoading={isLoading || isLoadingSpecialties || isLoadingPractices}
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default PractitionerFormWrapper;
