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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

const MantineProcedureForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  editingProcedure = null,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  // Handle TextInput onChange (receives event object)
  const handleTextInputChange = field => event => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.target.value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle Select onChange (receives value directly)
  const handleSelectChange = field => value => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle date changes
  const handleDateChange = field => date => {
    let formattedDate = '';

    if (date) {
      // Check if it's already a Date object, if not try to create one
      const dateObj = date instanceof Date ? date : new Date(date);

      // Verify we have a valid date
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toISOString().split('T')[0];
      }
    }

    const syntheticEvent = {
      target: {
        name: field,
        value: formattedDate,
      },
    };
    onInputChange(syntheticEvent);
  };

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
      size="xl"
      centered
      styles={{
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Basic Procedure Info */}
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Procedure Name"
                placeholder="e.g., Appendectomy, MRI Scan, Colonoscopy"
                value={formData.procedure_name}
                onChange={handleTextInputChange('procedure_name')}
                required
                withAsterisk
                description="Name of the medical procedure"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Procedure Type"
                placeholder="Select type"
                value={formData.procedure_type}
                onChange={handleSelectChange('procedure_type')}
                data={[
                  {
                    value: 'surgical',
                    label: 'Surgical - Invasive procedure',
                  },
                  {
                    value: 'diagnostic',
                    label: 'Diagnostic - Testing/Imaging',
                  },
                  { value: 'therapeutic', label: 'Therapeutic - Treatment' },
                  {
                    value: 'preventive',
                    label: 'Preventive - Prevention care',
                  },
                  { value: 'emergency', label: 'Emergency - Urgent care' },
                ]}
                description="Category of procedure"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Procedure Code and Setting */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Procedure Code"
                placeholder="e.g., CPT-12345, ICD-10-PCS"
                value={formData.procedure_code}
                onChange={handleTextInputChange('procedure_code')}
                description="Medical coding (CPT, ICD-10-PCS, etc.)"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Procedure Setting"
                placeholder="Select setting"
                value={formData.procedure_setting}
                onChange={handleSelectChange('procedure_setting')}
                data={[
                  {
                    value: 'outpatient',
                    label: 'Outpatient - Same day discharge',
                  },
                  {
                    value: 'inpatient',
                    label: 'Inpatient - Hospital stay required',
                  },
                  {
                    value: 'office',
                    label: 'Office - Doctor office/clinic',
                  },
                  {
                    value: 'emergency',
                    label: 'Emergency - ER/urgent care',
                  },
                  {
                    value: 'home',
                    label: 'Home - At patient home',
                  },
                ]}
                description="Where the procedure takes place"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Description */}
          <Textarea
            label="Description"
            placeholder="Detailed description of the procedure..."
            value={formData.description}
            onChange={handleTextInputChange('description')}
            description="Detailed description of what the procedure involves"
            minRows={3}
            maxRows={5}
          />

          {/* Date, Status, and Duration */}
          <Grid>
            <Grid.Col span={4}>
              <DateInput
                label="Procedure Date"
                placeholder="Select procedure date"
                value={
                  formData.procedure_date
                    ? new Date(formData.procedure_date)
                    : null
                }
                onChange={handleDateChange('procedure_date')}
                firstDayOfWeek={0}
                required
                withAsterisk
                description="When the procedure is/was performed"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Status"
                value={formData.status}
                onChange={handleSelectChange('status')}
                data={[
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
                ]}
                description="Current status of the procedure"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Duration (minutes)"
                placeholder="e.g., 30, 120"
                value={formData.procedure_duration}
                onChange={handleTextInputChange('procedure_duration')}
                description="How long the procedure took/will take"
                type="number"
                min="1"
              />
            </Grid.Col>
          </Grid>

          {/* Facility and Practitioner */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Facility"
                placeholder="e.g., General Hospital, Outpatient Clinic"
                value={formData.facility}
                onChange={handleTextInputChange('facility')}
                description="Where the procedure is/was performed"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Performing Practitioner"
                placeholder="Select practitioner"
                value={
                  formData.practitioner_id
                    ? String(formData.practitioner_id)
                    : ''
                }
                onChange={handleSelectChange('practitioner_id')}
                data={practitionerOptions}
                description="Doctor performing the procedure"
                clearable
                searchable
              />
            </Grid.Col>
          </Grid>

          {/* Complications */}
          <Textarea
            label="Complications"
            placeholder="Any complications that occurred during the procedure..."
            value={formData.procedure_complications}
            onChange={handleTextInputChange('procedure_complications')}
            description="Document any complications, adverse events, or unexpected outcomes"
            minRows={2}
            maxRows={4}
          />

          {/* Notes */}
          <Textarea
            label="Clinical Notes"
            placeholder="Additional notes about the procedure..."
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Any additional clinical notes or observations"
            minRows={3}
            maxRows={6}
          />

          {/* Anesthesia Information */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Anesthesia Type"
                placeholder="Select anesthesia type"
                value={formData.anesthesia_type}
                onChange={handleSelectChange('anesthesia_type')}
                data={[
                  {
                    value: 'general',
                    label: 'General - Complete unconsciousness',
                  },
                  { value: 'local', label: 'Local - Numbing specific area' },
                  {
                    value: 'regional',
                    label: 'Regional - Numbing larger area',
                  },
                  {
                    value: 'sedation',
                    label: 'Sedation - Relaxed but conscious',
                  },
                  { value: 'none', label: 'None - No anesthesia required' },
                ]}
                description="Type of anesthesia used"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Anesthesia Notes"
                placeholder="Anesthesia-related notes..."
                value={formData.anesthesia_notes}
                onChange={handleTextInputChange('anesthesia_notes')}
                description="Any notes about anesthesia administration"
              />
            </Grid.Col>
          </Grid>

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
              {editingProcedure ? 'Update Procedure' : 'Add Procedure'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineProcedureForm;
