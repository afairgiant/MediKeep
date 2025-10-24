import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { allergyFormFields } from '../../utils/medicalFormFields';

const MantineAllergyForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingAllergy = null,
  medicationsOptions = [],
  medicationsLoading = false,
}) => {
  // TEST: Alert when component renders
  if (isOpen) {
    alert('MantineAllergyForm is rendering! Title: ' + title);
  }

  // Convert medications to Mantine format for dynamic options
  const medicationSelectOptions = medicationsLoading 
    ? [] 
    : medicationsOptions.map(med => ({
        value: med.id.toString(),
        label: med.medication_name,
      }));

  const dynamicOptions = {
    medications: medicationSelectOptions,
  };

  const loadingStates = {
    medications: medicationsLoading,

  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingAllergy}
      fields={allergyFormFields}
      dynamicOptions={dynamicOptions}

      loadingStates={loadingStates}

    />
  );
};

export default MantineAllergyForm;