import React from 'react';
import { Select, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/**
 * A select component for injury types.
 * Allows selecting from pre-defined injury types stored in the database.
 */
const InjuryTypeSelect = ({
  value,
  onChange,
  injuryTypes = [],
  loading = false,
  error,
  disabled = false,
}) => {
  const { t } = useTranslation('medical');

  // Ensure injuryTypes is always an array
  const safeInjuryTypes = Array.isArray(injuryTypes) ? injuryTypes : [];

  // Convert injury types to Select data format
  const selectData = safeInjuryTypes.map((type) => ({
    value: String(type.id),
    label: type.name,
  }));

  return (
    <Select
      label={t('injuries.injuryType.label', 'Injury Type')}
      description={t(
        'injuries.injuryType.description',
        'Category of injury (e.g., Sprain, Fracture)'
      )}
      placeholder={t('injuries.injuryType.placeholder', 'Select type')}
      data={selectData}
      value={value ? String(value) : null}
      onChange={(val) => onChange(val ? parseInt(val, 10) : null)}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      disabled={disabled || loading}
      error={error}
      clearable
      searchable
      nothingFoundMessage={t('injuries.injuryType.noResults', 'No matching types found')}
      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
    />
  );
};

export default InjuryTypeSelect;
