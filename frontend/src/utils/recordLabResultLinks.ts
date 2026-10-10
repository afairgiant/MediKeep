import {
  recordLabResultsHavePurpose,
  type RecordLabResultPath,
} from '../constants/recordLabResultLinks';
import { apiService } from '../services/api';
import logger from '../services/logger';
import { notifyWarning } from './notifyTranslated';
import type { PendingLink } from '../types/encounterLinks';

/**
 * Create the lab result links chosen in a record's Add form once the record exists.
 * There is no bulk route, so each lab result is linked on its own. Returns the number
 * of links that failed.
 */
export const savePendingRecordLabResultLinks = async (
  recordPath: RecordLabResultPath,
  recordId: number,
  pending?: PendingLink[]
): Promise<number> => {
  let failed = 0;
  for (const link of pending ?? []) {
    try {
      await apiService.createRecordLabResultLink(recordPath, recordId, {
        lab_result_id: link.entityId,
        relevance_note: link.relevanceNote,
        // Only conditions and procedures have a purpose
        ...(recordLabResultsHavePurpose(recordPath) && {
          purpose: link.purpose,
        }),
      });
    } catch (err) {
      failed += 1;
      logger.error('record_pending_lab_result_links_failed', {
        message: 'Failed to link a lab result to new record',
        recordPath,
        recordId,
        error: err instanceof Error ? err.message : String(err),
        component: 'savePendingRecordLabResultLinks',
      });
    }
  }
  return failed;
};

/**
 * Save the lab results chosen in a record's Add form and warn once if any fail.
 * The record itself is already created, so a failure never blocks the form.
 */
export const linkPendingLabResultsOrWarn = async (
  recordPath: RecordLabResultPath,
  recordId: number,
  pending?: PendingLink[]
): Promise<void> => {
  if (!pending?.length) return;
  const failed = await savePendingRecordLabResultLinks(
    recordPath,
    recordId,
    pending
  );
  if (failed > 0) {
    notifyWarning('common:recordRelationships.labResultLinkFailed', {
      title: 'common:visits.notifications.relationshipLinkWarning',
    });
  }
};
