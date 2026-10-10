import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
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
} from '@mantine/core';
import { DateInput } from '../adapters/DateInput';
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
import { translateField } from '../../utils/translateField';
import { useDateFormat } from '../../hooks/useDateFormat';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import DocumentManagerWithProgress from '../shared/DocumentManagerWithProgress';
import {
  VisitLinkTabButtons,
  VisitLinkTabPanels,
} from './visits/VisitLinkTabs';
import { TagInput } from '../common/TagInput';
import logger from '../../services/logger';
import PractitionerSelectWithCreate from './practitioners/PractitionerSelectWithCreate';
import { getRememberedEditTab } from '../../utils/editTabHandoff';
import { useSubDialog } from '../../contexts/SubDialogContext';

const MantineVisitForm = ({
  formError,
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  conditionsOptions = [],
  conditionsLoading: _conditionsLoading = false,
  editingVisit = null,
  isLoading = false,
  statusMessage: _statusMessage,
  patientId,
  navigate,
  onDocumentManagerRef,
  onFileUploadComplete,
  onDocumentError,
  children,
}) => {
  // Translation hooks - medical for field translations, common for UI elements
  const { t } = useTranslation(['medical', 'common', 'shared']);
  // Set when this dialog was opened from inside another one (inline create)
  const subDialog = useSubDialog();
  const { dateInputFormat, dateParser } = useDateFormat();

  // Tab state management
  const [activeTab, setActiveTab] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(
        subDialog ? 'info' : getRememberedEditTab('visits', 'info')
      );
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen, subDialog]);

  // Convert conditions to options
  const conditionOptions = conditionsOptions.map(cond => ({
    value: cond.id.toString(),
    label: cond.diagnosis,
  }));

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('visit_form_submission_error', {
        message: 'Error in visit form submission',
        error: error.message,
        component: 'MantineVisitForm',
      });
      setIsSubmitting(false);
    }
  };

  // Render a single field
  const renderField = field => {
    if (field.type === 'divider') {
      return null; // Skip dividers in tabbed layout
    }

    // Translate the field configuration
    const translatedField = translateField(field, t);

    const commonProps = {
      key: translatedField.name,
      label: translatedField.label,
      placeholder: translatedField.placeholder,
      required: translatedField.required,
      description: translatedField.description,
      error: null,
    };

    if (translatedField.name === 'practitioner_id') {
      return (
        <PractitionerSelectWithCreate
          value={formData.practitioner_id ? String(formData.practitioner_id) : null}
          onChange={value =>
            onInputChange({
              target: { name: 'practitioner_id', value: value || '' },
            })
          }
          practitioners={practitioners}
          label={translatedField.label}
          placeholder={translatedField.placeholder}
          description={translatedField.description}
        />
      );
    }

    // Get dynamic options
    let options = translatedField.options;
    if (translatedField.dynamicOptions === 'conditions') {
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
            onChange={value => {
              onInputChange({
                target: { name: translatedField.name, value: value || '' },
              });
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
            placeholder={dateInputFormat}
            value={parseDateInput(formData[translatedField.name])}
            onChange={date => {
              const formattedDate = formatDateInputChange(date);
              onInputChange({
                target: { name: translatedField.name, value: formattedDate },
              });
            }}
            valueFormat={dateInputFormat}
            dateParser={dateParser}
            maxDate={
              translatedField.maxDate &&
              typeof translatedField.maxDate === 'function'
                ? translatedField.maxDate()
                : translatedField.maxDate
            }
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'number':
        return (
          <NumberInput
            {...commonProps}
            value={formData[translatedField.name] || ''}
            onChange={value =>
              onInputChange({ target: { name: translatedField.name, value } })
            }
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
                {translatedField.required && (
                  <span style={{ color: 'red' }}> *</span>
                )}
              </Text>
              {translatedField.description && (
                <Text size="xs" c="dimmed" mb="xs">
                  {translatedField.description}
                </Text>
              )}
              <TagInput
                value={formData[translatedField.name] || []}
                onChange={tags => {
                  onInputChange({
                    target: { name: translatedField.name, value: tags },
                  });
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
    [
      'reason',
      'date',
      'practitioner_id',
      'visit_type',
      'priority',
      'condition_id',
      'chief_complaint',
      'duration_minutes',
      'location',
      'tags',
    ].includes(f.name)
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
      zIndex={subDialog?.zIndex ?? 2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        },
      }}
    >
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={t('common:visits.form.savingVisit', 'Saving visit...')}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size={16} />}>
                {t('common:visits.form.tabs.visitInfo', 'Visit Info')}
              </Tabs.Tab>
              <Tabs.Tab
                value="clinical"
                leftSection={<IconStethoscope size={16} />}
              >
                {t('common:visits.form.tabs.clinical', 'Clinical')}
              </Tabs.Tab>
              {!subDialog && (
                <VisitLinkTabButtons
                  visitId={editingVisit?.id}
                  pendingLinks={formData.pending_links}
                  activeTab={activeTab}
                  onSelectTab={setActiveTab}
                />
              )}
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingVisit
                  ? t('shared:tabs.documents', 'Documents')
                  : t('shared:tabs.addFiles', 'Add Files')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Visit Info Tab */}
            <Tabs.Panel value="info">
              <Box mt="md">
                <Grid>
                  {infoFields.map(field => (
                    <Grid.Col
                      span={{ base: 12, sm: field.gridColumn || 6 }}
                      key={field.name}
                    >
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
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="visit"
                  entityId={editingVisit?.id || null}
                  mode={editingVisit ? 'edit' : 'create'}
                  onUploadPendingFiles={onDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={onFileUploadComplete}
                  onError={onDocumentError}
                />
              </Box>
            </Tabs.Panel>

            {/* One tab per linked record type (not offered in a sub-dialog: nesting stays one level deep) */}
            {!subDialog && (
              <VisitLinkTabPanels
                activeTab={activeTab}
                visitId={editingVisit?.id}
                patientId={patientId}
                pendingLinks={formData.pending_links}
                onPendingChange={next =>
                  onInputChange({
                    target: { name: 'pending_links', value: next },
                  })
                }
                navigate={navigate}
              />
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">{notesField.map(field => renderField(field))}</Box>
            </Tabs.Panel>
          </Tabs>

          {/* Custom children content */}
          {children}

          {formError && (
            <Alert color="red" variant="light" role="alert">
              {formError}
            </Alert>
          )}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {editingVisit
                ? t('common:visits.form.updateVisit', 'Update Visit')
                : t('common:visits.form.addVisit', 'Add Visit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

MantineVisitForm.propTypes = {
  formError: PropTypes.string,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  formData: PropTypes.object,
  onInputChange: PropTypes.func,
  onSubmit: PropTypes.func,
  practitioners: PropTypes.array,
  conditionsOptions: PropTypes.array,
  conditionsLoading: PropTypes.bool,
  editingVisit: PropTypes.object,
  isLoading: PropTypes.bool,
  statusMessage: PropTypes.object,
  patientId: PropTypes.number,
  navigate: PropTypes.func,
  onDocumentManagerRef: PropTypes.func,
  onFileUploadComplete: PropTypes.func,
  onDocumentError: PropTypes.func,
  children: PropTypes.node,
};

export default MantineVisitForm;
