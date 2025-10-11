/**
 * Symptom severity levels
 * MUST match backend SymptomSeverity enum exactly
 */
export const SYMPTOM_SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  CRITICAL: 'critical',
};

/**
 * Symptom status values
 * MUST match backend SymptomStatus enum exactly
 */
export const SYMPTOM_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  RECURRING: 'recurring',
};

/**
 * Display labels for symptom severity
 */
export const SYMPTOM_SEVERITY_LABELS = {
  [SYMPTOM_SEVERITY.MILD]: 'Mild',
  [SYMPTOM_SEVERITY.MODERATE]: 'Moderate',
  [SYMPTOM_SEVERITY.SEVERE]: 'Severe',
  [SYMPTOM_SEVERITY.CRITICAL]: 'Critical',
};

/**
 * Display labels for symptom status
 */
export const SYMPTOM_STATUS_LABELS = {
  [SYMPTOM_STATUS.ACTIVE]: 'Active',
  [SYMPTOM_STATUS.RESOLVED]: 'Resolved',
  [SYMPTOM_STATUS.RECURRING]: 'Recurring',
};

/**
 * Color mapping for symptom severity badges
 */
export const SYMPTOM_SEVERITY_COLORS = {
  [SYMPTOM_SEVERITY.MILD]: 'green',
  [SYMPTOM_SEVERITY.MODERATE]: 'yellow',
  [SYMPTOM_SEVERITY.SEVERE]: 'orange',
  [SYMPTOM_SEVERITY.CRITICAL]: 'red',
};

/**
 * Color mapping for symptom status badges
 */
export const SYMPTOM_STATUS_COLORS = {
  [SYMPTOM_STATUS.ACTIVE]: 'blue',
  [SYMPTOM_STATUS.RESOLVED]: 'gray',
  [SYMPTOM_STATUS.RECURRING]: 'violet',
};

/**
 * Get all severity values as array for select options
 */
export const getSeverityOptions = () => {
  return Object.values(SYMPTOM_SEVERITY).map((value) => ({
    value,
    label: SYMPTOM_SEVERITY_LABELS[value],
  }));
};

/**
 * Get all status values as array for select options
 */
export const getStatusOptions = () => {
  return Object.values(SYMPTOM_STATUS).map((value) => ({
    value,
    label: SYMPTOM_STATUS_LABELS[value],
  }));
};

/**
 * Time of day values for symptom occurrences
 * MUST match backend validation
 */
export const TIME_OF_DAY = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
};

/**
 * Display labels for time of day
 */
export const TIME_OF_DAY_LABELS = {
  [TIME_OF_DAY.MORNING]: 'Morning',
  [TIME_OF_DAY.AFTERNOON]: 'Afternoon',
  [TIME_OF_DAY.EVENING]: 'Evening',
  [TIME_OF_DAY.NIGHT]: 'Night',
};

/**
 * Impact level values for symptom occurrences
 * MUST match backend validation
 */
export const IMPACT_LEVEL = {
  NO_IMPACT: 'no_impact',
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  DEBILITATING: 'debilitating',
};

/**
 * Display labels for impact level
 */
export const IMPACT_LEVEL_LABELS = {
  [IMPACT_LEVEL.NO_IMPACT]: 'No Impact',
  [IMPACT_LEVEL.MILD]: 'Mild Impact',
  [IMPACT_LEVEL.MODERATE]: 'Moderate Impact',
  [IMPACT_LEVEL.SEVERE]: 'Severe Impact',
  [IMPACT_LEVEL.DEBILITATING]: 'Debilitating',
};

/**
 * Color mapping for impact level badges
 */
export const IMPACT_LEVEL_COLORS = {
  [IMPACT_LEVEL.NO_IMPACT]: 'gray',
  [IMPACT_LEVEL.MILD]: 'green',
  [IMPACT_LEVEL.MODERATE]: 'yellow',
  [IMPACT_LEVEL.SEVERE]: 'orange',
  [IMPACT_LEVEL.DEBILITATING]: 'red',
};

/**
 * Get all time of day values as array for select options
 */
export const getTimeOfDayOptions = () => {
  return Object.values(TIME_OF_DAY).map((value) => ({
    value,
    label: TIME_OF_DAY_LABELS[value],
  }));
};

/**
 * Get all impact level values as array for select options
 */
export const getImpactLevelOptions = () => {
  return Object.values(IMPACT_LEVEL).map((value) => ({
    value,
    label: IMPACT_LEVEL_LABELS[value],
  }));
};

/**
 * Severity order for comparison (higher number = more severe)
 * Used for determining maximum severity across multiple occurrences
 */
export const SYMPTOM_SEVERITY_ORDER = {
  [SYMPTOM_SEVERITY.MILD]: 1,
  [SYMPTOM_SEVERITY.MODERATE]: 2,
  [SYMPTOM_SEVERITY.SEVERE]: 3,
  [SYMPTOM_SEVERITY.CRITICAL]: 4,
};