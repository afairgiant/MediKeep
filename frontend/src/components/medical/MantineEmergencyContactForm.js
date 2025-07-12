import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { emergencyContactFormFields } from '../../utils/medicalFormFields';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS } from '../../utils/statusConfig';

const MantineEmergencyContactForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingContact = null,
}) => {
  const dynamicOptions = {
    relationships: EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingContact}
      fields={emergencyContactFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineEmergencyContactForm;