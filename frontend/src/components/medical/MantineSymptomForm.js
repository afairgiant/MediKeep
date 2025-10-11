import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { symptomParentFormFields } from '../../utils/medicalFormFields';

/**
 * Form for creating/editing a symptom definition (parent record)
 * Used to define the type of symptom being tracked (e.g., "Migraine Headache")
 * Individual occurrences/episodes are logged separately using MantineSymptomOccurrenceForm
 */
const MantineSymptomForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingSymptom = null,
}) => {
  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingSymptom}
      fields={symptomParentFormFields}
    />
  );
};

export default MantineSymptomForm;
