import React from 'react';
import MantineVisitForm from '../MantineVisitForm';

const VisitFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners,
  conditions,
  isLoading,
  statusMessage,
  labResults,
  encounterLabResults,
  fetchEncounterLabResults,
  navigate,
  children,
}) => {
  return (
    <MantineVisitForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      conditionsOptions={conditions}
      editingVisit={editingItem}
      isLoading={isLoading}
      statusMessage={statusMessage}
      labResults={labResults}
      encounterLabResults={encounterLabResults}
      fetchEncounterLabResults={fetchEncounterLabResults}
      navigate={navigate}
    >
      {children}
    </MantineVisitForm>
  );
};

export default VisitFormWrapper;