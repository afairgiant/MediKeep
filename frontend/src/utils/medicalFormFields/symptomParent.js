/**
 * Symptom Parent Definition form field configuration
 * For creating the symptom type/definition
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const symptomParentFormFields = [
  {
    name: 'symptom_name',
    type: 'text',
    labelKey: 'medical:symptoms.parent.symptomName.label',
    placeholderKey: 'medical:symptoms.parent.symptomName.placeholder',
    required: true,
    descriptionKey: 'medical:symptoms.parent.symptomName.description',
    gridColumn: 8,
    maxLength: 200,
  },
  {
    name: 'category',
    type: 'text',
    labelKey: 'medical:symptoms.parent.category.label',
    placeholderKey: 'medical:symptoms.parent.category.placeholder',
    descriptionKey: 'medical:symptoms.parent.category.description',
    gridColumn: 4,
    maxLength: 100,
  },
  {
    name: 'first_occurrence_date',
    type: 'date',
    labelKey: 'medical:symptoms.parent.firstOccurrenceDate.label',
    placeholderKey: 'medical:symptoms.parent.firstOccurrenceDate.placeholder',
    required: true,
    descriptionKey: 'medical:symptoms.parent.firstOccurrenceDate.description',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'status',
    type: 'select',
    labelKey: 'medical:symptoms.parent.status.label',
    placeholderKey: 'medical:symptoms.parent.status.placeholder',
    required: true,
    descriptionKey: 'medical:symptoms.parent.status.description',
    gridColumn: 6,
    options: [
      {
        value: 'active',
        labelKey: 'medical:symptoms.parent.statusOptions.active',
      },
      {
        value: 'resolved',
        labelKey: 'medical:symptoms.parent.statusOptions.resolved',
      },
      {
        value: 'recurring',
        labelKey: 'medical:symptoms.parent.statusOptions.recurring',
      },
    ],
  },
  {
    name: 'is_chronic',
    type: 'checkbox',
    labelKey: 'medical:symptoms.parent.isChronic.label',
    descriptionKey: 'medical:symptoms.parent.isChronic.description',
    gridColumn: 6,
  },
  {
    name: 'typical_triggers',
    type: 'custom',
    component: 'TagInput',
    labelKey: 'medical:symptoms.parent.typicalTriggers.label',
    placeholderKey: 'medical:symptoms.parent.typicalTriggers.placeholder',
    descriptionKey: 'medical:symptoms.parent.typicalTriggers.description',
    gridColumn: 12,
    maxTags: 20,
  },
  {
    name: 'general_notes',
    type: 'textarea',
    labelKey: 'medical:symptoms.parent.generalNotes.label',
    placeholderKey: 'medical:symptoms.parent.generalNotes.placeholder',
    descriptionKey: 'medical:symptoms.parent.generalNotes.description',
    gridColumn: 12,
    minRows: 3,
    maxRows: 6,
    maxLength: 2000,
  },
  tagsFieldConfig,
];
