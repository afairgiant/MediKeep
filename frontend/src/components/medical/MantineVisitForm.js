import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { visitFormFields } from '../../utils/medicalFormFields';

const MantineVisitForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  conditionsOptions = [],
  conditionsLoading = false,
  editingVisit = null,
  children,
}) => {
  // Convert practitioners to dynamic options format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `Dr. ${practitioner.name} - ${practitioner.specialty}`,
  }));

  // Convert conditions to dynamic options format
  const conditionOptions = conditionsOptions.map(cond => ({
    value: cond.id.toString(),
    label: cond.diagnosis,
  }));

  const dynamicOptions = {
    practitioners: practitionerOptions,
    conditions: conditionOptions,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingVisit}
      fields={visitFormFields}
      dynamicOptions={dynamicOptions}
      modalSize="xl"
    >
      {children}
    </BaseMedicalForm>
  );
};

export default MantineVisitForm;