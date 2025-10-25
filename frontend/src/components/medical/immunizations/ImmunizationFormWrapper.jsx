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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={statusMessage || t('immunizations.form.savingImmunization', 'Saving immunization...')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('immunizations.form.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="administration" leftSection={<IconNeedle size={16} />}>
                {t('immunizations.form.tabs.administration', 'Administration')}
              </Tabs.Tab>
              {editingImmunization && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('immunizations.form.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('immunizations.form.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.vaccineName', 'Vaccine Name')}
                      value={formData.vaccine_name || ''}
                      onChange={handleTextInputChange('vaccine_name')}
                      placeholder={t('immunizations.form.vaccineNamePlaceholder', 'e.g., Flu Shot, COVID-19, Tdap')}
                      required
                      description={t('immunizations.form.vaccineNameDesc', 'Common name for the vaccine')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.tradeName', 'Formal/Trade Name')}
                      value={formData.vaccine_trade_name || ''}
                      onChange={handleTextInputChange('vaccine_trade_name')}
                      placeholder={t('immunizations.form.tradeNamePlaceholder', 'e.g., Flublok TRIV 2025-2026 PFS')}
                      description={t('immunizations.form.tradeNameDesc', 'Complete formal name from vaccine documentation')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.manufacturer', 'Manufacturer')}
                      value={formData.manufacturer || ''}
                      onChange={handleTextInputChange('manufacturer')}
                      placeholder={t('immunizations.form.manufacturerPlaceholder', 'Enter manufacturer')}
                      description={t('immunizations.form.manufacturerDesc', 'Vaccine manufacturer')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={t('immunizations.form.doseNumber', 'Dose Number')}
                      value={formData.dose_number || ''}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'dose_number', value: value || '' } });
                      }}
                      placeholder={t('immunizations.form.doseNumberPlaceholder', 'Enter dose number')}
                      description={t('immunizations.form.doseNumberDesc', 'Which dose in the series')}
                      min={1}
                      max={10}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.lotNumber', 'Lot Number')}
                      value={formData.lot_number || ''}
                      onChange={handleTextInputChange('lot_number')}
                      placeholder={t('immunizations.form.lotNumberPlaceholder', 'Enter lot number')}
                      description={t('immunizations.form.lotNumberDesc', 'Vaccine lot number')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.ndcNumber', 'NDC Number')}
                      value={formData.ndc_number || ''}
                      onChange={handleTextInputChange('ndc_number')}
                      placeholder={t('immunizations.form.ndcNumberPlaceholder', 'e.g., 12345-6789-01')}
                      description={t('immunizations.form.ndcNumberDesc', 'National Drug Code')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('immunizations.form.expirationDate', 'Expiration Date')}
                      value={parseDateInput(formData.expiration_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'expiration_date', value: formattedDate } });
                      }}
                      placeholder={t('immunizations.form.expirationDatePlaceholder', 'Select expiration date')}
                      description={t('immunizations.form.expirationDateDesc', 'When the vaccine expires')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('immunizations.form.tags', 'Tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t('immunizations.form.tagsDesc', 'Add tags to categorize and organize immunizations')}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder={t('immunizations.form.tagsPlaceholder', 'Add tags...')}
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
                      label={t('immunizations.form.dateAdministered', 'Date Administered')}
                      value={parseDateInput(formData.date_administered)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'date_administered', value: formattedDate } });
                      }}
                      placeholder={t('immunizations.form.dateAdministeredPlaceholder', 'Select administration date')}
                      description={t('immunizations.form.dateAdministeredDesc', 'When the vaccine was administered')}
                      required
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('immunizations.form.adminSite', 'Administration Site')}
                      value={formData.site || null}
                      data={[
                        { value: 'left_arm', label: t('immunizations.form.siteLeftArm', 'Left Arm') },
                        { value: 'right_arm', label: t('immunizations.form.siteRightArm', 'Right Arm') },
                        { value: 'left_thigh', label: t('immunizations.form.siteLeftThigh', 'Left Thigh') },
                        { value: 'right_thigh', label: t('immunizations.form.siteRightThigh', 'Right Thigh') },
                        { value: 'left_deltoid', label: t('immunizations.form.siteLeftDeltoid', 'Left Deltoid') },
                        { value: 'right_deltoid', label: t('immunizations.form.siteRightDeltoid', 'Right Deltoid') },
                        { value: 'oral', label: t('immunizations.form.siteOral', 'Oral') },
                        { value: 'nasal', label: t('immunizations.form.siteNasal', 'Nasal') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'site', value: value || '' } });
                      }}
                      placeholder={t('immunizations.form.adminSitePlaceholder', 'Select administration site')}
                      description={t('immunizations.form.adminSiteDesc', 'Where vaccine was administered')}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('immunizations.form.adminRoute', 'Administration Route')}
                      value={formData.route || null}
                      data={[
                        { value: 'intramuscular', label: t('immunizations.form.routeIM', 'Intramuscular (IM)') },
                        { value: 'subcutaneous', label: t('immunizations.form.routeSC', 'Subcutaneous (SC)') },
                        { value: 'intradermal', label: t('immunizations.form.routeID', 'Intradermal (ID)') },
                        { value: 'oral', label: t('immunizations.form.routeOral', 'Oral') },
                        { value: 'nasal', label: t('immunizations.form.routeNasal', 'Nasal') },
                        { value: 'intravenous', label: t('immunizations.form.routeIV', 'Intravenous (IV)') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'route', value: value || '' } });
                      }}
                      placeholder={t('immunizations.form.adminRoutePlaceholder', 'Select administration route')}
                      description={t('immunizations.form.adminRouteDesc', 'Method of administration')}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('immunizations.form.location', 'Location/Facility')}
                      value={formData.location || ''}
                      onChange={handleTextInputChange('location')}
                      placeholder={t('immunizations.form.locationPlaceholder', 'e.g., CVS Pharmacy, Hospital, Clinic')}
                      description={t('immunizations.form.locationDesc', 'Where vaccine was administered')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('immunizations.form.practitioner', 'Practitioner')}
                      value={formData.practitioner_id ? formData.practitioner_id.toString() : null}
                      data={practitionerOptions}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder={t('immunizations.form.practitionerPlaceholder', 'Select administering practitioner')}
                      description={t('immunizations.form.practitionerDesc', 'Healthcare provider who administered vaccine')}
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
                  label={t('immunizations.form.clinicalNotes', 'Clinical Notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('immunizations.form.clinicalNotesPlaceholder', 'Enter clinical notes, reactions, or additional details')}
                  description={t('immunizations.form.clinicalNotesDesc', 'Additional information about this immunization')}
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
              {t('buttons.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.vaccine_name?.trim() || !formData.date_administered}
            >
              {editingImmunization ? t('immunizations.form.updateImmunization', 'Update Immunization') : t('immunizations.form.createImmunization', 'Create Immunization')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ImmunizationFormWrapper;
