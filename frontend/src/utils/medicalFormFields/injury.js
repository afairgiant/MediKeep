/**
 * Injury form field configuration
 */

import { tagsFieldConfig, getTodayEndOfDay } from './shared';

export const injuryFormFields = [
  {
    name: 'injury_name',
    type: 'text',
    label: 'Injury Name',
    placeholder: 'e.g., Right ankle sprain, Left wrist fracture',
    required: true,
    description: 'A descriptive name for this injury',
    gridColumn: 6,
  },
  {
    name: 'injury_type_id',
    type: 'select',
    label: 'Injury Type',
    placeholder: 'Select or search for injury type',
    description: 'Category of injury (e.g., Sprain, Fracture)',
    gridColumn: 6,
    searchable: true,
    clearable: true,
    creatable: true,
    dynamicOptions: 'injuryTypes',
  },
  {
    name: 'body_part',
    type: 'text',
    label: 'Body Part',
    placeholder: 'e.g., Ankle, Wrist, Knee, Shoulder',
    required: true,
    description: 'The affected body part or area',
    gridColumn: 6,
  },
  {
    name: 'laterality',
    type: 'select',
    label: 'Side',
    placeholder: 'Select side of body',
    description: 'Which side of the body is affected',
    gridColumn: 6,
    clearable: true,
    options: [
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
      { value: 'bilateral', label: 'Both Sides' },
      { value: 'not_applicable', label: 'Not Applicable' },
    ],
  },
  {
    name: 'date_of_injury',
    type: 'date',
    label: 'Date of Injury',
    placeholder: 'When the injury occurred',
    required: false,
    description: 'The date when the injury happened (optional if unknown)',
    gridColumn: 6,
    maxDate: getTodayEndOfDay,
  },
  {
    name: 'severity',
    type: 'select',
    label: 'Severity',
    placeholder: 'Select severity level',
    description: 'How severe is this injury',
    gridColumn: 6,
    clearable: true,
    options: [
      { value: 'mild', label: 'Mild - Minor discomfort' },
      { value: 'moderate', label: 'Moderate - Noticeable impact' },
      { value: 'severe', label: 'Severe - Significant impact' },
      { value: 'life-threatening', label: 'Life-threatening - Critical' },
    ],
  },
  {
    name: 'mechanism',
    type: 'textarea',
    label: 'How It Happened',
    placeholder: 'e.g., Fell while hiking, Sports injury during basketball game',
    description: 'Describe how the injury occurred',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    description: 'Current status of this injury',
    gridColumn: 6,
    required: true,
    options: [
      { value: 'active', label: 'Active - Currently being treated' },
      { value: 'healing', label: 'Healing - In recovery' },
      { value: 'resolved', label: 'Resolved - Fully healed' },
      { value: 'chronic', label: 'Chronic - Long-term/permanent effects' },
    ],
  },
  {
    name: 'practitioner_id',
    type: 'select',
    label: 'Treating Practitioner',
    placeholder: 'Select treating practitioner',
    description: 'The healthcare provider treating this injury',
    gridColumn: 6,
    searchable: true,
    clearable: true,
    dynamicOptions: 'practitioners',
  },
  {
    name: 'treatment_received',
    type: 'textarea',
    label: 'Treatment Received',
    placeholder: 'e.g., RICE protocol, cast applied, physical therapy started',
    description: 'Description of treatment received for this injury',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'recovery_notes',
    type: 'textarea',
    label: 'Recovery Notes',
    placeholder: 'Progress updates, milestones, or recovery observations',
    description: 'Notes about recovery progress',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'notes',
    type: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Any other relevant information about this injury...',
    description: 'General notes or additional details',
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
