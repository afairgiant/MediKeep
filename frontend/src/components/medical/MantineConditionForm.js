import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  Divider,
  Title,
} from '@mantine/core';
import MedicationRelationships from './MedicationRelationships';
import { DateInput } from '@mantine/dates';
import { CONDITION_STATUS_OPTIONS, SEVERITY_OPTIONS } from '../../utils/statusConfig';
import { useFormHandlers } from '../../hooks/useFormHandlers';

const MantineConditionForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
  medications = [],
  conditionMedications = {},
  fetchConditionMedications = null,
  navigate = null,
}) => {
  const { handleTextInputChange, handleSelectChange, handleDateChange } = useFormHandlers(onInputChange);

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size="lg"
      centered
      styles={{
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Diagnosis */}
          <TextInput
            label="Diagnosis"
            placeholder="e.g., Hypertension, Diabetes Type 2, Asthma"
            value={formData.diagnosis}
            onChange={handleTextInputChange('diagnosis')}
            required
            withAsterisk
            description="Medical condition or diagnosis name"
          />

          {/* Status and Severity */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Status"
                value={formData.status}
                onChange={handleSelectChange('status')}
                data={CONDITION_STATUS_OPTIONS}
                description="Current status of this condition"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Severity"
                placeholder="Select severity level"
                value={formData.severity}
                onChange={handleSelectChange('severity')}
                data={SEVERITY_OPTIONS}
                description="Severity level of this condition"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Dates */}
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Onset Date"
                placeholder="When did this condition start"
                value={formData.onset_date ? new Date(formData.onset_date) : null}
                onChange={handleDateChange('onset_date')}
                firstDayOfWeek={0}
                clearable
                description="When this condition was first diagnosed"
                maxDate={new Date()} // Can't be in the future
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="When was this condition resolved"
                value={formData.end_date ? new Date(formData.end_date) : null}
                onChange={handleDateChange('end_date')}
                firstDayOfWeek={0}
                clearable
                description="When this condition was resolved (optional)"
                maxDate={new Date()} // Can't be in the future
                minDate={formData.onset_date ? new Date(formData.onset_date) : undefined} // Can't be before onset
              />
            </Grid.Col>
          </Grid>

          {/* Medical Codes */}
          <Grid>
            <Grid.Col span={4}>
              <TextInput
                label="ICD-10 Code"
                placeholder="e.g., I10, E11.9"
                value={formData.icd10_code}
                onChange={handleTextInputChange('icd10_code')}
                description="International Classification of Diseases code"
                maxLength={10}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="SNOMED Code"
                placeholder="e.g., 38341003"
                value={formData.snomed_code}
                onChange={handleTextInputChange('snomed_code')}
                description="SNOMED CT clinical terminology code"
                maxLength={20}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Code Description"
                placeholder="Description of the medical code"
                value={formData.code_description}
                onChange={handleTextInputChange('code_description')}
                description="Human-readable description of the code"
                maxLength={500}
              />
            </Grid.Col>
          </Grid>

          {/* Notes */}
          <Textarea
            label="Notes"
            placeholder="Additional information about this condition..."
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Treatment notes, symptoms, or other relevant details"
            minRows={4}
            maxRows={8}
          />

          {/* Medication Relationships - Only show for editing existing conditions */}
          {editingCondition && medications.length > 0 && fetchConditionMedications && navigate && (
            <>
              <Divider />
              <Stack gap="md">
                <Title order={4}>Linked Medications</Title>
                <MedicationRelationships 
                  conditionId={editingCondition.id}
                  conditionMedications={conditionMedications}
                  medications={medications}
                  fetchConditionMedications={fetchConditionMedications}
                  navigate={navigate}
                  isViewMode={false}
                />
              </Stack>
            </>
          )}

          {/* Form Actions */}
          <Group justify="flex-end" mt="lg" mb="sm">
            <Button
              variant="subtle"
              onClick={onClose}
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="filled"
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editingCondition ? 'Update Condition' : 'Add Condition'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineConditionForm;
