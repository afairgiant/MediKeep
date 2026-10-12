import {
  recordLabResultsHavePurpose,
  type RecordLabResultPath,
} from '../constants/recordLabResultLinks';
import { apiService } from '../services/api';
import { notifyWarning } from './notifyTranslated';
import { savePendingLinks } from './pendingLinks';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Link the lab results chosen in a record's Add form once the record exists, and warn
 * once if any fail. There is no bulk route, so each lab result is linked on its own.
 * The record itself is already created, so a failure never blocks the form.
 */
export const linkPendingLabResultsOrWarn = async (
  recordPath: RecordLabResultPath,
  recordId: number,
  pending?: PendingLink[]
): Promise<void> => {
  if (!pending?.length) return;
  const failed = await savePendingLinks(
    pending,
    link =>
      apiService.createRecordLabResultLink(recordPath, recordId, {
        lab_result_id: link.entityId,
        relevance_note: link.relevanceNote,
        // Only conditions and procedures have a purpose
        ...(recordLabResultsHavePurpose(recordPath) && {
          purpose: link.purpose,
        }),
      }),
    {
      event: 'record_pending_lab_result_links_failed',
      message: 'Failed to link a lab result to new record',
      component: 'linkPendingLabResultsOrWarn',
      context: { recordPath, recordId },
    }
  );
  if (failed > 0) {
    notifyWarning('common:recordRelationships.labResultLinkFailed', {
      title: 'common:visits.notifications.relationshipLinkWarning',
    });
  }
};
