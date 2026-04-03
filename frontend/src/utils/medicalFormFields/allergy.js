/**
 * Allergy form field configuration
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const allergyFormFields = [
  {
    name: 'allergen',
    type: 'text',
    labelKey: 'medical:allergies.allergen.label',
    placeholderKey: 'medical:allergies.allergen.placeholder',
    descriptionKey: 'medical:allergies.allergen.description',
    required: true,
    gridColumn: 6,
  },
  {
    name: 'severity',
    type: 'select',
    labelKey: 'shared:fields.severity',
    placeholderKey: 'medical:allergies.severity.placeholder',
    descriptionKey: 'medical:allergies.severity.description',
    required: true,
    gridColumn: 6,
    options: [
      { value: 'mild', labelKey: 'common:severity.mild' },
      { value: 'moderate', labelKey: 'common:severity.moderate' },
      { value: 'severe', labelKey: 'common:severity.severe' },
      { value: 'life-threatening', labelKey: 'common:severity.lifeThreatening' },
    ],
  },
  {
    name: 'reaction',
    type: 'text',
    labelKey: 'medical:allergies.reaction.label',
    placeholderKey: 'medical:allergies.reaction.placeholder',
    descriptionKey: 'medical:allergies.reaction.description',
    gridColumn: 6,
  },
  {
    name: 'onset_date',
    type: 'date',
    labelKey: 'shared:fields.onsetDate',
    placeholderKey: 'medical:allergies.onsetDate.placeholder',
    descriptionKey: 'medical:allergies.onsetDate.description',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'medication_id',
    type: 'select',
    labelKey: 'medical:allergies.relatedMedication.label',
    placeholderKey: 'medical:allergies.relatedMedication.placeholder',
    descriptionKey: 'medical:allergies.relatedMedication.description',
    gridColumn: 12,
    searchable: true,
    clearable: true,
    dynamicOptions: 'medications',
  },
  {
    name: 'status',
    type: 'select',
    labelKey: 'shared:fields.status',
    descriptionKey: 'medical:allergies.status.description',
    gridColumn: 12,
    options: [
      { value: 'active', labelKey: 'shared:labels.active' },
      { value: 'inactive', labelKey: 'shared:labels.inactive' },
      { value: 'resolved', labelKey: 'shared:labels.resolved' },
    ],
  },
  {
    name: 'notes',
    type: 'textarea',
    labelKey: 'shared:tabs.notes',
    placeholderKey: 'common:fields.notes.placeholder',
    descriptionKey: 'common:fields.notes.description',
    gridColumn: 12,
    minRows: 3,
    maxRows: 6,
  },
  tagsFieldConfig,
];
