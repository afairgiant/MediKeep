/**
 * Injury form field configuration
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const injuryFormFields = [
  {
    name: 'injury_name',
    type: 'text',
    labelKey: 'medical:injuries.injuryName.label',
    placeholderKey: 'medical:injuries.injuryName.placeholder',
    required: true,
    descriptionKey: 'medical:injuries.injuryName.description',
    gridColumn: 6,
  },
  {
    name: 'injury_type_id',
    type: 'select',
    labelKey: 'medical:injuries.injuryType.label',
    placeholderKey: 'medical:injuries.injuryType.placeholder',
    descriptionKey: 'medical:injuries.injuryType.description',
    gridColumn: 6,
    searchable: true,
    clearable: true,
    dynamicOptions: 'injuryTypes',
  },
  {
    name: 'body_part',
    type: 'text',
    labelKey: 'medical:injuries.bodyLocation.label',
    placeholderKey: 'medical:injuries.bodyLocation.placeholder',
    required: true,
    descriptionKey: 'medical:injuries.bodyLocation.description',
    gridColumn: 6,
  },
  {
    name: 'laterality',
    type: 'select',
    labelKey: 'medical:injuries.laterality.label',
    placeholderKey: 'medical:injuries.laterality.placeholder',
    descriptionKey: 'medical:injuries.laterality.description',
    gridColumn: 6,
    clearable: true,
    options: [
      { value: 'left', labelKey: 'medical:injuries.laterality.options.left' },
      { value: 'right', labelKey: 'medical:injuries.laterality.options.right' },
      { value: 'bilateral', labelKey: 'medical:injuries.laterality.options.bilateral' },
      { value: 'not_applicable', labelKey: 'medical:injuries.laterality.options.notApplicable' },
    ],
  },
  {
    name: 'date_of_injury',
    type: 'date',
    labelKey: 'medical:injuries.injuryDate.label',
    placeholderKey: 'medical:injuries.injuryDate.placeholder',
    required: false,
    descriptionKey: 'medical:injuries.injuryDate.description',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'severity',
    type: 'select',
    labelKey: 'common:labels.severity',
    placeholderKey: 'medical:injuries.severity.placeholder',
    descriptionKey: 'medical:injuries.severity.description',
    gridColumn: 6,
    clearable: true,
    options: [
      { value: 'mild', labelKey: 'common:severity.mild' },
      { value: 'moderate', labelKey: 'common:severity.moderate' },
      { value: 'severe', labelKey: 'common:severity.severe' },
      { value: 'life-threatening', labelKey: 'common:severity.critical' },
    ],
  },
  {
    name: 'mechanism',
    type: 'textarea',
    labelKey: 'medical:injuries.cause.label',
    placeholderKey: 'medical:injuries.cause.placeholder',
    descriptionKey: 'medical:injuries.cause.description',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'status',
    type: 'select',
    labelKey: 'common:labels.status',
    descriptionKey: 'medical:injuries.status.description',
    gridColumn: 6,
    required: true,
    options: [
      { value: 'active', labelKey: 'common:status.active' },
      { value: 'healing', labelKey: 'medical:injuries.status.options.healing' },
      { value: 'resolved', labelKey: 'common:status.resolved' },
      { value: 'chronic', labelKey: 'medical:injuries.status.options.chronic' },
    ],
  },
  {
    name: 'practitioner_id',
    type: 'select',
    labelKey: 'medical:injuries.practitioner.label',
    placeholderKey: 'medical:injuries.practitioner.placeholder',
    descriptionKey: 'medical:injuries.practitioner.description',
    gridColumn: 6,
    searchable: true,
    clearable: true,
    dynamicOptions: 'practitioners',
  },
  {
    name: 'treatment_received',
    type: 'textarea',
    labelKey: 'medical:injuries.treatment.label',
    placeholderKey: 'medical:injuries.treatment.placeholder',
    descriptionKey: 'medical:injuries.treatment.description',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'recovery_notes',
    type: 'textarea',
    labelKey: 'medical:injuries.recoveryNotes.label',
    placeholderKey: 'medical:injuries.recoveryNotes.placeholder',
    descriptionKey: 'medical:injuries.recoveryNotes.description',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'notes',
    type: 'textarea',
    labelKey: 'common:labels.notes',
    placeholderKey: 'medical:injuries.notes.placeholder',
    descriptionKey: 'medical:injuries.notes.description',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  tagsFieldConfig,
];

// Fields for the basic info tab
export const injuryBasicInfoFields = [
  'injury_name',
  'injury_type_id',
  'body_part',
  'laterality',
  'date_of_injury',
  'severity',
  'status',
  'practitioner_id',
];

// Fields for the treatment/recovery tab
export const injuryTreatmentFields = [
  'mechanism',
  'treatment_received',
  'recovery_notes',
];

// Fields for notes tab
export const injuryNotesFields = ['notes', 'tags'];
