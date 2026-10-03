import { Tabs } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { useTabLabel } from '../../hooks/useTabLabel';
import { apiService } from '../../services/api';
import {
  linkCountKey,
  useLinkCount,
  useLoadLinkCounts,
} from '../../utils/linkCountStore';
import type { PendingLink, RecordTabType } from '../../types/encounterLinks';

/** Key of a record's "Visits" count, shared with the panel that changes it. */
export const recordVisitsCountKey = (
  recordType: RecordTabType,
  recordId: number | null | undefined
) => linkCountKey(recordType, recordId, 'visits');

interface RecordVisitsTabButtonProps {
  recordType: RecordTabType;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  /** Visits chosen in the Add form: their number is the count until the record is saved */
  pendingLinks?: PendingLink[];
  /** The tab's value (default "visits"; lab results use "rel-visits") */
  value?: string;
}

/**
 * The "Visits" tab button of a record dialog, with its count: "Visits (3)". Render inside
 * <Tabs.List>. For a saved record the count is loaded up front (the panel only loads
 * when the tab is opened); the panel keeps it current.
 */
const RecordVisitsTabButton = ({
  recordType,
  recordId,
  pendingLinks,
  value = 'visits',
}: RecordVisitsTabButtonProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const key = recordVisitsCountKey(recordType, recordId);

  useLoadLinkCounts(
    [
      {
        key,
        load: async signal => {
          const rows: unknown =
            recordType === 'labResults'
              ? await apiService.getLabResultEncounters(recordId, signal)
              : await apiService.getRecordEncounterLinks(
                  recordType,
                  recordId,
                  signal
                );
          return Array.isArray(rows) ? rows.length : 0;
        },
      },
    ],
    Boolean(recordId)
  );

  const storedCount = useLinkCount(key);
  const count = recordId ? storedCount : (pendingLinks?.length ?? 0);

  return (
    <Tabs.Tab value={value} leftSection={<IconStethoscope size={16} />}>
      {tabLabel(t('shared:tabs.visits', 'Visits'), count)}
    </Tabs.Tab>
  );
};

export default RecordVisitsTabButton;
