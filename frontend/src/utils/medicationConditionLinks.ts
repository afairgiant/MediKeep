import { apiService } from '../services/api';
import logger from '../services/logger';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Create the condition links chosen in a medication's Add form once the medication
 * exists. The write route belongs to the condition, so each condition is linked on its
 * own. Returns the number of links that failed.
 */
export const savePendingMedicationConditionLinks = async (
  medicationId: number,
  pending?: PendingLink[]
): Promise<number> => {
  let failed = 0;
  for (const link of pending ?? []) {
    try {
      await apiService.createConditionMedication(link.entityId, {
        medication_id: medicationId,
        relevance_note: link.relevanceNote,
      });
    } catch (err) {
      failed += 1;
      logger.error('medication_pending_condition_links_failed', {
        message: 'Failed to link a condition to new medication',
        medicationId,
        error: err instanceof Error ? err.message : String(err),
        component: 'savePendingMedicationConditionLinks',
      });
    }
  }
  return failed;
};
