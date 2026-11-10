/**
 * NameAutocompleteOption - one suggestion in the lab result name dropdown.
 * Shows the alias that matched when the typed text is not part of the
 * suggestion's own name (e.g. "pap smear" listing "Cytology").
 */

import React from 'react';
import { Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { getMatchedNameAlias } from '../../../hooks/useTestNameAutocomplete';

interface NameAutocompleteOptionProps {
  option: string;
  query: string;
}

function NameAutocompleteOption({
  option,
  query,
}: NameAutocompleteOptionProps): React.ReactElement {
  const { t } = useTranslation('labresults');
  const matched = getMatchedNameAlias(option, query);

  return (
    <Stack gap={0}>
      <Text size="sm">{option}</Text>
      {matched && (
        <Text size="xs" c="dimmed">
          {t('form.matchedCommonName', 'matched: {{name}}', { name: matched })}
        </Text>
      )}
    </Stack>
  );
}

export default NameAutocompleteOption;
