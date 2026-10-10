import { Tabs } from '@mantine/core';
import { IconPill } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { useTabLabel } from '../../hooks/useTabLabel';
import { apiService } from '../../services/api';
import {
  linkCountKey,
  useLinkCount,
  useLoadLinkCounts,
} from '../../utils/linkCountStore';
import type { PendingLink } from '../../types/encounterLinks';

/** Key of a condition's "Medications" count, shared with the card that changes it. */
export const conditionMedicationsCountKey = (
  conditionId: number | null | undefined
) => linkCountKey('conditions', conditionId, 'medications');

/**
 * Count of the medications a condition is linked to. For a saved condition it is loaded
 * up front (the card only loads when its tab is opened) and kept current by the card;
 * for a new condition it is the number of pending links. `enabled` is false for records
 * that have no medication links, so the hook can always be called.
 */
export const useConditionMedicationsCount = (
  conditionId?: number | null,
  pendingLinks?: PendingLink[],
  enabled = true
): number | undefined => {
  const key = conditionMedicationsCountKey(conditionId);

  useLoadLinkCounts(
    [
      {
        key,
        load: async signal => {
          const rows: unknown = await apiService.getConditionMedicationLinks(
            conditionId,
            signal
          );
          return Array.isArray(rows) ? rows.length : 0;
        },
      },
    ],
    enabled && Boolean(conditionId)
  );

  const storedCount = useLinkCount(key);
  return conditionId ? storedCount : (pendingLinks?.length ?? 0);
};

interface ConditionMedicationsTabButtonProps {
  /** Saved condition id; null/undefined while a new condition is being created */
  conditionId?: number | null;
  /** Medications chosen in the Add form: their number is the count until the condition is saved */
  pendingLinks?: PendingLink[];
  /**
   * Set when the parent loads the count itself with useConditionMedicationsCount and
   * passes it as `count`. Otherwise the button loads its own.
   */
  managed?: boolean;
  count?: number;
}

/**
 * The "Medications" tab button of a condition dialog, with its count:
 * "Medications (3)". Render inside <Tabs.List>.
 */
const ConditionMedicationsTabButton = ({
  conditionId,
  pendingLinks,
  managed = false,
  count: providedCount,
}: ConditionMedicationsTabButtonProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const ownCount = useConditionMedicationsCount(
    managed ? null : conditionId,
    pendingLinks
  );
  const count = managed ? providedCount : ownCount;

  return (
    <Tabs.Tab value="medications" leftSection={<IconPill size={16} />}>
      {tabLabel(t('shared:categories.medications'), count)}
    </Tabs.Tab>
  );
};

export default ConditionMedicationsTabButton;
