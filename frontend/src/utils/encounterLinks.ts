import { apiService } from '../services/api';
import logger from '../services/logger';
import { ENCOUNTER_LINK_TYPES } from '../constants/encounterLinkTypes';
import { groupByNoteAndPurpose } from './recordVisitLinks';
import type { PendingLinks } from '../types/encounterLinks';

/** Number of pending links across all types. */
export const countPendingLinks = (pending?: PendingLinks): number =>
  Object.values(pending ?? {}).reduce(
    (sum, links) => sum + (links?.length ?? 0),
    0
  );

/**
 * Create the links chosen in the Add form once the visit exists.
 * Every call is attempted (in parallel); returns the number of calls that failed.
 */
export const savePendingEncounterLinks = async (
  visitId: number,
  pending?: PendingLinks
): Promise<number> => {
  const calls = ENCOUNTER_LINK_TYPES.flatMap(config =>
    groupByNoteAndPurpose(pending?.[config.key] ?? []).map(group => ({
      config,
      group,
    }))
  );

  const results = await Promise.all(
    calls.map(async ({ config, group }) => {
      try {
        await apiService.createEncounterLinksBulk(
          visitId,
          config.apiPath,
          config.bulkBody(
            group.map(link => link.entityId),
            group[0].relevanceNote,
            group[0].purpose
          )
        );
        return 0;
      } catch (err) {
        logger.error('visit_pending_links_failed', {
          message: 'Failed to link records to new visit',
          linkType: config.key,
          visitId,
          error: err instanceof Error ? err.message : String(err),
          component: 'savePendingEncounterLinks',
        });
        return 1;
      }
    })
  );
  return results.reduce<number>((sum, failed) => sum + failed, 0);
};
