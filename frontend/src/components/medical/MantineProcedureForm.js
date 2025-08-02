import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import UploadProgressErrorBoundary from '../shared/UploadProgressErrorBoundary';
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
  isLoading = false,
  statusMessage = null,
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
      isLoading={isLoading}
    >
      {children}
      
      {/* Loading Overlay */}
      <UploadProgressErrorBoundary>
        <FormLoadingOverlay
          visible={isLoading && statusMessage}
          message={statusMessage?.title || 'Processing...'}
          submessage={statusMessage?.message || ''}
          type={statusMessage?.type || 'loading'}
          blur={3}
          opacity={0.85}
        />
      </UploadProgressErrorBoundary>
    </BaseMedicalForm>
  );
};

export default MantineProcedureForm;
