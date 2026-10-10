import { Tabs } from '@mantine/core';
import { IconFlask } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import type { RecordLabResultPath } from '../../constants/recordLabResultLinks';
import { useTabLabel } from '../../hooks/useTabLabel';
import { apiService } from '../../services/api';
import {
  linkCountKey,
  useLinkCount,
  useLoadLinkCounts,
} from '../../utils/linkCountStore';
import type { PendingLink } from '../../types/encounterLinks';

/** Key of a record's "Lab Results" count, shared with the card that changes it. */
export const recordLabResultsCountKey = (
  recordPath: RecordLabResultPath,
  recordId: number | null | undefined
) => linkCountKey(recordPath, recordId, 'labResults');

/**
 * Count of the lab results a record is linked to. For a saved record it is loaded up
 * front (the card only loads when its tab is opened) and kept current by the card; for
 * a new record it is the number of pending links.
 */
export const useRecordLabResultsCount = (
  recordPath: RecordLabResultPath,
  recordId?: number | null,
  pendingLinks?: PendingLink[]
): number | undefined => {
  const key = recordLabResultsCountKey(recordPath, recordId);

  useLoadLinkCounts(
    [
      {
        key,
        load: async signal => {
          const rows: unknown = await apiService.getRecordLabResultLinks(
            recordPath,
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

interface RecordLabResultsTabButtonProps {
  recordPath: RecordLabResultPath;
  /** Saved record id; null/undefined while a new record is being created */
  recordId?: number | null;
  /** Lab results chosen in the Add form: their number is the count until the record is saved */
  pendingLinks?: PendingLink[];
  /**
   * Set when the parent loads the count itself with useRecordLabResultsCount (it needs
   * it to decide whether to show the tab) and passes it as `count`. Otherwise the
   * button loads its own.
   */
  managed?: boolean;
  count?: number;
}

/**
 * The "Lab Results" tab button of a medication or procedure dialog, with its count:
 * "Lab Results (3)". Render inside <Tabs.List>.
 */
const RecordLabResultsTabButton = ({
  recordPath,
  recordId,
  pendingLinks,
  managed = false,
  count: providedCount,
}: RecordLabResultsTabButtonProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const ownCount = useRecordLabResultsCount(
    recordPath,
    managed ? null : recordId,
    pendingLinks
  );
  const count = managed ? providedCount : ownCount;

  return (
    <Tabs.Tab value="labResults" leftSection={<IconFlask size={16} />}>
      {tabLabel(t('shared:tabs.labResults'), count)}
    </Tabs.Tab>
  );
};

export default RecordLabResultsTabButton;
