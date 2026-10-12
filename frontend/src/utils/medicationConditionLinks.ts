import { apiService } from '../services/api';
import { notifyWarning } from './notifyTranslated';
import { savePendingLinks } from './pendingLinks';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Link the conditions chosen in a medication's Add form once the medication exists, and
 * warn once if any fail. The write route belongs to the condition, so each condition is
 * linked on its own. The medication itself is already created, so a failure never
 * blocks the form.
 */
export const linkPendingMedicationConditionsOrWarn = async (
  medicationId: number,
  pending?: PendingLink[]
): Promise<void> => {
  if (!pending?.length) return;
  const failed = await savePendingLinks(
    pending,
    link =>
      apiService.createConditionMedication(link.entityId, {
        medication_id: medicationId,
        relevance_note: link.relevanceNote,
      }),
    {
      event: 'medication_pending_condition_links_failed',
      message: 'Failed to link a condition to new medication',
      component: 'linkPendingMedicationConditionsOrWarn',
      context: { medicationId },
    }
  );
  if (failed > 0) {
    notifyWarning('medical:medications.form.conditionLinkFailed', {
      title: 'medical:medications.form.conditionLinkPartialFailure',
      interpolation: { count: failed },
    });
  }
};
