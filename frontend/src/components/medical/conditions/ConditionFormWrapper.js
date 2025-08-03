import React, { useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  Textarea,
  Select,
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconX } from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
const ConditionFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition,
  medications = [],
  practitioners = [],
  isLoading,
  statusMessage,
}) => {

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleInputChange = (field, value) => {
    onInputChange({
      target: {
        name: field,
        value: value
      }
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <FormLoadingOverlay visible={isLoading} statusMessage={statusMessage} />

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Basic condition information */}
          <TextInput
            label="Condition Name (Optional)"
            name="condition_name"
            value={formData.condition_name || ''}
            onChange={(e) => onInputChange(e)}
            placeholder="Enter condition name"
            description="Optional alternative name for the condition"
          />

          <TextInput
            label="Diagnosis"
            name="diagnosis"
            value={formData.diagnosis || ''}
            onChange={(e) => onInputChange(e)}
            required
            placeholder="Enter diagnosis"
          />

          <Select
            label="Severity"
            name="severity"
            value={formData.severity || ''}
            onChange={(value) => handleInputChange('severity', value)}
            data={[
              { value: 'mild', label: 'Mild' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'severe', label: 'Severe' },
              { value: 'critical', label: 'Critical' },
            ]}
            placeholder="Select severity"
            clearable
          />

          <Select
            label="Status"
            name="status"
            value={formData.status || ''}
            onChange={(value) => handleInputChange('status', value)}
            data={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'chronic', label: 'Chronic' },
            ]}
            placeholder="Select status"
          />

          <Select
            label="Related Medication (Optional)"
            name="medication_id"
            value={formData.medication_id || ''}
            onChange={(value) => handleInputChange('medication_id', value)}
            data={medications.map(med => ({
              value: med.id.toString(),
              label: med.medication_name || med.name || `Medication #${med.id}`
            }))}
            placeholder="Select medication"
            searchable
            clearable
            description="Link this condition to a specific medication"
          />

          <Select
            label="Practitioner (Optional)"
            name="practitioner_id"
            value={formData.practitioner_id || ''}
            onChange={(value) => handleInputChange('practitioner_id', value)}
            data={practitioners.map(prac => ({
              value: prac.id.toString(),
              label: prac.name || `Dr. ${prac.first_name || ''} ${prac.last_name || ''}`.trim() || `Practitioner #${prac.id}`
            }))}
            placeholder="Select practitioner"
            searchable
            clearable
            description="Practitioner associated with this condition"
          />

          {/* Date fields */}
          <Group grow>
            <DateInput
              label="Onset Date"
              name="onset_date"
              value={formData.onset_date ? new Date(formData.onset_date) : null}
              onChange={(value) => handleInputChange('onset_date', value?.toISOString().split('T')[0] || '')}
              placeholder="Select onset date"
            />

            <DateInput
              label="End Date"
              name="end_date"
              value={formData.end_date ? new Date(formData.end_date) : null}
              onChange={(value) => handleInputChange('end_date', value?.toISOString().split('T')[0] || '')}
              placeholder="Select end date"
            />
          </Group>

          {/* Medical codes */}
          <Group grow>
            <TextInput
              label="ICD-10 Code"
              name="icd10_code"
              value={formData.icd10_code || ''}
              onChange={(e) => onInputChange(e)}
              placeholder="Enter ICD-10 code"
            />

            <TextInput
              label="SNOMED Code"
              name="snomed_code"
              value={formData.snomed_code || ''}
              onChange={(e) => onInputChange(e)}
              placeholder="Enter SNOMED code"
            />
          </Group>

          <TextInput
            label="Code Description"
            name="code_description"
            value={formData.code_description || ''}
            onChange={(e) => onInputChange(e)}
            placeholder="Enter code description"
          />

          <Textarea
            label="Clinical Notes"
            name="notes"
            value={formData.notes || ''}
            onChange={(e) => onInputChange(e)}
            placeholder="Enter clinical notes"
            rows={3}
          />


          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <SubmitButton
              loading={isLoading}
              disabled={!formData.diagnosis?.trim()}
            >
              {editingCondition ? 'Update' : 'Create'} Condition
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ConditionFormWrapper;