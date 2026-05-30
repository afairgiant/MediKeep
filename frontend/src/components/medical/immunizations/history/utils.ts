import type { ImmunizationHistoryItem } from './types';

/**
 * Group history items by disease using the response's pre-aggregated
 * diseases_index. Sort diseases alphabetically; items within a disease are
 * already sorted newest-first because the backend orders the items array.
 */
export function groupItemsByDisease(
  items: ImmunizationHistoryItem[],
  diseasesIndex: Record<string, number[]>
): Array<{ disease: string; items: ImmunizationHistoryItem[] }> {
  const byId = new Map(items.map(item => [item.id, item]));
  return Object.keys(diseasesIndex)
    .sort((a, b) => a.localeCompare(b))
    .map(disease => ({
      disease,
      items: diseasesIndex[disease]
        .map(id => byId.get(id))
        .filter((item): item is ImmunizationHistoryItem => item !== undefined),
    }));
}

/**
 * Return the dose number if set, otherwise null.
 * Callers should wrap with `t('medical:immunizations.history.doseLabel', 'Dose {{n}}', { n })`
 * for the display label.
 */
export function getDoseNumber(item: ImmunizationHistoryItem): number | null {
  return item.dose_number ?? null;
}
