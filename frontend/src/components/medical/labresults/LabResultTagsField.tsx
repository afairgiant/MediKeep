import React, { useId } from 'react';
import { Input } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TagInput } from '../../common/TagInput';

interface LabResultTagsFieldProps {
  value: string[];
  onChange: (_tags: string[]) => void;
  disabled?: boolean;
}

/**
 * Tags input with a label styled like the themed TextInput/Select labels.
 * Input.Wrapper is not covered by the theme's per-component label styles,
 * so the label style is set here.
 */
const LabResultTagsField: React.FC<LabResultTagsFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const inputId = useId();

  return (
    <Input.Wrapper
      id={inputId}
      label={t('shared:labels.tags')}
      styles={{
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
      }}
    >
      <TagInput
        id={inputId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={t('common:fields.tags.placeholder')}
      />
    </Input.Wrapper>
  );
};

export default LabResultTagsField;
