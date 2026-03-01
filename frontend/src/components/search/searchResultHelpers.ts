/**
 * searchResultHelpers
 * Shared constants, types, and utility functions used by SearchResults,
 * SearchResultCard, SearchPreviewPanel, and SearchResultsHeader.
 */

import React from 'react';
import {
  IconAlertTriangle,
  IconStethoscope,
  IconPill,
  IconVaccine,
  IconMedicalCross,
  IconHeartbeat,
  IconCalendarEvent,
  IconFlask,
  IconSearch,
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Translation function type accepted by helper functions. */
export type TFunc = (key: string, defaultValueOrOptions?: string | Record<string, unknown>) => string;

export interface SearchResultRow {
  type: string;
  id: number;
  title: string;
  subtitle?: string;
  date?: string;
  dateLabel?: string;
  icon: React.ComponentType<{ size?: string | number }>;
  color: string;
  typeLabel: string;
  tags: string[];
  route: string;
  _source?: string;
}

interface EntityConfig {
  icon: React.ComponentType<{ size?: string | number }>;
  color: string;
  labelKey: string;
  route: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Entity config for tag search results (keyed by singular backend response keys). */
export const TAG_ENTITY_CONFIG: Record<string, EntityConfig> = {
  lab_result: { icon: IconFlask, color: 'indigo', labelKey: 'search.types.labResults', route: '/lab-results' },
  medication: { icon: IconPill, color: 'green', labelKey: 'search.types.medications', route: '/medications' },
  condition: { icon: IconStethoscope, color: 'blue', labelKey: 'search.types.conditions', route: '/conditions' },
  procedure: { icon: IconMedicalCross, color: 'violet', labelKey: 'search.types.procedures', route: '/procedures' },
  immunization: { icon: IconVaccine, color: 'orange', labelKey: 'search.types.immunizations', route: '/immunizations' },
  treatment: { icon: IconHeartbeat, color: 'pink', labelKey: 'search.types.treatments', route: '/treatments' },
  encounter: { icon: IconCalendarEvent, color: 'teal', labelKey: 'search.types.encounters', route: '/encounters' },
  allergy: { icon: IconAlertTriangle, color: 'red', labelKey: 'search.types.allergies', route: '/allergies' },
};

/** Map sidebar record type values (plural) to tag entity keys (singular). */
export const RECORD_TYPE_TO_TAG_ENTITY: Record<string, string> = {
  lab_results: 'lab_result',
  medications: 'medication',
  conditions: 'condition',
  procedures: 'procedure',
  immunizations: 'immunization',
  treatments: 'treatment',
  encounters: 'encounter',
  allergies: 'allergy',
  // vitals omitted — no tag support
};

/** Icon mapping for text search result icon strings from backend. */
export const ICON_MAP: Record<string, React.ComponentType<{ size?: string | number }>> = {
  IconAlertTriangle,
  IconStethoscope,
  IconPill,
  IconVaccine,
  IconMedicalCross,
  IconHeartbeat,
  IconCalendarEvent,
  IconFlask,
};

/** Fallback icon when the backend icon name is unknown. */
export const FALLBACK_ICON = IconSearch;

/** Mapping from singular type key to i18n translation key. */
export const TYPE_LABEL_KEY_MAP: Record<string, string> = {
  medication: 'search.types.medications',
  condition: 'search.types.conditions',
  lab_result: 'search.types.labResults',
  procedure: 'search.types.procedures',
  immunization: 'search.types.immunizations',
  treatment: 'search.types.treatments',
  encounter: 'search.types.encounters',
  allergy: 'search.types.allergies',
  vital: 'search.types.vitals',
};

/** Resolve a type key to a translated label. */
export function getTypeLabel(t: TFunc, typeKey: string): string {
  const translationKey = TYPE_LABEL_KEY_MAP[typeKey];
  if (translationKey) return t(translationKey);
  return typeKey.replace('_', ' ');
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getItemTitle(entityType: string, item: Record<string, unknown>, t: TFunc): string {
  switch (entityType) {
    case 'lab_result': return (item.test_name as string) || t('search.fallbacks.labResult');
    case 'medication': return (item.medication_name as string) || t('search.fallbacks.medication');
    case 'condition': return (item.condition_name as string) || (item.diagnosis as string) || t('search.fallbacks.condition');
    case 'procedure': return (item.name as string) || (item.procedure_name as string) || t('search.fallbacks.procedure');
    case 'immunization': return (item.vaccine_name as string) || t('search.fallbacks.immunization');
    case 'treatment': return (item.treatment_name as string) || t('search.fallbacks.treatment');
    case 'encounter': return (item.visit_type as string) || (item.encounter_type as string) || (item.reason as string) || t('search.fallbacks.encounter');
    case 'allergy': return (item.allergen as string) || t('search.fallbacks.allergy');
    default: return t('search.fallbacks.record');
  }
}

export function getItemSubtitle(entityType: string, item: Record<string, unknown>, t: TFunc): string {
  switch (entityType) {
    case 'lab_result': return item.result ? t('search.subtitles.result', { value: item.result }) : (item.status as string) || '';
    case 'medication': return [item.dosage, item.status].filter(Boolean).join(' - ');
    case 'condition': return [item.diagnosis, item.status].filter(Boolean).join(' - ');
    case 'procedure': return (item.description as string) || (item.status as string) || '';
    case 'immunization': return item.dose_number ? t('search.subtitles.dose', { number: item.dose_number }) : '';
    case 'treatment': return [item.treatment_type, item.status].filter(Boolean).join(' - ');
    case 'encounter': return (item.reason as string) || (item.chief_complaint as string) || '';
    case 'allergy': return [item.severity, item.reaction].filter(Boolean).join(' - ');
    default: return (item.status as string) || '';
  }
}

/** Returns { label, value } for the most relevant date per record type. */
export function getItemDateWithLabel(
  entityType: string,
  item: Record<string, unknown>,
  t: TFunc
): { label: string; value: string | undefined } {
  switch (entityType) {
    case 'lab_result': return { label: t('search.dateLabels.tested'), value: (item.test_date || item.created_at) as string | undefined };
    case 'medication': return { label: t('search.dateLabels.started'), value: (item.start_date || item.created_at) as string | undefined };
    case 'condition': return { label: t('search.dateLabels.diagnosed'), value: (item.diagnosed_date || item.created_at) as string | undefined };
    case 'procedure': return { label: t('search.dateLabels.performed'), value: (item.procedure_date || item.created_at) as string | undefined };
    case 'immunization': return { label: t('search.dateLabels.given'), value: (item.administered_date || item.created_at) as string | undefined };
    case 'treatment': return { label: t('search.dateLabels.started'), value: (item.start_date || item.created_at) as string | undefined };
    case 'encounter': return { label: t('search.dateLabels.visited'), value: (item.encounter_date || item.created_at) as string | undefined };
    case 'allergy': return { label: t('search.dateLabels.identified'), value: (item.identified_date || item.created_at) as string | undefined };
    case 'vital': return { label: t('search.dateLabels.recorded'), value: (item.recorded_date || item.created_at) as string | undefined };
    default: return { label: '', value: item.created_at as string | undefined };
  }
}

/**
 * Flatten tag search results (grouped by entity type) into the same flat format
 * as text search results, for unified display.
 */
export function flattenTagResults(
  tagResults: Record<string, unknown[]> | null,
  t: TFunc
): SearchResultRow[] {
  if (!tagResults) return [];
  const flat: SearchResultRow[] = [];
  Object.entries(tagResults).forEach(([entityType, items]) => {
    const config = TAG_ENTITY_CONFIG[entityType];
    if (!config || !Array.isArray(items)) return;
    items.forEach((item: Record<string, unknown>) => {
      const dateInfo = getItemDateWithLabel(entityType, item, t);
      flat.push({
        type: entityType,
        id: item.id as number,
        title: getItemTitle(entityType, item, t),
        subtitle: getItemSubtitle(entityType, item, t),
        date: dateInfo.value,
        dateLabel: dateInfo.label,
        icon: config.icon,
        color: config.color,
        typeLabel: t(config.labelKey),
        tags: (item.tags as string[]) || [],
        route: `${config.route}?view=${item.id}`,
        _source: 'tag',
      });
    });
  });
  return flat;
}

/** Convert a Date to YYYY-MM-DD for the API, or return null. */
export function toISODateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
