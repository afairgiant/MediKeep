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
import { useFormHandlers } from '../../../hooks/useFormHandlers';
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
  // Use the standardized form handlers hook
  const { 
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
  } = useFormHandlers(onInputChange);
  
  // Get today's date for date picker constraints
  const today = new Date();
  // Set to end of day to ensure today is selectable
  today.setHours(23, 59, 59, 999);

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
            onChange={handleTextInputChange('condition_name')}
            placeholder="Enter condition name"
            description="Optional alternative name for the condition"
          />

          <TextInput
            label="Diagnosis"
            name="diagnosis"
            value={formData.diagnosis || ''}
            onChange={handleTextInputChange('diagnosis')}
            required
            placeholder="Enter diagnosis"
          />

          <Select
            label="Severity"
            name="severity"
            value={formData.severity || ''}
            onChange={handleSelectChange('severity')}
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
            onChange={handleSelectChange('status')}
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
            onChange={handleSelectChange('medication_id')}
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
            onChange={handleSelectChange('practitioner_id')}
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
              value={formData.onset_date ? (() => {
                // Parse date string to avoid timezone issues
                if (typeof formData.onset_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData.onset_date.trim())) {
                  const [year, month, day] = formData.onset_date.trim().split('-').map(Number);
                  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month - 1, day); // month is 0-indexed
                  }
                }
                return new Date(formData.onset_date);
              })() : null}
              onChange={handleDateChange('onset_date')}
              placeholder="Select onset date"
              clearable
              firstDayOfWeek={0}
              maxDate={today}
            />

            <DateInput
              label="End Date"
              name="end_date"
              value={formData.end_date ? (() => {
                // Parse date string to avoid timezone issues
                if (typeof formData.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData.end_date.trim())) {
                  const [year, month, day] = formData.end_date.trim().split('-').map(Number);
                  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month - 1, day); // month is 0-indexed
                  }
                }
                return new Date(formData.end_date);
              })() : null}
              onChange={handleDateChange('end_date')}
              placeholder="Select end date"
              clearable
              firstDayOfWeek={0}
              minDate={formData.onset_date ? (() => {
                // End date can't be before onset date
                if (typeof formData.onset_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData.onset_date.trim())) {
                  const [year, month, day] = formData.onset_date.trim().split('-').map(Number);
                  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month - 1, day);
                  }
                }
                return new Date(formData.onset_date);
              })() : undefined}
              maxDate={today}
            />
          </Group>

          {/* Medical codes */}
          <Group grow>
            <TextInput
              label="ICD-10 Code"
              name="icd10_code"
              value={formData.icd10_code || ''}
              onChange={handleTextInputChange('icd10_code')}
              placeholder="Enter ICD-10 code"
            />

            <TextInput
              label="SNOMED Code"
              name="snomed_code"
              value={formData.snomed_code || ''}
              onChange={handleTextInputChange('snomed_code')}
              placeholder="Enter SNOMED code"
            />
          </Group>

          <TextInput
            label="Code Description"
            name="code_description"
            value={formData.code_description || ''}
            onChange={handleTextInputChange('code_description')}
            placeholder="Enter code description"
          />

          <Textarea
            label="Clinical Notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleTextInputChange('notes')}
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