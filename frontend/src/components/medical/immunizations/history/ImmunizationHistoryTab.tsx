import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { apiService } from '../../../../services/api';
import logger from '../../../../services/logger';
import HistoryByDateView from './HistoryByDateView';
import HistoryByDiseaseView from './HistoryByDiseaseView';
import type {
  HistoryViewMode,
  ImmunizationHistoryResponse,
} from './types';

interface Props {
  patientId: number;
}

// Mantine v8 DatePickerInput emits ISO-formatted date strings (YYYY-MM-DD) by
// default. We keep state in that same shape so the value can flow straight to
// the API without further conversion.
type DateRange = [string | null, string | null];

const ImmunizationHistoryTab = ({ patientId }: Props) => {
  const { t } = useTranslation(['medical', 'common']);
  const [viewMode, setViewMode] = useState<HistoryViewMode>('byDate');
  const [dateRange, setDateRange] = useState<DateRange>([null, null]);
  const [data, setData] = useState<ImmunizationHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    apiService
      .getImmunizationHistory(
        patientId,
        {
          startDate: dateRange[0],
          endDate: dateRange[1],
        },
        controller.signal
      )
      .then((response: ImmunizationHistoryResponse) => {
        setData(response);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        logger.error('immunization_history_fetch_failed', {
          message: 'Failed to fetch immunization history',
          patientId,
          error: err.message,
          component: 'ImmunizationHistoryTab',
        });
        setError(err.message || 'Failed to load history');
        setLoading(false);
      });
    return () => controller.abort();
  }, [patientId, dateRange]);

  const viewModeOptions = useMemo(
    () => [
      {
        value: 'byDate',
        label: t('medical:immunizations.history.viewMode.byDate', 'By Date'),
      },
      {
        value: 'byDisease',
        label: t(
          'medical:immunizations.history.viewMode.byDisease',
          'By Disease'
        ),
      },
    ],
    [t]
  );

  if (loading) {
    return (
      <Stack gap="sm">
        <Skeleton height={36} width={240} />
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={80} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert
        color="red"
        title={t('common:errors.loadFailed', 'Failed to load')}
        icon={<IconAlertCircle size={16} />}
        role="alert"
      >
        {error}
      </Alert>
    );
  }

  const hasDateFilter = Boolean(dateRange[0] || dateRange[1]);

  if (!data || data.items.length === 0) {
    return (
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <SegmentedControl
            value={viewMode}
            onChange={value => setViewMode(value as HistoryViewMode)}
            data={viewModeOptions}
          />
          <DatePickerInput
            type="range"
            value={dateRange}
            onChange={setDateRange}
            placeholder={t(
              'medical:immunizations.history.dateRangePlaceholder',
              'Filter by date range'
            )}
            clearable
            firstDayOfWeek={0}
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        </Group>
        <Text c="dimmed" ta="center" py="xl">
          {hasDateFilter
            ? t(
                'medical:immunizations.history.emptyRange',
                'No vaccinations in this range.'
              )
            : t(
                'medical:immunizations.history.emptyAll',
                'No vaccinations recorded yet.'
              )}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <SegmentedControl
          value={viewMode}
          onChange={value => setViewMode(value as HistoryViewMode)}
          data={viewModeOptions}
        />
        <Group gap="md" wrap="nowrap">
          <DatePickerInput
            type="range"
            value={dateRange}
            onChange={setDateRange}
            placeholder={t(
              'medical:immunizations.history.dateRangePlaceholder',
              'Filter by date range'
            )}
            clearable
            firstDayOfWeek={0}
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
          <Text size="sm" c="dimmed">
            {data.items.length === 1
              ? t(
                  'medical:immunizations.history.recordCountSingular',
                  '1 vaccination'
                )
              : t(
                  'medical:immunizations.history.recordCount',
                  '{{count}} vaccinations',
                  { count: data.items.length }
                )}
          </Text>
        </Group>
      </Group>

      {data.unmatched_count > 0 && (
        <Alert
          color="blue"
          icon={<IconInfoCircle size={16} />}
          title={t(
            'medical:immunizations.history.unmatchedTitle',
            "Some records aren't linked to the vaccine library"
          )}
          withCloseButton
        >
          {t(
            'medical:immunizations.history.unmatchedBanner',
            "{{count}} records aren't linked. Edit a record and re-select from the autocomplete to link it.",
            { count: data.unmatched_count }
          )}
        </Alert>
      )}

      {viewMode === 'byDate' ? (
        <HistoryByDateView items={data.items} />
      ) : (
        <HistoryByDiseaseView
          items={data.items}
          diseasesIndex={data.diseases_index}
        />
      )}
    </Stack>
  );
};

export default ImmunizationHistoryTab;
