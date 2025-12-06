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
  Textarea,
  NumberInput,
  Text,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { visitFormFields } from '../../utils/medicalFormFields';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { formatDateInputChange, parseDateInput } from '../../utils/dateUtils';
import { translateFieldConfig } from '../../utils/formFieldTranslations';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import DocumentManagerWithProgress from '../shared/DocumentManagerWithProgress';
import { TagInput } from '../common/TagInput';
import logger from '../../services/logger';

const MantineVisitForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  conditionsOptions = [],
  conditionsLoading = false,
  editingVisit = null,
  isLoading = false,
  statusMessage,
  children,
}) => {
  const { t } = useTranslation('common');

  // Tab state management
  const [activeTab, setActiveTab] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('info');
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

  // Convert conditions to options
  const conditionOptions = conditionsOptions.map(cond => ({
    value: cond.id.toString(),
    label: cond.diagnosis,
  }));

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('Error in visit form submission:', error);
      setIsSubmitting(false);
    }
  };

  // Render a single field
  const renderField = (field) => {
    if (field.type === 'divider') {
      return null; // Skip dividers in tabbed layout
    }

    // Translate the field configuration
    const translatedField = translateFieldConfig(field, t);

    const commonProps = {
      key: translatedField.name,
      label: translatedField.label,
      placeholder: translatedField.placeholder,
      required: translatedField.required,
      description: translatedField.description,
      error: null,
    };

    // Get dynamic options
    let options = translatedField.options;
    if (translatedField.dynamicOptions === 'practitioners') {
      options = practitionerOptions;
    } else if (translatedField.dynamicOptions === 'conditions') {
      options = conditionOptions;
    }

    switch (translatedField.type) {
      case 'text':
        return (
          <TextInput
            {...commonProps}
            value={formData[translatedField.name] || ''}
            onChange={handleTextInputChange(translatedField.name)}
            maxLength={translatedField.maxLength}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            value={formData[translatedField.name] || null}
            data={options || []}
            onChange={(value) => {
              onInputChange({ target: { name: translatedField.name, value: value || '' } });
            }}
            searchable={translatedField.searchable}
            clearable={translatedField.clearable}
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'date':
        return (
          <DateInput
            {...commonProps}
            value={parseDateInput(formData[translatedField.name])}
            onChange={(date) => {
              const formattedDate = formatDateInputChange(date);
              onInputChange({ target: { name: translatedField.name, value: formattedDate } });
            }}
            valueFormat="YYYY-MM-DD"
            maxDate={translatedField.maxDate && typeof translatedField.maxDate === 'function' ? translatedField.maxDate() : translatedField.maxDate}
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'number':
        return (
          <NumberInput
            {...commonProps}
            value={formData[translatedField.name] || ''}
            onChange={(value) => onInputChange({ target: { name: translatedField.name, value } })}
            min={translatedField.min}
            max={translatedField.max}
            step={translatedField.step}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={formData[translatedField.name] || ''}
            onChange={handleTextInputChange(translatedField.name)}
            minRows={translatedField.minRows || 3}
            maxRows={translatedField.maxRows || 6}
          />
        );

      case 'custom':
        if (translatedField.component === 'TagInput') {
          return (
            <Box key={translatedField.name}>
              <Text size="sm" fw={500} mb="xs">
                {translatedField.label}
                {translatedField.required && <span style={{ color: 'red' }}> *</span>}
              </Text>
              {translatedField.description && (
                <Text size="xs" c="dimmed" mb="xs">
                  {translatedField.description}
                </Text>
              )}
              <TagInput
                value={formData[translatedField.name] || []}
                onChange={(tags) => {
                  onInputChange({ target: { name: translatedField.name, value: tags } });
                }}
                placeholder={translatedField.placeholder}
                maxTags={translatedField.maxTags}
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
  const infoFields = visitFormFields.filter(f =>
    ['reason', 'date', 'practitioner_id', 'visit_type', 'priority', 'condition_id', 'chief_complaint', 'duration_minutes', 'location', 'tags'].includes(f.name)
  );

  const clinicalFields = visitFormFields.filter(f =>
    ['diagnosis', 'treatment_plan', 'follow_up_instructions'].includes(f.name)
  );

  const notesField = visitFormFields.filter(f => f.name === 'notes');

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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={t('visits.form.savingVisit', 'Saving visit...')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size={16} />}>
                {t('visits.form.tabs.visitInfo', 'Visit Info')}
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                {t('visits.form.tabs.clinical', 'Clinical')}
              </Tabs.Tab>
              {editingVisit && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('visits.form.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('visits.form.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Visit Info Tab */}
            <Tabs.Panel value="info">
              <Box mt="md">
                <Grid>
                  {infoFields.map(field => (
                    <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Clinical Tab */}
            <Tabs.Panel value="clinical">
              <Box mt="md">
                <Stack gap="md">
                  {clinicalFields.map(field => renderField(field))}
                </Stack>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            {editingVisit && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>{t('visits.viewModal.attachedDocuments', 'Attached Documents')}</Title>
                    <DocumentManagerWithProgress
                      entityType="visit"
                      entityId={editingVisit.id}
                      mode="edit"
                      onError={(error) => {
                        logger.error('Document manager error in visit form:', error);
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
                {notesField.map(field => renderField(field))}
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Custom children content */}
          {children}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting || isLoading}>
              {t('buttons.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {editingVisit ? t('visits.form.updateVisit', 'Update Visit') : t('visits.form.addVisit', 'Add Visit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineVisitForm;
