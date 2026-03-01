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
  label: string;
  route: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Entity config for tag search results (keyed by singular backend response keys). */
export const TAG_ENTITY_CONFIG: Record<string, EntityConfig> = {
  lab_result: { icon: IconFlask, color: 'indigo', label: 'Lab Results', route: '/lab-results' },
  medication: { icon: IconPill, color: 'green', label: 'Medications', route: '/medications' },
  condition: { icon: IconStethoscope, color: 'blue', label: 'Conditions', route: '/conditions' },
  procedure: { icon: IconMedicalCross, color: 'violet', label: 'Procedures', route: '/procedures' },
  immunization: { icon: IconVaccine, color: 'orange', label: 'Immunizations', route: '/immunizations' },
  treatment: { icon: IconHeartbeat, color: 'pink', label: 'Treatments', route: '/treatments' },
  encounter: { icon: IconCalendarEvent, color: 'teal', label: 'Encounters', route: '/encounters' },
  allergy: { icon: IconAlertTriangle, color: 'red', label: 'Allergies', route: '/allergies' },
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

/** Proper type labels for display (singular type key -> display label). */
export const TYPE_LABEL_MAP: Record<string, string> = {
  medication: 'Medications',
  condition: 'Conditions',
  lab_result: 'Lab Results',
  procedure: 'Procedures',
  immunization: 'Immunizations',
  treatment: 'Treatments',
  encounter: 'Visits',
  allergy: 'Allergies',
  vital: 'Vitals',
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getItemTitle(entityType: string, item: Record<string, unknown>): string {
  switch (entityType) {
    case 'lab_result': return (item.test_name as string) || 'Lab Result';
    case 'medication': return (item.medication_name as string) || 'Medication';
    case 'condition': return (item.condition_name as string) || (item.diagnosis as string) || 'Condition';
    case 'procedure': return (item.name as string) || (item.procedure_name as string) || 'Procedure';
    case 'immunization': return (item.vaccine_name as string) || 'Immunization';
    case 'treatment': return (item.treatment_name as string) || 'Treatment';
    case 'encounter': return (item.visit_type as string) || (item.encounter_type as string) || (item.reason as string) || 'Encounter';
    case 'allergy': return (item.allergen as string) || 'Allergy';
    default: return 'Record';
  }
}

export function getItemSubtitle(entityType: string, item: Record<string, unknown>): string {
  switch (entityType) {
    case 'lab_result': return item.result ? `Result: ${item.result}` : (item.status as string) || '';
    case 'medication': return [item.dosage, item.status].filter(Boolean).join(' - ');
    case 'condition': return [item.diagnosis, item.status].filter(Boolean).join(' - ');
    case 'procedure': return (item.description as string) || (item.status as string) || '';
    case 'immunization': return item.dose_number ? `Dose ${item.dose_number}` : '';
    case 'treatment': return [item.treatment_type, item.status].filter(Boolean).join(' - ');
    case 'encounter': return (item.reason as string) || (item.chief_complaint as string) || '';
    case 'allergy': return [item.severity, item.reaction].filter(Boolean).join(' - ');
    default: return (item.status as string) || '';
  }
}

/** Returns { label, value } for the most relevant date per record type. */
export function getItemDateWithLabel(
  entityType: string,
  item: Record<string, unknown>
): { label: string; value: string | undefined } {
  switch (entityType) {
    case 'lab_result': return { label: 'Tested', value: (item.test_date || item.created_at) as string | undefined };
    case 'medication': return { label: 'Started', value: (item.start_date || item.created_at) as string | undefined };
    case 'condition': return { label: 'Diagnosed', value: (item.diagnosed_date || item.created_at) as string | undefined };
    case 'procedure': return { label: 'Performed', value: (item.procedure_date || item.created_at) as string | undefined };
    case 'immunization': return { label: 'Given', value: (item.administered_date || item.created_at) as string | undefined };
    case 'treatment': return { label: 'Started', value: (item.start_date || item.created_at) as string | undefined };
    case 'encounter': return { label: 'Visited', value: (item.encounter_date || item.created_at) as string | undefined };
    case 'allergy': return { label: 'Identified', value: (item.identified_date || item.created_at) as string | undefined };
    case 'vital': return { label: 'Recorded', value: (item.recorded_date || item.created_at) as string | undefined };
    default: return { label: '', value: item.created_at as string | undefined };
  }
}

/**
 * Flatten tag search results (grouped by entity type) into the same flat format
 * as text search results, for unified display.
 */
export function flattenTagResults(
  tagResults: Record<string, unknown[]> | null
): SearchResultRow[] {
  if (!tagResults) return [];
  const flat: SearchResultRow[] = [];
  Object.entries(tagResults).forEach(([entityType, items]) => {
    const config = TAG_ENTITY_CONFIG[entityType];
    if (!config || !Array.isArray(items)) return;
    items.forEach((item: Record<string, unknown>) => {
      const dateInfo = getItemDateWithLabel(entityType, item);
      flat.push({
        type: entityType,
        id: item.id as number,
        title: getItemTitle(entityType, item),
        subtitle: getItemSubtitle(entityType, item),
        date: dateInfo.value,
        dateLabel: dateInfo.label,
        icon: config.icon,
        color: config.color,
        typeLabel: config.label,
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
