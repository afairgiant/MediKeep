/**
 * Model Constants
 *
 * Shared constants for model management across the application.
 */

/**
 * List of medical record model names that require patient_id auto-population
 * These models are tied to the current user's patient record
 */
export const MEDICAL_MODELS = [
  'medication',
  'lab_result',
  'condition',
  'allergy',
  'immunization',
  'procedure',
  'treatment',
  'encounter',
];

/**
 * Fields that should be considered "important" for display in model lists
 * Used to determine which fields to show in table views
 */
export const IMPORTANT_FIELDS = [
  'username',
  'email',
  'full_name',
  'role',
  'first_name',
  'last_name',
  'birth_date',
  'name',
  'specialty',
  'practice',
  'medication_name',
  'allergen',
  'diagnosis',
  'vaccine_name',
  'test_name',
  'reason',
  'status',
  'severity',
  'date',
  'start_date',
  'end_date',
  'onset_date',
  'duration',
];
