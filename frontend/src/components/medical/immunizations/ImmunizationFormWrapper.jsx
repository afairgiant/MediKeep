import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
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
import { DateInput } from '../../adapters/DateInput';
import {
  IconInfoCircle,
  IconNeedle,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import {
  parseDateInput,
  getTodayEndOfDay,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';
import {
  getAutocompleteEntries,
  getVaccineByName,
  extractVaccineName,
} from '../../../constants/vaccineLibrary';

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
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { dateInputFormat, dateParser } = useDateFormat();

  const handleDocumentManagerRef = methods => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in immunizations ${editingImmunization ? 'edit' : 'create'}`,
      immunizationId: editingImmunization?.id,
      error: error,
      component: 'ImmunizationFormWrapper',
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
    logger.info('immunizations_upload_completed', {
      message: 'File upload completed in immunizations form',
      immunizationId: editingImmunization?.id,
      success,
      completedCount,
      failedCount,
      component: 'ImmunizationFormWrapper',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  const setField = useCallback(
    (name, value) => onInputChange({ target: { name, value } }),
    [onInputChange]
  );

  // Library-ranked vaccine suggestions for the autocomplete. Recomputed per
  // keystroke so brand-name matches via common_names (e.g. "Shingrix") surface
  // — Mantine's default substring filter alone would miss them. The lookup
  // map lets renderOption resolve {entry, matched} for each option in O(1)
  // instead of re-parsing the display string and re-querying the library.
  const { vaccineOptions, optionLookup } = useMemo(() => {
    const entries = getAutocompleteEntries(formData?.vaccine_name || '', 50);
    return {
      vaccineOptions: entries.map(e => e.value),
      optionLookup: new Map(entries.map(e => [e.value, e])),
    };
  }, [formData?.vaccine_name]);

  const handleVaccineOptionSubmit = useCallback(
    selectedValue => {
      const canonicalName = extractVaccineName(selectedValue);
      const libraryEntry = getVaccineByName(canonicalName);

      if (!libraryEntry) {
        // Free-text fallback — keep whatever the user picked verbatim.
        setField('vaccine_name', canonicalName);
        return;
      }

      // vaccine_name holds the casual/common name (e.g. "MMR"); the formal
      // descriptor lives only in our library for now. vaccine_trade_name is
      // left untouched — for many single-organism vaccines (BCG, Rabies) the
      // formal name is identical to the common name, so auto-filling it just
      // duplicates data. Users can fill in a specific brand manually.
      const commonName = libraryEntry.short_name || libraryEntry.vaccine_name;
      setField('vaccine_name', commonName);

      if (libraryEntry.default_manufacturer) {
        setField('manufacturer', libraryEntry.default_manufacturer);
      }

      if (libraryEntry.category) {
        const currentTags = Array.isArray(formData?.tags) ? formData.tags : [];
        if (!currentTags.includes(libraryEntry.category)) {
          setField('tags', [...currentTags, libraryEntry.category]);
        }
      }
    },
    [setField, formData?.tags]
  );

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
  const handleSubmit = async e => {
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
    label: p.name,
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
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={
          statusMessage?.title ||
          t('immunizations.form.savingImmunization', 'Saving immunization...')
        }
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
                {t('shared:tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab
                value="administration"
                leftSection={<IconNeedle size={16} />}
              >
                {t('shared:tabs.administration', 'Administration')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes', 'Notes')}
              </Tabs.Tab>
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingImmunization
                  ? t('shared:tabs.documents', 'Documents')
                  : t('shared:tabs.addFiles', 'Add Files')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Autocomplete
                      label={t('shared:fields.vaccineName', 'Vaccine Name')}
                      value={formData.vaccine_name || ''}
                      onChange={value => setField('vaccine_name', value)}
                      onOptionSubmit={handleVaccineOptionSubmit}
                      data={vaccineOptions}
                      limit={50}
                      filter={({ options, limit }) => options.slice(0, limit)}
                      renderOption={({ option }) => {
                        const info = optionLookup.get(option.value);
                        const entry = info?.entry;
                        const matched = info?.matched;
                        const isCombined =
                          entry?.is_combined && entry?.components?.length;
                        let hint = null;
                        if (matched) {
                          hint = t(
                            'medical:immunizations.vaccineName.matchedCommonName',
                            'matched: {{name}}',
                            { name: matched }
                          );
                        } else if (isCombined) {
                          hint = t(
                            'medical:immunizations.vaccineName.combinedHint',
                            'Combined vaccine — components: {{components}}',
                            { components: entry.components.join(', ') }
                          );
                        }
                        return (
                          <Stack gap={0}>
                            <Text size="sm">{option.value}</Text>
                            {hint && (
                              <Text size="xs" c="dimmed">
                                {hint}
                              </Text>
                            )}
                          </Stack>
                        );
                      }}
                      placeholder={t(
                        'medical:immunizations.vaccineName.searchPlaceholder',
                        'Type to search vaccines...'
                      )}
                      required
                      description={t(
                        'immunizations.form.vaccineNameDesc',
                        'Common name for the vaccine'
                      )}
                      maxDropdownHeight={300}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t(
                        'immunizations.form.tradeName',
                        'Formal/Trade Name'
                      )}
                      value={formData.vaccine_trade_name || ''}
                      onChange={handleTextInputChange('vaccine_trade_name')}
                      placeholder={t(
                        'immunizations.form.tradeNamePlaceholder',
                        'e.g., Flublok TRIV 2025-2026 PFS'
                      )}
                      description={t(
                        'immunizations.form.tradeNameDesc',
                        'Complete formal name from vaccine documentation'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.manufacturer', 'Manufacturer')}
                      value={formData.manufacturer || ''}
                      onChange={handleTextInputChange('manufacturer')}
                      placeholder={t(
                        'immunizations.form.manufacturerPlaceholder',
                        'Enter manufacturer'
                      )}
                      description={t(
                        'immunizations.form.manufacturerDesc',
                        'Vaccine manufacturer'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={t('shared:fields.doseNumber', 'Dose Number')}
                      value={formData.dose_number || ''}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'dose_number', value: value || '' },
                        });
                      }}
                      placeholder={t(
                        'immunizations.form.doseNumberPlaceholder',
                        'Enter dose number'
                      )}
                      description={t(
                        'immunizations.form.doseNumberDesc',
                        'Which dose in the series'
                      )}
                      min={1}
                      max={10}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.lotNumber', 'Lot Number')}
                      value={formData.lot_number || ''}
                      onChange={handleTextInputChange('lot_number')}
                      placeholder={t(
                        'immunizations.form.lotNumberPlaceholder',
                        'Enter lot number'
                      )}
                      description={t(
                        'immunizations.form.lotNumberDesc',
                        'Vaccine lot number'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.ndcNumber', 'NDC Number')}
                      value={formData.ndc_number || ''}
                      onChange={handleTextInputChange('ndc_number')}
                      placeholder={t(
                        'immunizations.form.ndcNumberPlaceholder',
                        'e.g., 12345-6789-01'
                      )}
                      description={t(
                        'immunizations.form.ndcNumberDesc',
                        'National Drug Code'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t(
                        'shared:fields.expirationDate',
                        'Expiration Date'
                      )}
                      value={parseDateInput(formData.expiration_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'expiration_date',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t(
                        'immunizations.form.expirationDateDesc',
                        'When the vaccine expires'
                      )}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('shared:labels.tags', 'Tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t(
                          'immunizations.form.tagsDesc',
                          'Add tags to categorize and organize immunizations'
                        )}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={tags => {
                          onInputChange({
                            target: { name: 'tags', value: tags },
                          });
                        }}
                        placeholder={t('shared:fields.addTags', 'Add tags...')}
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
                      label={t(
                        'shared:fields.dateAdministered',
                        'Date Administered'
                      )}
                      value={parseDateInput(formData.date_administered)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'date_administered',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t(
                        'immunizations.form.dateAdministeredDesc',
                        'When the vaccine was administered'
                      )}
                      required
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t(
                        'shared:labels.administrationSite',
                        'Administration Site'
                      )}
                      value={formData.site || null}
                      data={[
                        {
                          value: 'left_arm',
                          label: t(
                            'immunizations.form.siteLeftArm',
                            'Left Arm'
                          ),
                        },
                        {
                          value: 'right_arm',
                          label: t(
                            'immunizations.form.siteRightArm',
                            'Right Arm'
                          ),
                        },
                        {
                          value: 'left_thigh',
                          label: t(
                            'immunizations.form.siteLeftThigh',
                            'Left Thigh'
                          ),
                        },
                        {
                          value: 'right_thigh',
                          label: t(
                            'immunizations.form.siteRightThigh',
                            'Right Thigh'
                          ),
                        },
                        {
                          value: 'left_deltoid',
                          label: t(
                            'immunizations.form.siteLeftDeltoid',
                            'Left Deltoid'
                          ),
                        },
                        {
                          value: 'right_deltoid',
                          label: t(
                            'immunizations.form.siteRightDeltoid',
                            'Right Deltoid'
                          ),
                        },
                        {
                          value: 'oral',
                          label: t('shared:fields.oral', 'Oral'),
                        },
                        {
                          value: 'nasal',
                          label: t('shared:fields.nasal', 'Nasal'),
                        },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'site', value: value || '' },
                        });
                      }}
                      placeholder={t(
                        'immunizations.form.adminSitePlaceholder',
                        'Select administration site'
                      )}
                      description={t(
                        'immunizations.form.adminSiteDesc',
                        'Where vaccine was administered'
                      )}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t(
                        'immunizations.form.adminRoute',
                        'Administration Route'
                      )}
                      value={formData.route || null}
                      data={[
                        {
                          value: 'intramuscular',
                          label: t(
                            'immunizations.form.routeIM',
                            'Intramuscular (IM)'
                          ),
                        },
                        {
                          value: 'subcutaneous',
                          label: t(
                            'immunizations.form.routeSC',
                            'Subcutaneous (SC)'
                          ),
                        },
                        {
                          value: 'intradermal',
                          label: t(
                            'immunizations.form.routeID',
                            'Intradermal (ID)'
                          ),
                        },
                        {
                          value: 'oral',
                          label: t('shared:fields.oral', 'Oral'),
                        },
                        {
                          value: 'nasal',
                          label: t('shared:fields.nasal', 'Nasal'),
                        },
                        {
                          value: 'intravenous',
                          label: t(
                            'immunizations.form.routeIV',
                            'Intravenous (IV)'
                          ),
                        },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'route', value: value || '' },
                        });
                      }}
                      placeholder={t(
                        'immunizations.form.adminRoutePlaceholder',
                        'Select administration route'
                      )}
                      description={t(
                        'immunizations.form.adminRouteDesc',
                        'Method of administration'
                      )}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t(
                        'immunizations.form.location',
                        'Location/Facility'
                      )}
                      value={formData.location || ''}
                      onChange={handleTextInputChange('location')}
                      placeholder={t(
                        'immunizations.form.locationPlaceholder',
                        'e.g., CVS Pharmacy, Hospital, Clinic'
                      )}
                      description={t(
                        'immunizations.form.locationDesc',
                        'Where vaccine was administered'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.practitioner', 'Practitioner')}
                      value={
                        formData.practitioner_id
                          ? formData.practitioner_id.toString()
                          : null
                      }
                      data={practitionerOptions}
                      onChange={value => {
                        onInputChange({
                          target: {
                            name: 'practitioner_id',
                            value: value || '',
                          },
                        });
                      }}
                      placeholder={t(
                        'immunizations.form.practitionerPlaceholder',
                        'Select administering practitioner'
                      )}
                      description={t(
                        'immunizations.form.practitionerDesc',
                        'Healthcare provider who administered vaccine'
                      )}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('shared:labels.clinicalNotes', 'Clinical Notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t(
                    'immunizations.form.clinicalNotesPlaceholder',
                    'Enter clinical notes, reactions, or additional details'
                  )}
                  description={t(
                    'immunizations.form.clinicalNotesDesc',
                    'Additional information about this immunization'
                  )}
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="immunization"
                  entityId={editingImmunization?.id || null}
                  mode={editingImmunization ? 'edit' : 'create'}
                  onUploadPendingFiles={handleDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={handleDocumentUploadComplete}
                  onError={handleDocumentError}
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={onClose}
              disabled={isLoading || isSubmitting}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={
                !formData.vaccine_name?.trim() || !formData.date_administered
              }
            >
              {editingImmunization
                ? t(
                    'immunizations.form.updateImmunization',
                    'Update Immunization'
                  )
                : t(
                    'immunizations.form.createImmunization',
                    'Create Immunization'
                  )}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ImmunizationFormWrapper;
