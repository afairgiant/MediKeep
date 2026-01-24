/**
 * Allergy form field configuration
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const allergyFormFields = [
  {
    name: 'allergen',
    type: 'text',
    label: 'Allergen',
    placeholder: 'e.g., Penicillin, Peanuts, Latex',
    required: true,
    description: 'What substance causes the allergic reaction',
    gridColumn: 6,
  },
  {
    name: 'severity',
    type: 'select',
    label: 'Severity',
    placeholder: 'Select severity level',
    required: true,
    description: 'How severe is this allergy',
    gridColumn: 6,
    options: [
      {
        value: 'mild',
        label: '💛 Mild - Minor discomfort',
      },
      {
        value: 'moderate',
        label: '⚡ Moderate - Noticeable symptoms',
      },
      {
        value: 'severe',
        label: '⚠️ Severe - Significant reaction',
      },
      {
        value: 'life-threatening',
        label: '🚨 Life-threatening - Anaphylaxis risk',
      },
    ],
  },
  {
    name: 'reaction',
    type: 'text',
    label: 'Reaction',
    placeholder: 'e.g., Rash, Anaphylaxis, Swelling',
    description: 'What happens when exposed to this allergen',
    gridColumn: 6,
  },
  {
    name: 'onset_date',
    type: 'date',
    label: 'Onset Date',
    placeholder: 'When did this allergy first occur',
    description: 'When this allergy was first discovered',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'medication_id',
    type: 'select',
    label: 'Related Medication (Optional)',
    placeholder: 'Select a medication this allergy is related to',
    description: 'Link this allergy to a specific medication if applicable',
    gridColumn: 12,
    searchable: true,
    clearable: true,
    dynamicOptions: 'medications',
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    description: 'Current status of this allergy',
    gridColumn: 12,
    options: [
      { value: 'active', label: 'Active - Currently allergic' },
      { value: 'inactive', label: 'Inactive - No longer allergic' },
      { value: 'resolved', label: 'Resolved - Outgrown the allergy' },
    ],
  },
  {
    name: 'notes',
    type: 'textarea',
    label: 'Notes',
    placeholder: 'Additional information about this allergy...',
    description: 'Any additional details, triggers, or treatment notes',
    gridColumn: 12,
    minRows: 3,
    maxRows: 6,
  },
  tagsFieldConfig,
];
