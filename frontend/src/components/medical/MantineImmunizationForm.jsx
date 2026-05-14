import { useCallback, useMemo } from 'react';
import { Autocomplete, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from './BaseMedicalForm';
import { immunizationFormFields } from '../../utils/medicalFormFields';
import {
  getAutocompleteOptions as getVaccineAutocompleteOptions,
  getVaccineByName,
  getMatchedCommonName,
  extractVaccineName,
} from '../../constants/vaccineLibrary';

const MantineImmunizationForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingImmunization = null,
}) => {
  const { t } = useTranslation(['medical', 'shared']);

  const setField = useCallback(
    (name, value) => onInputChange({ target: { name, value } }),
    [onInputChange]
  );

  const dynamicOptions = useMemo(
    () => ({
      sites: [
        { value: 'left_arm', label: t('immunizations.siteOptions.leftArm') },
        { value: 'right_arm', label: t('immunizations.siteOptions.rightArm') },
        { value: 'left_deltoid', label: t('immunizations.siteOptions.leftDeltoid') },
        { value: 'right_deltoid', label: t('immunizations.siteOptions.rightDeltoid') },
        { value: 'left_thigh', label: t('immunizations.siteOptions.leftThigh') },
        { value: 'right_thigh', label: t('immunizations.siteOptions.rightThigh') },
      ],
      routes: [
        { value: 'intramuscular', label: t('immunizations.routeOptions.intramuscular') },
        { value: 'subcutaneous', label: t('immunizations.routeOptions.subcutaneous') },
        { value: 'intradermal', label: t('immunizations.routeOptions.intradermal') },
        { value: 'oral', label: t('shared:fields.oral') },
        { value: 'nasal', label: t('shared:fields.nasal') },
      ],
      manufacturers: [
        { value: 'Pfizer-BioNTech', label: t('immunizations.manufacturerOptions.pfizerBioNTech') },
        { value: 'Moderna', label: t('immunizations.manufacturerOptions.moderna') },
        { value: 'Johnson & Johnson', label: t('immunizations.manufacturerOptions.johnsonJohnson') },
        { value: 'AstraZeneca', label: t('immunizations.manufacturerOptions.astraZeneca') },
        { value: 'Merck', label: t('immunizations.manufacturerOptions.merck') },
        { value: 'GlaxoSmithKline', label: t('immunizations.manufacturerOptions.glaxoSmithKline') },
        { value: 'Sanofi', label: t('immunizations.manufacturerOptions.sanofi') },
        { value: 'Other', label: t('shared:fields.other') },
      ],
    }),
    [t]
  );

  // Recomputed per keystroke so brand-name matches via common_names (e.g.
  // "Shingrix") still surface — Mantine's default substring filter alone
  // wouldn't find them.
  const vaccineOptions = useMemo(
    () => getVaccineAutocompleteOptions(formData?.vaccine_name || '', 50),
    [formData?.vaccine_name]
  );

  const handleVaccineOptionSubmit = useCallback(
    selectedValue => {
      const canonicalName = extractVaccineName(selectedValue);
      const libraryEntry = getVaccineByName(canonicalName);

      setField('vaccine_name', canonicalName);

      if (!libraryEntry) return;

      if (!formData?.vaccine_trade_name && libraryEntry.short_name) {
        setField('vaccine_trade_name', libraryEntry.short_name);
      }
      if (!formData?.manufacturer && libraryEntry.default_manufacturer) {
        setField('manufacturer', libraryEntry.default_manufacturer);
      }
      if (libraryEntry.category) {
        const currentTags = Array.isArray(formData?.tags) ? formData.tags : [];
        const categoryTag = libraryEntry.category.toLowerCase();
        if (!currentTags.includes(categoryTag)) {
          setField('tags', [...currentTags, categoryTag]);
        }
      }
    },
    [
      setField,
      formData?.vaccine_trade_name,
      formData?.manufacturer,
      formData?.tags,
    ]
  );

  const renderVaccineNameField = useCallback(
    (fieldConfig, baseProps) => {
      const typedQuery = formData?.vaccine_name || '';
      return (
        <Autocomplete
          {...baseProps}
          placeholder={t(
            'medical:immunizations.vaccineName.searchPlaceholder',
            'Type to search vaccines...'
          )}
          data={vaccineOptions}
          limit={50}
          filter={({ options, limit }) => options.slice(0, limit)}
          renderOption={({ option }) => {
            const canonical = extractVaccineName(option.value);
            const entry = getVaccineByName(canonical);
            const matched = getMatchedCommonName(canonical, typedQuery);
            const isCombined = entry?.is_combined && entry?.components?.length;
            return (
              <Stack gap={0}>
                <Text size="sm">{option.value}</Text>
                {matched && (
                  <Text size="xs" c="dimmed">
                    {t(
                      'medical:immunizations.vaccineName.matchedCommonName',
                      'matched: {{name}}',
                      { name: matched }
                    )}
                  </Text>
                )}
                {isCombined && !matched && (
                  <Text size="xs" c="dimmed">
                    {t(
                      'medical:immunizations.vaccineName.combinedHint',
                      'Combined vaccine — components: {{components}}',
                      { components: entry.components.join(', ') }
                    )}
                  </Text>
                )}
              </Stack>
            );
          }}
          onChange={value => setField('vaccine_name', value)}
          onOptionSubmit={handleVaccineOptionSubmit}
          maxDropdownHeight={300}
          comboboxProps={{ withinPortal: true, zIndex: 3000 }}
        />
      );
    },
    [
      t,
      vaccineOptions,
      formData?.vaccine_name,
      setField,
      handleVaccineOptionSubmit,
    ]
  );

  const customFieldRenderers = useMemo(
    () => ({ vaccine_name: renderVaccineNameField }),
    [renderVaccineNameField]
  );

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingImmunization}
      fields={immunizationFormFields}
      dynamicOptions={dynamicOptions}
      customFieldRenderers={customFieldRenderers}
    />
  );
};

export default MantineImmunizationForm;
