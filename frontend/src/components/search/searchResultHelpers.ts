/** Display text and rows for Advanced Search and dashboard quick search results. */

import React from 'react';
import { IconSearch } from '@tabler/icons-react';

import { getDonationTypeLabel } from '../../constants/bloodDonationConstants';
import { notesToPlainText } from '../../utils/notesMarkdown';
import {
  RECORD_TYPE_BY_ITEM_TYPE,
  getRecordRoute,
} from '../../constants/searchRecordTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Translation function type accepted by helper functions. */
export type TFunc = (
  _key: string,
  _defaultValueOrOptions?: string | Record<string, unknown>
) => string;

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

interface SearchItemText {
  title: string;
  subtitle: string;
  date: string | undefined;
  dateLabel: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Icon for a record type the registry does not know. */
export const FALLBACK_ICON = IconSearch;

/** Resolve an item type to its translated record type label. */
export function getTypeLabel(t: TFunc, typeKey: string): string {
  const recordType = RECORD_TYPE_BY_ITEM_TYPE[typeKey];
  if (recordType) return t(recordType.labelKey);
  return typeKey.replace('_', ' ');
}

export function getTypeIcon(
  typeKey: string
): React.ComponentType<{ size?: string | number }> {
  return RECORD_TYPE_BY_ITEM_TYPE[typeKey]?.icon || FALLBACK_ICON;
}

export function getTypeColor(typeKey: string): string {
  return RECORD_TYPE_BY_ITEM_TYPE[typeKey]?.color || 'gray';
}

function formatVitalSigns(item: Record<string, unknown>): string {
  const signs: string[] = [];
  if (item.systolic_bp && item.diastolic_bp) {
    signs.push(`BP: ${item.systolic_bp}/${item.diastolic_bp}`);
  }
  if (item.heart_rate) signs.push(`HR: ${item.heart_rate}`);
  if (item.temperature) signs.push(`Temp: ${item.temperature}°F`);
  if (item.weight) signs.push(`Weight: ${item.weight} lbs`);
  return signs.join(', ');
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getItemTitle(
  entityType: string,
  item: Record<string, unknown>,
  t: TFunc
): string {
  switch (entityType) {
    case 'lab_result':
      return (item.test_name as string) || t('shared:labels.labResult');
    case 'medication':
      return (
        (item.medication_name as string) || t('search.fallbacks.medication')
      );
    case 'condition':
      return (
        (item.condition_name as string) ||
        (item.diagnosis as string) ||
        t('shared:labels.condition')
      );
    case 'procedure':
      return (
        (item.name as string) ||
        (item.procedure_name as string) ||
        t('search.fallbacks.procedure')
      );
    case 'immunization':
      return (
        (item.vaccine_name as string) || t('search.fallbacks.immunization')
      );
    case 'treatment':
      return (item.treatment_name as string) || t('shared:labels.treatment');
    case 'encounter':
      return (
        (item.visit_type as string) ||
        (item.encounter_type as string) ||
        (item.reason as string) ||
        t('search.fallbacks.encounter')
      );
    case 'allergy':
      return (item.allergen as string) || t('search.fallbacks.allergy');
    case 'injury':
      return (item.injury_name as string) || t('search.fallbacks.injury');
    case 'symptom':
      return (item.symptom_name as string) || t('search.fallbacks.symptom');
    case 'medical_equipment':
      return (item.equipment_name as string) || t('search.fallbacks.equipment');
    case 'blood_donation':
      return (
        getDonationTypeLabel(item.donation_type as string, t) ||
        t('search.fallbacks.donation')
      );
    case 'vital':
      return formatVitalSigns(item) || t('shared:categories.vitals');
    default:
      return t('search.fallbacks.record');
  }
}

export function getItemSubtitle(
  entityType: string,
  item: Record<string, unknown>,
  t: TFunc
): string {
  switch (entityType) {
    case 'lab_result':
      return item.result
        ? t('search.subtitles.result', { value: item.result })
        : (item.status as string) || '';
    case 'medication':
      return [item.dosage, item.status].filter(Boolean).join(' - ');
    case 'condition':
      return [item.diagnosis, item.status].filter(Boolean).join(' - ');
    case 'procedure':
      return (item.description as string) || (item.status as string) || '';
    case 'immunization':
      return item.dose_number
        ? t('shared:labels.doseNumber', { number: item.dose_number })
        : '';
    case 'treatment':
      return [item.treatment_type, item.status].filter(Boolean).join(' - ');
    case 'encounter':
      return (item.reason as string) || (item.chief_complaint as string) || '';
    case 'allergy':
      return [item.severity, item.reaction].filter(Boolean).join(' - ');
    case 'injury':
      return [item.body_part, item.status].filter(Boolean).join(' - ');
    case 'symptom':
      return [item.category, item.status].filter(Boolean).join(' - ');
    case 'medical_equipment':
      return [item.equipment_type, item.status].filter(Boolean).join(' - ');
    case 'blood_donation':
      return (item.location as string) || '';
    default:
      return (item.status as string) || '';
  }
}

/** Returns { label, value } for the most relevant date per record type. */
export function getItemDateWithLabel(
  entityType: string,
  item: Record<string, unknown>,
  t: TFunc
): { label: string; value: string | undefined } {
  switch (entityType) {
    case 'lab_result':
      return {
        label: t('search.dateLabels.tested'),
        value: (item.test_date || item.created_at) as string | undefined,
      };
    case 'medication':
      return {
        label: t('search.dateLabels.started'),
        value: (item.start_date || item.created_at) as string | undefined,
      };
    case 'condition':
      return {
        label: t('search.dateLabels.diagnosed'),
        value: (item.diagnosed_date || item.created_at) as string | undefined,
      };
    case 'procedure':
      return {
        label: t('search.dateLabels.performed'),
        value: (item.procedure_date || item.created_at) as string | undefined,
      };
    case 'immunization':
      return {
        label: t('search.dateLabels.given'),
        value: (item.administered_date || item.created_at) as
          | string
          | undefined,
      };
    case 'treatment':
      return {
        label: t('search.dateLabels.started'),
        value: (item.start_date || item.created_at) as string | undefined,
      };
    case 'encounter':
      return {
        label: t('search.dateLabels.visited'),
        value: (item.encounter_date || item.created_at) as string | undefined,
      };
    case 'allergy':
      return {
        label: t('search.dateLabels.identified'),
        value: (item.identified_date || item.created_at) as string | undefined,
      };
    case 'injury':
      return {
        label: t('search.dateLabels.injured'),
        value: item.date_of_injury as string | undefined,
      };
    case 'symptom':
      return {
        label: t('search.dateLabels.started'),
        value: item.first_occurrence_date as string | undefined,
      };
    case 'medical_equipment':
      return {
        label: t('search.dateLabels.prescribed'),
        value: item.prescribed_date as string | undefined,
      };
    case 'blood_donation':
      return {
        label: t('search.dateLabels.donated'),
        value: item.donation_date as string | undefined,
      };
    case 'vital':
      return {
        label: t('search.dateLabels.recorded'),
        value: (item.recorded_date || item.created_at) as string | undefined,
      };
    default:
      return { label: '', value: item.created_at as string | undefined };
  }
}

/**
 * Display text for one search item, translated with `t`. Works on both text
 * search items and tag search rows; notes Markdown comes back as plain text.
 */
export function describeSearchItem(
  itemType: string,
  item: Record<string, unknown>,
  t: TFunc
): SearchItemText {
  const { label, value } = getItemDateWithLabel(itemType, item, t);
  return {
    title: getItemTitle(itemType, item, t),
    subtitle: notesToPlainText(getItemSubtitle(itemType, item, t)),
    date: value || undefined,
    dateLabel: label,
  };
}

/** The item's description as plain text, or '' when it repeats `subtitle`. */
export function getItemDescription(
  item: Record<string, unknown>,
  subtitle: string
): string {
  if (typeof item.description !== 'string') return '';
  const description = notesToPlainText(item.description);
  return description === subtitle ? '' : description;
}

export function toSearchRow(
  itemType: string,
  item: Record<string, unknown>,
  t: TFunc,
  source: 'text' | 'tag'
): SearchResultRow {
  return {
    ...describeSearchItem(itemType, item, t),
    type: itemType,
    id: item.id as number,
    icon: getTypeIcon(itemType),
    color: getTypeColor(itemType),
    typeLabel: getTypeLabel(t, itemType),
    tags: (item.tags as string[]) || [],
    route: getRecordRoute(itemType, item.id as number),
    _source: source,
  };
}

/** Flatten tag search results (grouped by entity type) into display rows. */
export function flattenTagResults(
  tagResults: Record<string, unknown[]> | null,
  t: TFunc
): SearchResultRow[] {
  if (!tagResults) return [];
  return Object.entries(tagResults).flatMap(([entityType, items]) =>
    RECORD_TYPE_BY_ITEM_TYPE[entityType]?.taggable && Array.isArray(items)
      ? items.map(item =>
          toSearchRow(entityType, item as Record<string, unknown>, t, 'tag')
        )
      : []
  );
}

/** Convert a Date to YYYY-MM-DD for the API, or return null. */
export function toISODateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
