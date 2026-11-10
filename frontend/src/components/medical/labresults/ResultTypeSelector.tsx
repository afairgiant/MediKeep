/**
 * ResultTypeSelector - picks how a test component's result is recorded
 * (numeric, positive/negative, or a written report). Used by the rows that
 * add components, so a test whose default type is wrong can be switched
 * before saving.
 */

import React from 'react';
import { Select } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ResultType } from '../../../constants/testLibraryTypes';

interface ResultTypeSelectorProps {
  value: ResultType | undefined;
  onChange: (_resultType: ResultType) => void;
  disabled?: boolean;
  /** Show the label above the control; it is always the accessible name. */
  showLabel?: boolean;
}

const RESULT_TYPES: ResultType[] = ['quantitative', 'qualitative', 'textual'];

const DEFAULT_LABELS: Record<ResultType, string> = {
  quantitative: 'Quantitative (Numeric)',
  qualitative: 'Qualitative (Pos/Neg)',
  textual: 'Textual (Report)',
};

function ResultTypeSelector({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: ResultTypeSelectorProps): React.ReactElement {
  const { t } = useTranslation('labresults');
  const label = t('testComponents.resultType.label', 'Result type');

  return (
    <Select
      label={showLabel ? label : undefined}
      aria-label={label}
      size="xs"
      data={RESULT_TYPES.map(type => ({
        value: type,
        label: t(`testComponents.resultType.${type}`, DEFAULT_LABELS[type]),
      }))}
      value={value ?? 'quantitative'}
      onChange={next => {
        if (next) onChange(next as ResultType);
      }}
      allowDeselect={false}
      comboboxProps={{ zIndex: 3003 }}
      disabled={disabled}
    />
  );
}

export default ResultTypeSelector;
