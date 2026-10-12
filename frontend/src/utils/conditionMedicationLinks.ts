import { apiService } from '../services/api';
import { notifyWarning } from './notifyTranslated';
import { savePendingLinks } from './pendingLinks';
import { groupByNoteAndPurpose } from './recordVisitLinks';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Link the medications chosen in a condition's Add form once the condition exists, and
 * warn once if any call fails. Medications sharing a note go in one bulk call. The
 * condition itself is already created, so a failure never blocks the form.
 */
export const linkPendingConditionMedicationsOrWarn = async (
  conditionId: number,
  pending?: PendingLink[]
): Promise<void> => {
  if (!pending?.length) return;
  const failed = await savePendingLinks(
    groupByNoteAndPurpose(pending),
    group =>
      apiService.createConditionMedicationsBulk(conditionId, {
        medication_ids: group.map(link => link.entityId),
        relevance_note: group[0].relevanceNote,
      }),
    {
      event: 'condition_pending_medication_links_failed',
      message: 'Failed to link medications to new condition',
      component: 'linkPendingConditionMedicationsOrWarn',
      context: { conditionId },
    }
  );
  if (failed > 0) {
    notifyWarning('common:conditions.notifications.medicationLinkFailed', {
      title: 'common:conditions.notifications.medicationLinkWarning',
    });
  }
};
