import { useState, useEffect, useCallback } from 'react';
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
  MultiSelect,
  Text,
  Title,
  Switch,
  Alert,
  ActionIcon,
  Anchor,
  Chip,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { DateInput } from '../adapters/DateInput';
import {
  IconInfoCircle,
  IconPill,
  IconFileText,
  IconNotes,
  IconStethoscope,
  IconBell,
  IconAlertCircle,
  IconTrash,
  IconPlus,
  IconSend,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { medicationFormFields } from '../../utils/medicalFormFields';
import { getReminderBlockerDescriptors, REMINDER_BLOCKERS } from '../../utils/medicationReminders';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { formatDateInputChange, parseDateInput } from '../../utils/dateUtils';
import { useDateFormat } from '../../hooks/useDateFormat';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import DocumentManagerWithProgress from '../shared/DocumentManagerWithProgress';
import { TagInput } from '../common/TagInput';
import MedicationRelationships from './MedicationRelationships';
import logger from '../../services/logger';
import { apiService } from '../../services/api';
import notificationApi from '../../services/api/notificationApi';
import { notifySuccess, notifyError } from '../../utils/notifyTranslated';

const REMINDER_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Mirrors MAX_REMINDER_TIMES in app/schemas/medication.py
const MAX_REMINDER_TIMES = 12;
// Mon–Sun order matching Python weekday() (Mon=0, Sun=6)
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
  conditions = [],
  navigate = null,
  children,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
}) => {
  // Translation
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { dateInputFormat, dateParser } = useDateFormat();

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reminder-related state
  const [hasReminderChannel, setHasReminderChannel] = useState(true);
  const [isSendingTestReminder, setIsSendingTestReminder] = useState(false);

  // Form handlers
  const { handleTextInputChange, handleCheckboxChange } =
    useFormHandlers(onInputChange);

  // Check whether any notification channel is enabled for medication reminders.
  // Used to surface a warning when the user enables reminders without a route
  // for the notification to leave through. Fetched only when the Reminders tab
  // is active (the warning lives there), and re-checked when switching between
  // medications in the same modal so the warning reflects the channel state
  // at the moment of editing, not the state at the first open.
  useEffect(() => {
    if (!isOpen || activeTab !== 'reminders') return;
    let cancelled = false;
    notificationApi
      .getPreferenceMatrix()
      .then(matrix => {
        if (cancelled) return;
        const channelStates =
          matrix?.preferences?.medication_reminder_due || {};
        const anyEnabled = Object.values(channelStates).some(Boolean);
        setHasReminderChannel(anyEnabled);
      })
      .catch(() => {
        // If the check fails we err on the side of NOT showing a warning —
        // a transient API failure shouldn't block the form's primary purpose.
        if (!cancelled) setHasReminderChannel(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, editingMedication?.id]);

  const handleSendTestReminder = async () => {
    if (!editingMedication?.id) return;
    setIsSendingTestReminder(true);
    try {
      await apiService.sendMedicationTestReminder(editingMedication.id);
      notifySuccess(
        t('medications.reminders.testSuccess', 'Test reminder sent')
      );
    } catch (error) {
      const status = error?.status;
      if (status === 422) {
        notifyError(
          t(
            'medications.reminders.noChannelsWarning',
            'No notification channel is configured for medication reminders.'
          )
        );
        setHasReminderChannel(false);
      } else {
        notifyError(
          t(
            'medications.reminders.testError',
            'Failed to send test reminder'
          )
        );
      }
      logger.error('medication_reminder_test_failed', {
        message: 'Test reminder failed',
        medicationId: editingMedication?.id,
        error,
        component: 'MantineMedicationForm',
      });
    } finally {
      setIsSendingTestReminder(false);
    }
  };

  // Stable identity is load-bearing: this lands in DocumentManager's effect
  // deps (via DocumentManagerWithProgress.updateHandlersRef). A new function
  // per render re-fires that effect, which calls back into page state
  // (setDocumentManagerMethods) on a 50ms timeout — an infinite render loop.
  const handleDocumentManagerRef = useCallback(
    methods => {
      if (onDocumentManagerRef) {
        onDocumentManagerRef(methods);
      }
    },
    [onDocumentManagerRef]
  );

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in medications ${editingMedication ? 'edit' : 'create'}`,
      medicationId: editingMedication?.id,
      error: error,
      component: 'MantineMedicationForm',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (
    success,
    completedCount,
    failedCount
  ) => {
    logger.info('medications_upload_completed', {
      message: 'File upload completed in medications form',
      medicationId: editingMedication?.id,
      success,
      completedCount,
      failedCount,
      component: 'MantineMedicationForm',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

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
    label: `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`,
  }));

  // Convert pharmacies to options
  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: String(pharmacy.id),
    label: pharmacy.name || pharmacy.brand || 'Pharmacy',
  }));

  const conditionOptions = conditions.map(c => ({
    value: String(c.id),
    label: `${c.diagnosis || `Condition #${c.id}`}${c.severity ? ` (${c.severity})` : ''}${c.status ? ` - ${c.status}` : ''}`,
  }));

  // Handle form submission
  const handleSubmit = async e => {
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
  const renderField = field => {
    if (field.type === 'divider') {
      return null;
    }

    const commonProps = {
      key: field.name,
      label: field.labelKey ? t(field.labelKey) : field.label,
      placeholder: field.placeholderKey
        ? t(field.placeholderKey)
        : field.placeholder,
      required: field.required,
      description: field.descriptionKey
        ? t(field.descriptionKey)
        : field.description,
      error: null,
    };

    // Get dynamic options
    let options = field.options;
    if (field.dynamicOptions === 'practitioners') {
      options = practitionerOptions;
    } else if (field.dynamicOptions === 'pharmacies') {
      options = pharmacyOptions;
    } else if (field.optionsKey && field.options) {
      // Translate options using optionsKey as base
      options = field.options.map(opt => ({
        value: opt.value,
        label: opt.labelKey
          ? t(`${field.optionsKey}.${opt.labelKey}`)
          : opt.label,
      }));
    } else if (field.options && field.options.some(opt => opt.labelKey)) {
      // Translate options with individual labelKey
      options = field.options.map(opt => ({
        value: opt.value,
        label: opt.labelKey ? t(opt.labelKey) : opt.label,
      }));
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
            onChange={value => {
              onInputChange({
                target: { name: field.name, value: value || '' },
              });
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
            placeholder={dateInputFormat}
            value={parseDateInput(formData[field.name])}
            onChange={date => {
              const formattedDate = formatDateInputChange(date);
              onInputChange({
                target: { name: field.name, value: formattedDate },
              });
            }}
            valueFormat={dateInputFormat}
            dateParser={dateParser}
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={formData[field.name] || ''}
            onChange={handleTextInputChange(field.name)}
            minRows={field.minRows || 3}
            maxRows={field.maxRows || 6}
          />
        );

      case 'switch':
        return (
          <Switch
            key={field.name}
            label={field.labelKey ? t(field.labelKey) : field.label}
            description={
              field.descriptionKey
                ? t(field.descriptionKey)
                : field.description
            }
            checked={Boolean(formData[field.name])}
            onChange={event =>
              handleCheckboxChange(field.name)(event.currentTarget.checked)
            }
          />
        );

      case 'timeList': {
        const times = Array.isArray(formData[field.name])
          ? formData[field.name]
          : [];
        const setTimes = value =>
          onInputChange({ target: { name: field.name, value } });
        const tooMany = times.length >= MAX_REMINDER_TIMES;
        return (
          <Box key={field.name}>
            <Text size="sm" fw={500}>
              {field.labelKey ? t(field.labelKey) : field.label}
            </Text>
            {field.descriptionKey && (
              <Text size="xs" c="dimmed" mb="xs">
                {t(field.descriptionKey)}
              </Text>
            )}
            <Stack gap="xs" mt="xs">
              {times.length === 0 && (
                <Text size="sm" c="dimmed">
                  {t(
                    'medications.reminders.times.empty',
                    'No reminder times configured.'
                  )}
                </Text>
              )}
              {times.map((entry, index) => {
                const isInvalid =
                  entry !== '' && !REMINDER_TIME_RE.test(entry);
                const isDuplicate =
                  entry !== '' &&
                  times.findIndex(other => other === entry) !== index;
                let error = null;
                if (isInvalid) {
                  error = t(
                    'medications.reminders.times.invalid',
                    'Time must be HH:MM (24-hour)'
                  );
                } else if (isDuplicate) {
                  error = t(
                    'medications.reminders.times.duplicate',
                    'This time is already in the list'
                  );
                }
                return (
                  <Group key={index} gap="xs" align="flex-end" wrap="nowrap">
                    <TimeInput
                      value={entry}
                      onChange={event => {
                        const newValue = event.currentTarget.value;
                        setTimes(
                          times.map((other, i) =>
                            i === index ? newValue : other
                          )
                        );
                      }}
                      error={error}
                      aria-label={`${t(
                        'medications.reminders.times.label',
                        'Reminder times'
                      )} ${index + 1}`}
                      style={{ flex: 1 }}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setTimes(times.filter((_, i) => i !== index))}
                      aria-label={t(
                        'medications.reminders.times.removeAriaLabel',
                        'Remove time'
                      )}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                );
              })}
            </Stack>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              mt="xs"
              disabled={tooMany}
              onClick={() => setTimes([...times, ''])}
            >
              {t('medications.reminders.times.addButton', 'Add time')}
            </Button>
            {tooMany && (
              <Text size="xs" c="dimmed" mt="xs">
                {t('medications.reminders.times.max', {
                  count: MAX_REMINDER_TIMES,
                  defaultValue: 'Maximum of {{count}} times',
                })}
              </Text>
            )}
          </Box>
        );
      }

      case 'dayPicker': {
        const selectedDays = Array.isArray(formData[field.name])
          ? formData[field.name].map(String)
          : [];
        return (
          <Box key={field.name}>
            <Text size="sm" fw={500}>
              {field.labelKey ? t(field.labelKey) : field.label}
            </Text>
            {field.descriptionKey && (
              <Text size="xs" c="dimmed" mb="xs">
                {t(field.descriptionKey)}
              </Text>
            )}
            <Chip.Group
              multiple
              value={selectedDays}
              onChange={values => {
                onInputChange({
                  target: {
                    name: field.name,
                    value: values.length ? values.map(Number) : null,
                  },
                });
              }}
            >
              <Group gap="xs" mt="xs">
                {DAY_KEYS.map((key, index) => (
                  <Chip key={key} value={String(index)} size="sm">
                    {t(`medical:medications.reminders.days.${key}`, key)}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </Box>
        );
      }

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
                onChange={tags => {
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

  // Group fields by section for tabs (section is declared on each field in medication.js)
  const basicFields = medicationFormFields.filter(f => f.section === 'basic');
  const detailsFields = medicationFormFields.filter(
    f => f.section === 'details'
  );
  const remindersFields = medicationFormFields.filter(
    f => f.section === 'reminders'
  );
  const notesFields = medicationFormFields.filter(f => f.section === 'notes');

  const remindersEnabled = Boolean(formData.reminder_enabled);
  const showNoChannelWarning = remindersEnabled && !hasReminderChannel;
  const reminderBlockerDescriptors = remindersEnabled
    ? getReminderBlockerDescriptors(formData).filter(d => d.blocker !== REMINDER_BLOCKERS.DAY_NOT_ACTIVE)
    : [];

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
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        },
      }}
    >
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={statusMessage?.title || t('medications.form.saving')}
        submessage={statusMessage?.message}
        type={statusMessage?.type || 'loading'}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="basic"
                leftSection={<IconInfoCircle size={16} />}
              >
                {t('shared:tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab value="details" leftSection={<IconPill size={16} />}>
                {t('shared:tabs.details')}
              </Tabs.Tab>
              <Tabs.Tab
                value="conditions"
                leftSection={<IconStethoscope size={16} />}
              >
                {t('shared:categories.conditions')}
              </Tabs.Tab>
              <Tabs.Tab
                value="reminders"
                leftSection={<IconBell size={16} />}
                rightSection={
                  reminderBlockerDescriptors.length > 0 ? (
                    <IconAlertCircle
                      size={14}
                      role="img"
                      aria-label={t(
                        'medications.reminders.notFiring.title',
                        "Reminders won't fire"
                      )}
                      color="var(--mantine-color-red-6)"
                    />
                  ) : undefined
                }
              >
                {t('medications.reminders.tabLabel', 'Reminders')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes')}
              </Tabs.Tab>
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingMedication
                  ? t('shared:tabs.documents')
                  : t('shared:tabs.addFiles', 'Add Files')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  {basicFields.map(field => (
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

            {/* Details Tab */}
            <Tabs.Panel value="details">
              <Box mt="md">
                <Grid>
                  {detailsFields.map(field => (
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

            {/* Conditions Tab */}
            <Tabs.Panel value="conditions">
              <Box mt="md">
                {editingMedication ? (
                  <MedicationRelationships
                    direction="medication"
                    medicationId={editingMedication.id}
                    conditions={conditions}
                    navigate={navigate}
                    isViewMode={false}
                  />
                ) : (
                  <MultiSelect
                    label={t('common:buttons.linkConditions')}
                    description={t(
                      'medications.form.linkConditionsDescription'
                    )}
                    placeholder={t('common:modals.chooseConditionsToLink')}
                    data={conditionOptions}
                    value={formData.condition_ids || []}
                    onChange={values => {
                      onInputChange({
                        target: { name: 'condition_ids', value: values },
                      });
                    }}
                    searchable
                    clearable
                    comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    nothingFoundMessage={t(
                      'medications.form.noConditionsFound'
                    )}
                  />
                )}
              </Box>
            </Tabs.Panel>

            {/* Reminders Tab */}
            <Tabs.Panel value="reminders">
              <Box mt="md">
                <Stack gap="md">
                  {showNoChannelWarning && (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title={t(
                        'medications.reminders.noChannelsTitle',
                        'No notification channel enabled'
                      )}
                    >
                      <Text size="sm">
                        {t(
                          'medications.reminders.noChannelsWarning',
                          'No notification channel is configured for medication reminders. Open Notification Settings to enable a channel.'
                        )}
                      </Text>
                      <Anchor href="/settings/notifications" size="sm">
                        {t(
                          'medications.reminders.openSettings',
                          'Open Notification Settings'
                        )}
                      </Anchor>
                    </Alert>
                  )}
                  {reminderBlockerDescriptors.length > 0 && (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title={t(
                        'medications.reminders.notFiring.title',
                        "Reminders won't fire"
                      )}
                    >
                      <Stack gap={4}>
                        {reminderBlockerDescriptors.map(d => (
                          <Text size="sm" key={d.blocker}>
                            {t(d.key, { ...d.params, defaultValue: d.defaultValue })}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  )}
                  <Grid>
                    {remindersFields.map(field => (
                      <Grid.Col
                        span={{ base: 12, sm: field.gridColumn || 12 }}
                        key={field.name}
                      >
                        {renderField(field)}
                      </Grid.Col>
                    ))}
                  </Grid>
                  <Group justify="flex-start">
                    <Button
                      variant="default"
                      leftSection={<IconSend size={14} />}
                      onClick={handleSendTestReminder}
                      disabled={
                        !editingMedication ||
                        !remindersEnabled ||
                        isSendingTestReminder
                      }
                      loading={isSendingTestReminder}
                    >
                      {t(
                        'medications.reminders.testButton',
                        'Send test reminder now'
                      )}
                    </Button>
                  </Group>
                  {!editingMedication && (
                    <Text size="xs" c="dimmed">
                      {t(
                        'medications.reminders.saveBeforeTest',
                        'Save the medication first to send a test reminder.'
                      )}
                    </Text>
                  )}
                </Stack>
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  {notesFields.map(field => (
                    <Grid.Col
                      span={{ base: 12, sm: field.gridColumn || 12 }}
                      key={field.name}
                    >
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <Stack gap="md">
                  {editingMedication && (
                    <Title order={4}>
                      {t('shared:labels.attachedDocuments')}
                    </Title>
                  )}
                  <DocumentManagerWithProgress
                    entityType="medication"
                    entityId={editingMedication?.id || null}
                    mode={editingMedication ? 'edit' : 'create'}
                    onUploadPendingFiles={handleDocumentManagerRef}
                    showProgressModal={true}
                    onUploadComplete={handleDocumentUploadComplete}
                    onError={handleDocumentError}
                  />
                </Stack>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Custom children content */}
          {children}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              {t('shared:fields.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {editingMedication
                ? t('medications.form.updateMedication')
                : t('medications.form.addMedication')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineMedicationForm;
