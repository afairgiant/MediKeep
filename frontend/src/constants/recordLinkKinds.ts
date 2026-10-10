import {
  IconFlask,
  IconPill,
  IconStethoscope,
  type TablerIcon,
} from '@tabler/icons-react';

import { apiService } from '../services/api';

/** Records whose dialogs show linked-record tabs (see RecordLinkTabButtons). */
export type RecordLinkPath =
  | 'conditions'
  | 'medications'
  | 'procedures'
  | 'injuries'
  | 'symptoms';

/** The kinds of record a record's dialog links to. */
export type RecordLinkKind =
  | 'visits'
  | 'labResults'
  | 'medications'
  | 'conditions';

/** Which link kinds each record has, in tab order. */
export const RECORD_LINK_KINDS: Record<RecordLinkPath, RecordLinkKind[]> = {
  conditions: ['medications', 'labResults', 'visits'],
  medications: ['conditions', 'labResults', 'visits'],
  procedures: ['visits', 'labResults'],
  injuries: ['visits'],
  symptoms: ['visits'],
};

export interface RecordLinkKindConfig {
  icon: TablerIcon;
  /** Translation key of the tab and card title */
  labelKey:
    | 'shared:tabs.visits'
    | 'shared:tabs.labResults'
    | 'shared:categories.medications'
    | 'shared:categories.conditions';
  /** Shown when the translation is missing */
  defaultLabel?: string;
  /** The links the record has of this kind (only their number is used for the tab) */
  list: (
    _path: RecordLinkPath,
    _recordId: number,
    _signal: AbortSignal
  ) => Promise<unknown>;
}

export const RECORD_LINK_KIND_CONFIG: Record<
  RecordLinkKind,
  RecordLinkKindConfig
> = {
  visits: {
    icon: IconStethoscope,
    labelKey: 'shared:tabs.visits',
    defaultLabel: 'Visits',
    list: (path, id, signal) =>
      apiService.getRecordEncounterLinks(path, id, signal),
  },
  labResults: {
    icon: IconFlask,
    labelKey: 'shared:tabs.labResults',
    list: (path, id, signal) =>
      apiService.getRecordLabResultLinks(path, id, signal),
  },
  // A condition's medications and a medication's conditions are the same links
  medications: {
    icon: IconPill,
    labelKey: 'shared:categories.medications',
    list: (_path, id, signal) =>
      apiService.getConditionMedicationLinks(id, signal),
  },
  conditions: {
    icon: IconStethoscope,
    labelKey: 'shared:categories.conditions',
    list: (_path, id, signal) => apiService.getMedicationConditions(id, signal),
  },
};
