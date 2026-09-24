/**
 * Shared constants for lab test component categories.
 *
 * Centralizes category display names, colors, and Select options
 * so they are defined once and reused across all lab result components.
 */

import { TestCategory } from './testLibraryTypes';

/**
 * All valid component categories.
 * Identical to TestCategory now that 'cardiology' has been added there.
 * Kept as a named alias for semantic clarity in lab component code.
 */
export type ComponentCategory = TestCategory;

/** All valid component status values. */
export type ComponentStatus =
  | 'normal'
  | 'high'
  | 'low'
  | 'critical'
  | 'abnormal'
  | 'borderline';

/** Human-readable display name for each category. */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  chemistry: 'Chemistry - Electrolytes & Minerals',
  hematology: 'Hematology - Blood Counts & Iron',
  hepatology: 'Hepatology - Liver Enzymes & Function',
  immunology: 'Immunology - Immune System & Antibodies',
  microbiology: 'Microbiology - Infections & Cultures',
  endocrinology: 'Endocrinology - Hormones & Diabetes',
  cardiology: 'Cardiology - Heart & Cardiac Markers',
  toxicology: 'Toxicology - Drug & Toxin Screening',
  genetics: 'Genetics - Genetic Testing',
  molecular: 'Molecular - DNA Tests',
  pathology: 'Pathology - Tissue & Biopsy Analysis',
  lipids: 'Lipids - Cholesterol & Triglycerides',
  hearing: 'Hearing - Audiometry & Vestibular Tests',
  stomatology: 'Stomatology - Salivary & Oral Diagnostics',
  imaging: 'Imaging - Radiology & Scans',
  other: 'Other Tests',
};

/** Mantine color token for each category. */
const CATEGORY_COLORS: Record<string, string> = {
  chemistry: 'blue',
  hematology: 'red',
  hepatology: 'lime',
  immunology: 'green',
  microbiology: 'yellow',
  endocrinology: 'purple',
  cardiology: 'grape',
  toxicology: 'orange',
  genetics: 'teal',
  molecular: 'cyan',
  pathology: 'pink',
  lipids: 'indigo',
  hearing: 'violet',
  stomatology: 'dark',
  imaging: 'blue',
  other: 'gray',
};

/**
 * Get the human-readable display name for a category.
 * Falls back to title-casing the raw category string if unknown.
 */
export function getCategoryDisplayName(category: string): string {
  return (
    CATEGORY_DISPLAY_NAMES[category] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  );
}

/**
 * Get the Mantine color token for a category.
 * Falls back to 'gray' if the category is unknown.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'gray';
}

/** Display names for qualitative result values. */
const QUALITATIVE_DISPLAY_NAMES: Record<string, string> = {
  positive: 'Positive',
  negative: 'Negative',
  detected: 'Detected',
  undetected: 'Undetected',
};

/** Mantine color token for each qualitative value. */
const QUALITATIVE_COLORS: Record<string, string> = {
  positive: 'red',
  negative: 'green',
  detected: 'orange',
  undetected: 'green',
};

/** Get display name for a qualitative value. */
export function getQualitativeDisplayName(value: string): string {
  return (
    QUALITATIVE_DISPLAY_NAMES[value] ??
    value.charAt(0).toUpperCase() + value.slice(1)
  );
}

/** Get Mantine color for a qualitative value. */
export function getQualitativeColor(value: string): string {
  return QUALITATIVE_COLORS[value] ?? 'gray';
}

/**
 * Canonical severity order for a lab result's normal/abnormal/... status
 * (ComponentStatus), least to most concerning - the order requested for the
 * status_only trend table's sort (#1025 follow-up). Shared here so the trend
 * chart's Y-axis tiers, the table's sort, and every status color use the same
 * one ranking instead of each screen inventing its own that can drift out of
 * sync with the others. "borderline" sits between normal and abnormal (not
 * part of the original request; placed at its closest neighbor). Any value
 * outside this known set (e.g. "inconclusive", which only ever appears on
 * legacy results copied from LabResult.labs_result) sorts after all of these.
 */
export const STATUS_SEVERITY_ORDER: ComponentStatus[] = [
  'low',
  'normal',
  'borderline',
  'abnormal',
  'high',
  'critical',
];

/** Rank of a status for sorting, ascending = least to most concerning.
 * Unknown/missing statuses sort last. */
export function statusSeverityRank(status: string | null | undefined): number {
  if (!status) return Number.MAX_SAFE_INTEGER;
  const idx = STATUS_SEVERITY_ORDER.indexOf(status.toLowerCase() as ComponentStatus);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/** Mantine color token for a lab result status, e.g. for a Badge. */
const STATUS_BADGE_COLORS: Record<string, string> = {
  low: 'orange',
  normal: 'green',
  borderline: 'yellow',
  abnormal: 'yellow',
  high: 'orange',
  critical: 'red',
};

export function getStatusBadgeColor(status: string | null | undefined): string {
  if (!status) return 'gray';
  return STATUS_BADGE_COLORS[status.toLowerCase()] ?? 'gray';
}

/** Hex fill for recharts dots/cells, keyed by the same status vocabulary. */
const STATUS_CHART_COLORS: Record<string, string> = {
  low: '#e8590c',
  normal: '#2f9e44',
  borderline: '#f08c00',
  abnormal: '#e67700',
  high: '#e8590c',
  critical: '#e03131',
};

export function getStatusChartColor(status: string | null | undefined): string {
  if (!status) return '#868e96';
  return STATUS_CHART_COLORS[status.toLowerCase()] ?? '#868e96';
}

/** Options for qualitative value Select dropdowns. */
export const QUALITATIVE_SELECT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'detected', label: 'Detected' },
  { value: 'undetected', label: 'Undetected' },
];

export const CATEGORY_SELECT_OPTIONS: Array<{ value: string; label: string }> =
  [
    { value: 'chemistry', label: 'Blood Chemistry & Metabolic' },
    { value: 'hematology', label: 'Blood Counts & Cells' },
    { value: 'hepatology', label: 'Liver Enzymes & Function' },
    { value: 'lipids', label: 'Cholesterol & Lipids' },
    { value: 'endocrinology', label: 'Hormones & Thyroid' },
    { value: 'cardiology', label: 'Heart & Cardiac Markers' },
    { value: 'immunology', label: 'Immune System & Antibodies' },
    { value: 'microbiology', label: 'Infections & Cultures' },
    { value: 'toxicology', label: 'Drug & Toxin Screening' },
    { value: 'genetics', label: 'Genetic Testing' },
    { value: 'molecular', label: 'Molecular & DNA Tests' },
    { value: 'pathology', label: 'Tissue & Biopsy Analysis' },
    { value: 'hearing', label: 'Hearing & Vestibular Tests' },
    { value: 'stomatology', label: 'Salivary & Oral Diagnostics' },
    { value: 'imaging', label: 'Imaging & Radiology' },
    { value: 'other', label: 'Other Tests' },
  ];
