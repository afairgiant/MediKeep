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
  Select,
  Text,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconPill,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import { medicationFormFields } from '../../utils/medicalFormFields';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { formatDateInputChange } from '../../utils/dateUtils';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import DocumentManagerWithProgress from '../shared/DocumentManagerWithProgress';
import { TagInput } from '../common/TagInput';
import logger from '../../services/logger';

const MantineMedicationForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  pharmacies = [],
  editingMedication = null,
  isLoading = false,
  children,
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Convert practitioners to options
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `Dr. ${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`,
  }));

  // Convert pharmacies to options
  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: String(pharmacy.id),
    label: pharmacy.name || pharmacy.brand || 'Pharmacy',
  }));

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('Error in medication form submission:', error);
      setIsSubmitting(false);
    }
  };

  // Render a single field
  const renderField = (field) => {
    if (field.type === 'divider') {
      return null;
    }

    const commonProps = {
      key: field.name,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      description: field.description,
      error: null,
    };

    // Get dynamic options
    let options = field.options;
    if (field.dynamicOptions === 'practitioners') {
      options = practitionerOptions;
    } else if (field.dynamicOptions === 'pharmacies') {
      options = pharmacyOptions;
    }

    switch (field.type) {
      case 'text':
        return (
          <TextInput
            {...commonProps}
            value={formData[field.name] || ''}
            onChange={handleTextInputChange(field.name)}
            maxLength={field.maxLength}
            minLength={field.minLength}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            value={formData[field.name] || null}
            data={options || []}
            onChange={(value) => {
              onInputChange({ target: { name: field.name, value: value || '' } });
            }}
            searchable={field.searchable}
            clearable={field.clearable}
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'date':
        return (
          <DateInput
            {...commonProps}
            value={formData[field.name] ? new Date(formData[field.name]) : null}
            onChange={(date) => {
              const formattedDate = formatDateInputChange(date);
              onInputChange({ target: { name: field.name, value: formattedDate } });
            }}
            valueFormat="YYYY-MM-DD"
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'custom':
        if (field.component === 'TagInput') {
          return (
            <Box key={field.name}>
              <Text size="sm" fw={500} mb="xs">
                {field.label}
                {field.required && <span style={{ color: 'red' }}> *</span>}
              </Text>
              {field.description && (
                <Text size="xs" c="dimmed" mb="xs">
                  {field.description}
                </Text>
              )}
              <TagInput
                value={formData[field.name] || []}
                onChange={(tags) => {
                  onInputChange({ target: { name: field.name, value: tags } });
                }}
                placeholder={field.placeholder}
                maxTags={field.maxTags}
              />
            </Box>
          );
        }
        return null;

      default:
        return null;
    }
  };

  // Group fields by section for tabs
  const basicFields = medicationFormFields.filter(f =>
    ['medication_name', 'medication_type', 'dosage', 'frequency', 'route', 'indication'].includes(f.name)
  );

  const detailsFields = medicationFormFields.filter(f =>
    ['status', 'effective_period_start', 'effective_period_end', 'practitioner_id', 'pharmacy_id', 'tags'].includes(f.name)
  );

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <FormLoadingOverlay visible={isSubmitting || isLoading} message="Saving medication..." />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="details" leftSection={<IconPill size={16} />}>
                Details
              </Tabs.Tab>
              {editingMedication && (
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
                  {basicFields.map(field => (
                    <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Details Tab */}
            <Tabs.Panel value="details">
              <Box mt="md">
                <Grid>
                  {detailsFields.map(field => (
                    <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            {editingMedication && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>Attached Documents</Title>
                    <DocumentManagerWithProgress
                      entityType="medication"
                      entityId={editingMedication.id}
                      mode="edit"
                      config={{
                        acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
                        maxSize: 10 * 1024 * 1024, // 10MB
                        maxFiles: 10
                      }}
                      onError={(error) => {
                        logger.error('Document manager error in medication form:', error);
                      }}
                      showProgressModal={true}
                    />
                  </Stack>
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Text size="sm" c="dimmed">
                  Additional notes and information about this medication can be added here in future updates.
                </Text>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Custom children content */}
          {children}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting || isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {editingMedication ? 'Update Medication' : 'Add Medication'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineMedicationForm;
