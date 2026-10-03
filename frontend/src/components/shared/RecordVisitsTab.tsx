import { useTranslation } from 'react-i18next';
import { Stack, Text } from '@mantine/core';

import RecordVisitsCard from './RecordVisitsCard';
import type { RecordVisitsCardProps } from './RecordVisitsCard';

/**
 * Visits tab for a record (procedure, injury, symptom, condition, medication).
 * Mirrors the visit's linked-record tabs: the same link can be created, viewed,
 * edited and removed from either side.
 */
const RecordVisitsTab = (props: RecordVisitsCardProps) => {
  const { t } = useTranslation(['common']);

  return (
    <Stack gap="md">
      {!props.recordId && !props.isViewMode && (
        <Text size="sm" c="dimmed">
          {t('common:recordRelationships.saveFirstInfo')}
        </Text>
      )}
      <RecordVisitsCard {...props} />
    </Stack>
  );
};

export default RecordVisitsTab;
