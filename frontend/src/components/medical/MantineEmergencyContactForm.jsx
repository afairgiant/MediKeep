import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from './BaseMedicalForm';
import { emergencyContactFormFields } from '../../utils/medicalFormFields';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS } from '../../utils/statusConfig';
import { isValidPhoneNumber } from '../../utils/phoneUtils';

const MantineEmergencyContactForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingContact = null,
}) => {
  const { t } = useTranslation('errors');

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
    const isPhoneFieldCheck = name === 'phone_number' || name === 'secondary_phone';
    if (isPhoneFieldCheck && value.trim() !== '' && !isValidPhoneNumber(value)) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: t('form.invalidPhoneDigits')
      }));
    }

    onInputChange(e);
  };

  const dynamicOptions = {
    relationships: EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={onSubmit}
      editingItem={editingContact}
      fields={emergencyContactFormFields}
      dynamicOptions={dynamicOptions}
      fieldErrors={fieldErrors}
    />
  );
};

export default MantineEmergencyContactForm;