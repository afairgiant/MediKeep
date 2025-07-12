import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { medicationFormFields } from '../../utils/medicalFormFields';

const MantineMedicalForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  pharmacies = [],
  editingMedication = null,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  // Convert pharmacies to Mantine format
  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: String(pharmacy.id),
    label: `${pharmacy.name}${pharmacy.city ? ` - ${pharmacy.city}` : ''}${pharmacy.state ? `, ${pharmacy.state}` : ''}`,
  }));

  const dynamicOptions = {
    practitioners: practitionerOptions,
    pharmacies: pharmacyOptions,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingMedication}
      fields={medicationFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineMedicalForm;
