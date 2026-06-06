import { Accordion, Badge, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useDateFormat } from '../../../../hooks/useDateFormat';
import type { ImmunizationHistoryItem } from './types';
import { getDoseNumber, groupItemsByDisease } from './utils';

interface Props {
  items: ImmunizationHistoryItem[];
  diseasesIndex: Record<string, number[]>;
  onItemClick?: (_item: ImmunizationHistoryItem) => void;
  onLinkClick?: (_item: ImmunizationHistoryItem) => void;
}

interface RowProps {
  item: ImmunizationHistoryItem;
  doseLabel: string | null;
  formattedDate: string;
  onActivate?: (_item: ImmunizationHistoryItem) => void;
}

// Shared row markup for disease groups AND the Miscellaneous/Unlinked group.
// Keeping one component avoids the two blocks drifting apart on future tweaks.
const HistoryItemRow = ({
  item,
  doseLabel,
  formattedDate,
  onActivate,
}: RowProps) => {
  const clickable = Boolean(onActivate);
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onActivate) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(item);
    }
  };
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      style={clickable ? { cursor: 'pointer' } : undefined}
      onClick={clickable ? () => onActivate?.(item) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? handleKey : undefined}
    >
      <Group gap="md" wrap="nowrap">
        <Text size="sm" c="dimmed" style={{ minWidth: 100 }}>
          {formattedDate}
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
};

const HistoryByDiseaseView = ({
  items,
  diseasesIndex,
  onItemClick,
  onLinkClick,
}: Props) => {
  const { t } = useTranslation(['medical']);
  const { formatDate } = useDateFormat();

  const grouped = useMemo(
    () => groupItemsByDisease(items, diseasesIndex),
    [items, diseasesIndex]
  );

  const unlinkedItems = useMemo(
    () => items.filter(item => !item.is_library_matched),
    [items]
  );

  if (grouped.length === 0 && unlinkedItems.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="md">
        {t(
          'medical:immunizations.history.noDiseaseData',
          'No vaccinations are linked to the library. Switch to the By Date view to see all records, or edit a record and re-select a vaccine from the autocomplete to link it.'
        )}
      </Text>
    );
  }

  const miscLabel = t(
    'medical:immunizations.history.miscGroup',
    'Miscellaneous / Unlinked'
  );
  const doseLabelFor = (item: ImmunizationHistoryItem) => {
    const dose = getDoseNumber(item);
    return dose !== null
      ? t('medical:immunizations.history.doseLabel', 'Dose {{n}}', { n: dose })
      : null;
  };
  const dosesBadge = (count: number) =>
    count === 1
      ? t('medical:immunizations.history.dosesCountSingular', '1 dose')
      : t('medical:immunizations.history.dosesCount', '{{count}} doses', {
          count,
        });

  return (
    <Accordion multiple variant="separated">
      {grouped.map(({ disease, items: diseaseItems }) => (
        <Accordion.Item key={disease} value={disease}>
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>{disease}</Text>
              <Badge variant="light" color="blue">
                {dosesBadge(diseaseItems.length)}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              {diseaseItems.map(item => (
                <HistoryItemRow
                  key={item.id}
                  item={item}
                  doseLabel={doseLabelFor(item)}
                  formattedDate={formatDate(item.date_administered)}
                  onActivate={onItemClick}
                />
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
      {unlinkedItems.length > 0 && (
        <Accordion.Item key="__misc__" value="__misc__">
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600} c="dimmed">
                {miscLabel}
              </Text>
              <Badge variant="outline" color="gray">
                {dosesBadge(unlinkedItems.length)}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t(
                  'medical:immunizations.history.miscGroupHint',
                  "These records aren't linked to the vaccine library yet. Click one to edit and pick a library entry."
                )}
              </Text>
              {unlinkedItems.map(item => (
                <HistoryItemRow
                  key={item.id}
                  item={item}
                  doseLabel={doseLabelFor(item)}
                  formattedDate={formatDate(item.date_administered)}
                  // Misc rows jump straight to Edit (onLinkClick) when wired —
                  // these items are unlinked by definition, so the user's
                  // intent is always "fix this," not "view this." Falls back
                  // to onItemClick so the View modal path stays usable when
                  // no link handler is provided.
                  onActivate={onLinkClick ?? onItemClick}
                />
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      )}
    </Accordion>
  );
};

export default HistoryByDiseaseView;
