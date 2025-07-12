import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { immunizationFormFields } from '../../utils/medicalFormFields';

const MantineImmunizationForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingImmunization = null,
}) => {
  // Injection site options with descriptions
  const siteOptions = [
    { value: 'left_arm', label: 'Left Arm' },
    { value: 'right_arm', label: 'Right Arm' },
    { value: 'left_deltoid', label: 'Left Deltoid' },
    { value: 'right_deltoid', label: 'Right Deltoid' },
    { value: 'left_thigh', label: 'Left Thigh' },
    { value: 'right_thigh', label: 'Right Thigh' },
  ];

  // Route options with medical descriptions
  const routeOptions = [
    { value: 'intramuscular', label: 'Intramuscular (IM)' },
    { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
    { value: 'intradermal', label: 'Intradermal (ID)' },
    { value: 'oral', label: 'Oral' },
    { value: 'nasal', label: 'Nasal' },
  ];

  // Common vaccine manufacturers
  const manufacturerOptions = [
    { value: 'Pfizer-BioNTech', label: 'Pfizer-BioNTech' },
    { value: 'Moderna', label: 'Moderna' },
    { value: 'Johnson & Johnson', label: 'Johnson & Johnson' },
    { value: 'AstraZeneca', label: 'AstraZeneca' },
    { value: 'Merck', label: 'Merck' },
    { value: 'GlaxoSmithKline', label: 'GlaxoSmithKline' },
    { value: 'Sanofi', label: 'Sanofi' },
    { value: 'Other', label: 'Other' },
  ];

  const dynamicOptions = {
    sites: siteOptions,
    routes: routeOptions,
    manufacturers: manufacturerOptions,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingImmunization}
      fields={immunizationFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineImmunizationForm;
