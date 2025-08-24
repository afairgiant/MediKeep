import React, { useMemo } from 'react';
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
  // Convert practitioners to Mantine format - memoized to prevent recreating on every render
  const practitionerOptions = useMemo(() => {
    if (!practitioners || !Array.isArray(practitioners)) return [];
    
    try {
      return practitioners.map(practitioner => ({
        value: String(practitioner.id),
        label: `${practitioner.name} - ${practitioner.specialty}`,
      }));
    } catch (error) {
      console.error('Error mapping practitioners:', error);
      return [];
    }
  }, [practitioners]);

  // Convert pharmacies to Mantine format - memoized to prevent recreating on every render
  const pharmacyOptions = useMemo(() => {
    if (!pharmacies || !Array.isArray(pharmacies)) return [];
    
    try {
      return pharmacies.map(pharmacy => ({
        value: String(pharmacy.id),
        label: `${pharmacy.name}${pharmacy.city ? ` - ${pharmacy.city}` : ''}${pharmacy.state ? `, ${pharmacy.state}` : ''}`,
      }));
    } catch (error) {
      console.error('Error mapping pharmacies:', error);
      return [];
    }
  }, [pharmacies]);

  const dynamicOptions = useMemo(() => ({
    practitioners: practitionerOptions,
    pharmacies: pharmacyOptions,
  }), [practitionerOptions, pharmacyOptions]);

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
