import { apiService } from '../services/api';
import {
  linkCountKey,
  useLinkCounts,
  useLoadLinkCounts,
  type LinkCountState,
} from '../utils/linkCountStore';

export type TreatmentLinkKind =
  | 'medications'
  | 'encounters'
  | 'labResults'
  | 'equipment';

const TREATMENT_LINK_KINDS: TreatmentLinkKind[] = [
  'medications',
  'encounters',
  'labResults',
  'equipment',
];

const LIST_LINKS: Record<
  TreatmentLinkKind,
  (_treatmentId: number, _signal: AbortSignal) => Promise<unknown>
> = {
  medications: (id, signal) => apiService.getTreatmentMedications(id, signal),
  encounters: (id, signal) => apiService.getTreatmentEncounters(id, signal),
  labResults: (id, signal) => apiService.getTreatmentLabResults(id, signal),
  equipment: (id, signal) => apiService.getTreatmentEquipment(id, signal),
};

/** Key of a treatment's count of one kind of link, shared with the panel that changes it. */
export const treatmentLinkCountKey = (
  treatmentId: number | null | undefined,
  kind: TreatmentLinkKind
) => linkCountKey('treatment', treatmentId, kind);

/**
 * How many medications, visits, lab results and equipment items a saved treatment is
 * linked to, loaded up front so the tabs can show "(n)" before they are opened. The
 * panels keep the counts current, and each is `loading` until it arrives. A count that
 * could not be loaded stays unknown (the tab shows just its label).
 */
export const useTreatmentLinkCounts = (
  treatmentId?: number | null,
  enabled = true
): Record<TreatmentLinkKind, LinkCountState> => {
  const active = Boolean(treatmentId) && enabled;
  const keys = TREATMENT_LINK_KINDS.map(kind =>
    treatmentLinkCountKey(treatmentId, kind)
  );

  useLoadLinkCounts(
    TREATMENT_LINK_KINDS.map((kind, index) => ({
      key: keys[index],
      load: async signal => {
        const rows = await LIST_LINKS[kind](treatmentId as number, signal);
        if (!Array.isArray(rows)) throw new Error('Unexpected response');
        return rows.length;
      },
    })),
    active
  );

  const states = useLinkCounts(keys, active);
  return Object.fromEntries(
    TREATMENT_LINK_KINDS.map((kind, index) => [kind, states[index]])
  ) as Record<TreatmentLinkKind, LinkCountState>;
};
