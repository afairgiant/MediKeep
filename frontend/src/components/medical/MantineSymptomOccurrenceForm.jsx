import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { symptomOccurrenceFormFields } from '../../utils/medicalFormFields';

/**
 * Form for logging a symptom occurrence (individual episode)
 * Used to record specific instances of a symptom with details like severity, duration, triggers, etc.
 */
const MantineSymptomOccurrenceForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingOccurrence = null,
  submitButtonText,
}) => {
  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingOccurrence}
      fields={symptomOccurrenceFormFields}
      submitButtonText={submitButtonText}
    />
  );
};

export default MantineSymptomOccurrenceForm;
