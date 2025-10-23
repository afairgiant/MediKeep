import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Textarea,
  Select,
  Text,
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconNeedle,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay, formatDateInputChange } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';

const ImmunizationFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingImmunization = null,
  practitioners = [],
  isLoading = false,
  statusMessage,
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  // Get today's date for date picker constraints
  const today = getTodayEndOfDay();

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('immunization_form_wrapper_error', {
        message: 'Error in ImmunizationFormWrapper',
        immunizationId: editingImmunization?.id,
        error: error.message,
        component: 'ImmunizationFormWrapper',
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const practitionerOptions = practitioners.map(p => ({
    value: p.id.toString(),
    label: p.name
  }));

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={statusMessage || "Saving immunization..."} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="administration" leftSection={<IconNeedle size={16} />}>
                Administration
              </Tabs.Tab>
              {editingImmunization && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  Documents
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                Notes
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Vaccine Name"
                      value={formData.vaccine_name || ''}
                      onChange={handleTextInputChange('vaccine_name')}
                      placeholder="e.g., Flu Shot, COVID-19, Tdap"
                      required
                      description="Common name for the vaccine"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Formal/Trade Name"
                      value={formData.vaccine_trade_name || ''}
                      onChange={handleTextInputChange('vaccine_trade_name')}
                      placeholder="e.g., Flublok TRIV 2025-2026 PFS"
                      description="Complete formal name from vaccine documentation"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Manufacturer"
                      value={formData.manufacturer || ''}
                      onChange={handleTextInputChange('manufacturer')}
                      placeholder="Enter manufacturer"
                      description="Vaccine manufacturer"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label="Dose Number"
                      value={formData.dose_number || ''}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'dose_number', value: value || '' } });
                      }}
                      placeholder="Enter dose number"
                      description="Which dose in the series"
                      min={1}
                      max={10}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Lot Number"
                      value={formData.lot_number || ''}
                      onChange={handleTextInputChange('lot_number')}
                      placeholder="Enter lot number"
                      description="Vaccine lot number"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="NDC Number"
                      value={formData.ndc_number || ''}
                      onChange={handleTextInputChange('ndc_number')}
                      placeholder="e.g., 12345-6789-01"
                      description="National Drug Code"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Expiration Date"
                      value={parseDateInput(formData.expiration_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'expiration_date', value: formattedDate } });
                      }}
                      placeholder="Select expiration date"
                      description="When the vaccine expires"
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Tags
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add tags to categorize and organize immunizations
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder="Add tags..."
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Administration Tab */}
            <Tabs.Panel value="administration">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Date Administered"
                      value={parseDateInput(formData.date_administered)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'date_administered', value: formattedDate } });
                      }}
                      placeholder="Select administration date"
                      description="When the vaccine was administered"
                      required
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Administration Site"
                      value={formData.site || null}
                      data={[
                        { value: 'left_arm', label: 'Left Arm' },
                        { value: 'right_arm', label: 'Right Arm' },
                        { value: 'left_thigh', label: 'Left Thigh' },
                        { value: 'right_thigh', label: 'Right Thigh' },
                        { value: 'left_deltoid', label: 'Left Deltoid' },
                        { value: 'right_deltoid', label: 'Right Deltoid' },
                        { value: 'oral', label: 'Oral' },
                        { value: 'nasal', label: 'Nasal' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'site', value: value || '' } });
                      }}
                      placeholder="Select administration site"
                      description="Where vaccine was administered"
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Administration Route"
                      value={formData.route || null}
                      data={[
                        { value: 'intramuscular', label: 'Intramuscular (IM)' },
                        { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
                        { value: 'intradermal', label: 'Intradermal (ID)' },
                        { value: 'oral', label: 'Oral' },
                        { value: 'nasal', label: 'Nasal' },
                        { value: 'intravenous', label: 'Intravenous (IV)' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'route', value: value || '' } });
                      }}
                      placeholder="Select administration route"
                      description="Method of administration"
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Location/Facility"
                      value={formData.location || ''}
                      onChange={handleTextInputChange('location')}
                      placeholder="e.g., CVS Pharmacy, Hospital, Clinic"
                      description="Where vaccine was administered"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Practitioner"
                      value={formData.practitioner_id ? formData.practitioner_id.toString() : null}
                      data={practitionerOptions}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder="Select administering practitioner"
                      description="Healthcare provider who administered vaccine"
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingImmunization && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="immunization"
                    entityId={editingImmunization.id}
                    onError={(error) => {
                      logger.error('Document upload error', { error });
                    }}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label="Clinical Notes"
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder="Enter clinical notes, reactions, or additional details"
                  description="Additional information about this immunization"
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading || isSubmitting}>
              Cancel
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.vaccine_name?.trim() || !formData.date_administered}
            >
              {editingImmunization ? 'Update' : 'Create'} Immunization
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ImmunizationFormWrapper;
