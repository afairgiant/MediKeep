import type { TablerIcon } from '@tabler/icons-react';

import type { InlineCreateType } from '../contexts/InlineCreateContext';

export type EncounterLinkTypeKey =
  | 'procedures'
  | 'treatments'
  | 'injuries'
  | 'symptoms'
  | 'conditions'
  | 'medications'
  | 'labResults';

/** Keys of shared:categories that name a linkable record type. */
export type CategoryKey =
  | 'procedures'
  | 'treatments'
  | 'injuries'
  | 'symptoms'
  | 'conditions'
  | 'medications'
  | 'lab_results';

/** One link, normalized from any per-type API response. */
export interface LinkRow {
  id: number;
  targetId: number;
  name: string;
  date: string | null;
  status: string | null;
  relevanceNote: string | null;
  purpose: string | null;
}

/** A record that can still be linked. */
export interface LinkCandidate {
  id: number;
  label: string;
}

/** A link chosen in the Add form that is saved after the visit is created. */
export interface PendingLink {
  entityId: number;
  relevanceNote: string | null;
  purpose: string | null;
}

export type PendingLinks = Partial<Record<EncounterLinkTypeKey, PendingLink[]>>;

export interface LinkUpdate {
  relevance_note?: string | null;
  purpose?: string | null;
}

export interface EncounterLinkTypeConfig {
  key: EncounterLinkTypeKey;
  /** URL segment under /encounters/{id}/ */
  apiPath: string;
  /** Key under shared:categories used as the section title */
  categoryKey: CategoryKey;
  /** Entity type understood by navigateToEntity */
  entityType: string;
  icon: TablerIcon;
  color: string;
  /** True when the link carries a purpose (lab results only) */
  supportsPurpose: boolean;
  /** Label shown for a record in the link list (also used for a newly created one) */
  candidateLabel: (_record: Record<string, unknown>) => string;
  /** Set when a new record of this type can be created from the link tab */
  createType?: InlineCreateType;
  fetchCandidates: (
    _patientId: number,
    _signal?: AbortSignal
  ) => Promise<LinkCandidate[]>;
  /** Normalize one visit-side API row */
  toRow: (_raw: Record<string, unknown>) => LinkRow;
  /** Body for the visit-side bulk create */
  bulkBody: (
    _ids: number[],
    _note: string | null,
    _purpose: string | null
  ) => Record<string, unknown>;
}

/**
 * Where a LinkedRecordsSection reads and writes its links. The visit tab builds
 * one per linked type; the record tabs build one for "visits".
 */
export interface LinkSource {
  loadRows: (_signal?: AbortSignal) => Promise<LinkRow[]>;
  fetchCandidates: (_signal?: AbortSignal) => Promise<LinkCandidate[]>;
  createLinks: (
    _ids: number[],
    _note: string | null,
    _purpose: string | null
  ) => Promise<void>;
  updateLink: (_row: LinkRow, _updates: LinkUpdate) => Promise<void>;
  removeLink: (_row: LinkRow) => Promise<void>;
}

/** Record types whose own forms link to visits through the generic routes. */
export type RecordLinkKey =
  | 'procedures'
  | 'injuries'
  | 'symptoms'
  | 'conditions'
  | 'medications';

/** Records with a Visits card: the generic ones plus lab results (own routes, with purpose). */
export type RecordTabType = RecordLinkKey | 'labResults';
