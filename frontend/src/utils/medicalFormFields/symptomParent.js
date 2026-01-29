/**
 * Symptom Parent Definition form field configuration
 * For creating the symptom type/definition
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const symptomParentFormFields = [
  {
    name: 'symptom_name',
    type: 'text',
    label: 'Symptom Name',
    placeholder: 'e.g., Migraine Headache, Chronic Back Pain',
    required: true,
    description: 'Name of the symptom you want to track',
    gridColumn: 8,
    maxLength: 200,
  },
  {
    name: 'category',
    type: 'text',
    label: 'Category',
    placeholder: 'e.g., Pain, Digestive, Respiratory',
    description: 'Optional category to organize symptoms',
    gridColumn: 4,
    maxLength: 100,
  },
  {
    name: 'first_occurrence_date',
    type: 'date',
    label: 'First Occurrence Date',
    placeholder: 'When did you first experience this',
    required: true,
    description: 'When you first noticed this symptom',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'status',
    type: 'select',
    label: 'Overall Status',
    placeholder: 'Select status',
    required: true,
    description: 'Current overall status of this symptom',
    gridColumn: 6,
    options: [
      {
        value: 'active',
        label: 'Active - Currently experiencing',
      },
      {
        value: 'resolved',
        label: 'Resolved - No longer experiencing',
      },
      {
        value: 'recurring',
        label: 'Recurring - Comes and goes',
      },
    ],
  },
  {
    name: 'is_chronic',
    type: 'checkbox',
    label: 'Chronic Condition',
    description: 'Check if this is an ongoing/long-term symptom',
    gridColumn: 6,
  },
  {
    name: 'typical_triggers',
    type: 'custom',
    component: 'TagInput',
    label: 'Common Triggers',
    placeholder: 'Add common triggers (stress, weather, foods, etc.)',
    description: 'What typically triggers this symptom',
    gridColumn: 12,
    maxTags: 20,
  },
  {
    name: 'general_notes',
    type: 'textarea',
    label: 'General Notes',
    placeholder: 'Overall notes about this symptom...',
    description: 'General information about patterns, history, or observations',
    gridColumn: 12,
    minRows: 3,
    maxRows: 6,
    maxLength: 2000,
  },
  tagsFieldConfig,
];
