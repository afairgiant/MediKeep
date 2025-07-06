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
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

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

  // Handle NumberInput onChange (receives value directly)
  const handleNumberChange = field => value => {
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
          {/* Vaccine Name */}
          <TextInput
            label="Vaccine Name"
            placeholder="e.g., COVID-19 mRNA, Influenza, MMR"
            value={formData.vaccine_name || ''}
            onChange={handleTextInputChange('vaccine_name')}
            required
            withAsterisk
            description="Name of the administered vaccine"
          />

          {/* Administration Date and Dose Number */}
          <Grid>
            <Grid.Col span={8}>
              <DateInput
                label="Date Administered"
                placeholder="Select administration date"
                value={
                  formData.date_administered
                    ? new Date(formData.date_administered)
                    : null
                }
                onChange={handleDateChange('date_administered')}
                firstDayOfWeek={0}
                required
                withAsterisk
                description="When the vaccine was given"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Dose Number"
                placeholder="1, 2, 3..."
                value={
                  formData.dose_number ? parseInt(formData.dose_number) : ''
                }
                onChange={handleNumberChange('dose_number')}
                min={1}
                max={10}
                description="Which dose in series"
              />
            </Grid.Col>
          </Grid>

          {/* Lot Number and Manufacturer */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Lot Number"
                placeholder="Vaccine batch/lot number"
                value={formData.lot_number || ''}
                onChange={handleTextInputChange('lot_number')}
                description="Batch identifier for tracking"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Manufacturer"
                placeholder="Select manufacturer"
                value={formData.manufacturer || ''}
                onChange={handleSelectChange('manufacturer')}
                data={manufacturerOptions}
                description="Vaccine manufacturer"
                searchable
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Injection Site and Route */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Injection Site"
                placeholder="Select injection site"
                value={formData.site || ''}
                onChange={handleSelectChange('site')}
                data={siteOptions}
                description="Location where vaccine was given"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Administration Route"
                placeholder="Select route"
                value={formData.route || ''}
                onChange={handleSelectChange('route')}
                data={routeOptions}
                description="Method of administration"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Expiration Date */}
          <DateInput
            label="Vaccine Expiration Date"
            placeholder="Select expiration date"
            value={
              formData.expiration_date
                ? new Date(formData.expiration_date)
                : null
            }
            onChange={handleDateChange('expiration_date')}
            firstDayOfWeek={0}
            description="Expiration date of the vaccine vial/dose used"
            clearable
          />

          {/* Additional Notes */}
          <Textarea
            label="Additional Notes"
            placeholder="Any reactions, side effects, or additional observations..."
            value={formData.notes || ''}
            onChange={handleTextInputChange('notes')}
            description="Record any adverse reactions or important notes"
            minRows={3}
            maxRows={6}
          />

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
              {editingImmunization ? 'Update Immunization' : 'Add Immunization'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineImmunizationForm;
