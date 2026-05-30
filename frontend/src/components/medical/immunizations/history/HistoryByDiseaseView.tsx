import { Accordion, Badge, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDateFormat } from '../../../../hooks/useDateFormat';
import type { ImmunizationHistoryItem } from './types';
import { getDoseNumber, groupItemsByDisease } from './utils';

interface Props {
  items: ImmunizationHistoryItem[];
  diseasesIndex: Record<string, number[]>;
}

const HistoryByDiseaseView = ({ items, diseasesIndex }: Props) => {
  const { t } = useTranslation(['medical']);
  const { formatDate } = useDateFormat();

  const grouped = useMemo(
    () => groupItemsByDisease(items, diseasesIndex),
    [items, diseasesIndex]
  );

  if (grouped.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="md">
        {t(
          'medical:immunizations.history.noDiseaseData',
          'No linked vaccinations to group by disease.'
        )}
      </Text>
    );
  }

  return (
    <Accordion multiple variant="separated">
      {grouped.map(({ disease, items: diseaseItems }) => (
        <Accordion.Item key={disease} value={disease}>
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>{disease}</Text>
              <Badge variant="light" color="blue">
                {diseaseItems.length === 1
                  ? t(
                      'medical:immunizations.history.dosesCountSingular',
                      '1 dose'
                    )
                  : t(
                      'medical:immunizations.history.dosesCount',
                      '{{count}} doses',
                      { count: diseaseItems.length }
                    )}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              {diseaseItems.map(item => {
                const dose = getDoseNumber(item);
                const doseLabel = dose !== null
                  ? t('medical:immunizations.history.doseLabel', 'Dose {{n}}', { n: dose })
                  : null;
                return (
                  <Group key={item.id} justify="space-between" wrap="nowrap">
                    <Group gap="md" wrap="nowrap">
                      <Text size="sm" c="dimmed" style={{ minWidth: 100 }}>
                        {formatDate(item.date_administered)}
                      </Text>
                      <Text size="sm">{item.vaccine_name}</Text>
                    </Group>
                    {doseLabel && (
                      <Text size="sm" c="dimmed">
                        {doseLabel}
                      </Text>
                    )}
                  </Group>
                );
              })}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
};

export default HistoryByDiseaseView;
