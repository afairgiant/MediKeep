import { useEffect, useState } from 'react';

import { apiService } from '../services/api';
import logger from '../services/logger';

export interface TreatmentLinkCounts {
  medications?: number;
  encounters?: number;
  labResults?: number;
  equipment?: number;
}

const countOf = (list: unknown): number | undefined =>
  Array.isArray(list) ? list.length : undefined;

/**
 * How many medications, visits, lab results and equipment items a saved treatment is
 * linked to, loaded up front so the tabs can show "(n)" before they are opened.
 * A count that could not be loaded stays undefined (the tab shows just its label).
 */
export const useTreatmentLinkCounts = (
  treatmentId?: number | null,
  enabled = true
): TreatmentLinkCounts => {
  const [counts, setCounts] = useState<TreatmentLinkCounts>({});

  useEffect(() => {
    setCounts({});
    if (!treatmentId || !enabled) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const load = async (
      key: keyof TreatmentLinkCounts,
      request: Promise<unknown>
    ) => {
      try {
        const count = countOf(await request);
        if (!signal.aborted && count !== undefined) {
          setCounts(prev => ({ ...prev, [key]: count }));
        }
      } catch (err) {
        // No count is shown for this tab
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('treatment_link_count_load_failed', {
          message: 'Failed to load a treatment link count',
          treatmentId,
          key,
          error: err instanceof Error ? err.message : String(err),
          component: 'useTreatmentLinkCounts',
        });
      }
    };
    load(
      'medications',
      apiService.getTreatmentMedications(treatmentId, signal)
    );
    load('encounters', apiService.getTreatmentEncounters(treatmentId, signal));
    load('labResults', apiService.getTreatmentLabResults(treatmentId, signal));
    load('equipment', apiService.getTreatmentEquipment(treatmentId, signal));
    return () => controller.abort();
  }, [treatmentId, enabled]);

  return counts;
};
