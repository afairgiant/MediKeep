/**
 * Constants for symptom filtering types
 * Used to prevent typos and maintain consistency across symptom filtering
 */

export const SYMPTOM_FILTER_TYPES = {
  ALL: 'all',
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  RECURRING: 'recurring',
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  CRITICAL: 'critical',
};

export const SYMPTOM_FILTER_LABELS = {
  [SYMPTOM_FILTER_TYPES.ALL]: 'All Symptoms',
  [SYMPTOM_FILTER_TYPES.ACTIVE]: 'Active Only',
  [SYMPTOM_FILTER_TYPES.RESOLVED]: 'Resolved Only',
  [SYMPTOM_FILTER_TYPES.RECURRING]: 'Recurring Only',
  [SYMPTOM_FILTER_TYPES.MILD]: 'Mild Severity',
  [SYMPTOM_FILTER_TYPES.MODERATE]: 'Moderate Severity',
  [SYMPTOM_FILTER_TYPES.SEVERE]: 'Severe',
  [SYMPTOM_FILTER_TYPES.CRITICAL]: 'Critical',
};

/**
 * Date range filter presets
 */
export const SYMPTOM_DATE_RANGES = {
  LAST_WEEK: 'last_week',
  LAST_MONTH: 'last_month',
  LAST_3_MONTHS: 'last_3_months',
  LAST_6_MONTHS: 'last_6_months',
  LAST_YEAR: 'last_year',
  ALL_TIME: 'all_time',
  CUSTOM: 'custom',
};

export const SYMPTOM_DATE_RANGE_LABELS = {
  [SYMPTOM_DATE_RANGES.LAST_WEEK]: 'Last Week',
  [SYMPTOM_DATE_RANGES.LAST_MONTH]: 'Last Month',
  [SYMPTOM_DATE_RANGES.LAST_3_MONTHS]: 'Last 3 Months',
  [SYMPTOM_DATE_RANGES.LAST_6_MONTHS]: 'Last 6 Months',
  [SYMPTOM_DATE_RANGES.LAST_YEAR]: 'Last Year',
  [SYMPTOM_DATE_RANGES.ALL_TIME]: 'All Time',
  [SYMPTOM_DATE_RANGES.CUSTOM]: 'Custom Range',
};
