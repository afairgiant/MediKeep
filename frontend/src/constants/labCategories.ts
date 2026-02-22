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
  other: 'gray',
};

/**
 * Get the human-readable display name for a category.
 * Falls back to title-casing the raw category string if unknown.
 */
export function getCategoryDisplayName(category: string): string {
  return CATEGORY_DISPLAY_NAMES[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
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
  return QUALITATIVE_DISPLAY_NAMES[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

/** Get Mantine color for a qualitative value. */
export function getQualitativeColor(value: string): string {
  return QUALITATIVE_COLORS[value] ?? 'gray';
}

/** Options for qualitative value Select dropdowns. */
export const QUALITATIVE_SELECT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'detected', label: 'Detected' },
  { value: 'undetected', label: 'Undetected' },
];

export const CATEGORY_SELECT_OPTIONS: Array<{ value: string; label: string }> = [
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
  { value: 'other', label: 'Other Tests' },
];
