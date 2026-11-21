import React, { useId } from 'react';
import { Input } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TagInput } from '../common/TagInput';

interface TagsFieldProps {
  value: string[];
  onChange: (_tags: string[]) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  maxTags?: number;
}

/**
 * Tags input with a visible label linked to the input, used by every
 * record type's Add/Edit form so the label cannot go missing.
 * Input.Wrapper is not covered by the theme's per-component label styles,
 * so the label style is set here to match the themed TextInput/Select labels.
 */
const TagsField: React.FC<TagsFieldProps> = ({
  value,
  onChange,
  disabled = false,
  label,
  description,
  placeholder,
  maxTags,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const inputId = useId();

  return (
    <Input.Wrapper
      id={inputId}
      label={label ?? t('shared:labels.tags', 'Tags')}
      description={description}
      styles={{
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
      }}
    >
      <TagInput
        id={inputId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={
          placeholder ??
          t(
            'common:fields.tags.placeholder',
            'Add tags to organize and find this record'
          )
        }
        maxTags={maxTags}
      />
    </Input.Wrapper>
  );
};

export default TagsField;
