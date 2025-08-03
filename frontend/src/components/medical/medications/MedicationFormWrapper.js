import React from 'react';
import MantineMedicalForm from '../MantineMedicalForm';

const MedicationFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners,
  pharmacies,
  editingMedication,
}) => {
  return (
    <MantineMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      pharmacies={pharmacies}
      editingMedication={editingMedication}
    />
  );
};

export default MedicationFormWrapper;