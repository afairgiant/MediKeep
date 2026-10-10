import { apiService } from '../services/api';
import logger from '../services/logger';
import { groupByNoteAndPurpose } from './recordVisitLinks';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Create the medication links chosen in a condition's Add form once the condition
 * exists. Medications sharing a note go in one bulk call. Returns the number of failed
 * calls.
 */
export const savePendingConditionMedicationLinks = async (
  conditionId: number,
  pending?: PendingLink[]
): Promise<number> => {
  let failed = 0;
  for (const group of groupByNoteAndPurpose(pending ?? [])) {
    try {
      await apiService.createConditionMedicationsBulk(conditionId, {
        medication_ids: group.map(link => link.entityId),
        relevance_note: group[0].relevanceNote,
      });
    } catch (err) {
      failed += 1;
      logger.error('condition_pending_medication_links_failed', {
        message: 'Failed to link medications to new condition',
        conditionId,
        error: err instanceof Error ? err.message : String(err),
        component: 'savePendingConditionMedicationLinks',
      });
    }
  }
  return failed;
};
