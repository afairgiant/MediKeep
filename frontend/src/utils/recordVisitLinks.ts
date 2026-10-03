import { apiService } from '../services/api';
import logger from '../services/logger';
import { notifyWarning } from './notifyTranslated';
import type { PendingLink, RecordLinkKey } from '../types/encounterLinks';

/** Group links that share the same note and purpose so one bulk call covers them. */
export const groupByNoteAndPurpose = (
  links: PendingLink[]
): PendingLink[][] => {
  const groups = new Map<string, PendingLink[]>();
  links.forEach(link => {
    const key = JSON.stringify([link.relevanceNote, link.purpose]);
    groups.set(key, [...(groups.get(key) ?? []), link]);
  });
  return Array.from(groups.values());
};

/**
 * Create the visit links chosen in a record's Add form once the record exists.
 * Links sharing a note go in one bulk call. Returns the number of failed calls.
 */
export const savePendingRecordVisitLinks = async (
  recordType: RecordLinkKey,
  recordId: number,
  pending?: PendingLink[]
): Promise<number> => {
  let failed = 0;
  for (const group of groupByNoteAndPurpose(pending ?? [])) {
    try {
      await apiService.createRecordEncounterLinksBulk(recordType, recordId, {
        encounter_ids: group.map(link => link.entityId),
        relevance_note: group[0].relevanceNote,
      });
    } catch (err) {
      failed += 1;
      logger.error('record_pending_visit_links_failed', {
        message: 'Failed to link visits to new record',
        recordType,
        recordId,
        error: err instanceof Error ? err.message : String(err),
        component: 'savePendingRecordVisitLinks',
      });
    }
  }
  return failed;
};

/**
 * Save the visits chosen in a record's Add form and warn once if any call fails.
 * The record itself is already created, so a failure never blocks the form.
 */
export const linkPendingVisitsOrWarn = async (
  recordType: RecordLinkKey,
  recordId: number,
  pending?: PendingLink[]
): Promise<void> => {
  if (!pending?.length) return;
  const failed = await savePendingRecordVisitLinks(
    recordType,
    recordId,
    pending
  );
  if (failed > 0) {
    notifyWarning('common:recordRelationships.linkFailed', {
      title: 'common:visits.notifications.relationshipLinkWarning',
    });
  }
};
