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
import type { PendingLink } from '../../types/encounterLinks';

/** Key of a medication's "Conditions" count, shared with the card that changes it. */
export const medicationConditionsCountKey = (
  medicationId: number | null | undefined
) => linkCountKey('medications', medicationId, 'conditions');

/**
 * Count of the conditions a medication is linked to. For a saved medication it is loaded
 * up front (the card only loads when its tab is opened) and kept current by the card;
 * for a new medication it is the number of pending links. `enabled` is false for
 * records that have no condition links, so the hook can always be called.
 */
export const useMedicationConditionsCount = (
  medicationId?: number | null,
  pendingLinks?: PendingLink[],
  enabled = true
): number | undefined => {
  const key = medicationConditionsCountKey(medicationId);

  useLoadLinkCounts(
    [
      {
        key,
        load: async signal => {
          const rows: unknown = await apiService.getMedicationConditions(
            medicationId,
            signal
          );
          return Array.isArray(rows) ? rows.length : 0;
        },
      },
    ],
    enabled && Boolean(medicationId)
  );

  const storedCount = useLinkCount(key);
  return medicationId ? storedCount : (pendingLinks?.length ?? 0);
};

interface MedicationConditionsTabButtonProps {
  /** Saved medication id; null/undefined while a new medication is being created */
  medicationId?: number | null;
  /** Conditions chosen in the Add form: their number is the count until the medication is saved */
  pendingLinks?: PendingLink[];
  /**
   * Set when the parent loads the count itself with useMedicationConditionsCount and
   * passes it as `count`. Otherwise the button loads its own.
   */
  managed?: boolean;
  count?: number;
}

/**
 * The "Conditions" tab button of a medication dialog, with its count: "Conditions (3)".
 * Render inside <Tabs.List>.
 */
const MedicationConditionsTabButton = ({
  medicationId,
  pendingLinks,
  managed = false,
  count: providedCount,
}: MedicationConditionsTabButtonProps) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const ownCount = useMedicationConditionsCount(
    managed ? null : medicationId,
    pendingLinks
  );
  const count = managed ? providedCount : ownCount;

  return (
    <Tabs.Tab value="conditions" leftSection={<IconStethoscope size={16} />}>
      {tabLabel(t('shared:categories.conditions'), count)}
    </Tabs.Tab>
  );
};

export default MedicationConditionsTabButton;
