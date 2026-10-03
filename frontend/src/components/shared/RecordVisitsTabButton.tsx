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

/**
 * Count of the visits a record is linked to. For a saved record it is loaded up front
 * (the panel only loads when its tab is opened) and kept current by the panel; for a
 * new record it is the number of pending links.
 */
export const useRecordVisitsCount = (
  recordType: RecordTabType,
  recordId?: number | null,
  pendingLinks?: PendingLink[]
): number | undefined => {
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
  return recordId ? storedCount : (pendingLinks?.length ?? 0);
};

interface RecordVisitsTabButtonProps {
  recordType: RecordTabType;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  /** Visits chosen in the Add form: their number is the count until the record is saved */
  pendingLinks?: PendingLink[];
  /** The tab's value (default "visits"; lab results use "rel-visits") */
  value?: string;
  /**
   * Set when the parent loads the count itself with useRecordVisitsCount (it needs it to
   * decide whether to show the tab) and passes it as `count`. Otherwise the button
   * loads its own.
   */
  managed?: boolean;
  count?: number;
}

/**
 * The "Visits" tab button of a record dialog, with its count: "Visits (3)". Render inside
 * <Tabs.List>.
 */
const RecordVisitsTabButton = ({
  recordType,
  recordId,
  pendingLinks,
  value = 'visits',
  managed = false,
  count: providedCount,
}: RecordVisitsTabButtonProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const ownCount = useRecordVisitsCount(
    recordType,
    managed ? null : recordId,
    pendingLinks
  );
  const count = managed ? providedCount : ownCount;

  return (
    <Tabs.Tab value={value} leftSection={<IconStethoscope size={16} />}>
      {tabLabel(t('shared:tabs.visits', 'Visits'), count)}
    </Tabs.Tab>
  );
};

export default RecordVisitsTabButton;
