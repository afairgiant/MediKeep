import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { procedureFormFields } from '../../utils/medicalFormFields';

const MantineProcedureForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  editingProcedure = null,
  children,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  // Status options for procedures
  const statusOptions = [
    {
      value: 'scheduled',
      label: 'Scheduled - Planned for future',
    },
    {
      value: 'in-progress',
      label: 'In Progress - Currently happening',
    },
    {
      value: 'completed',
      label: 'Completed - Successfully finished',
    },
    {
      value: 'postponed',
      label: 'Postponed - Delayed to later date',
    },
    {
      value: 'cancelled',
      label: 'Cancelled - Not proceeding',
    },
  ];

  const dynamicOptions = {
    practitioners: practitionerOptions,
    statuses: statusOptions,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingProcedure}
      fields={procedureFormFields}
      dynamicOptions={dynamicOptions}
      modalSize="xl"
    >
      {children}
    </BaseMedicalForm>
  );
};

export default MantineProcedureForm;
