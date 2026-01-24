/**
 * Practitioner form field configuration
 */

export const practitionerFormFields = [
  {
    name: 'name',
    type: 'text',
    label: 'Full Name',
    placeholder: 'Dr. Jane Smith',
    required: true,
    description: "Doctor's full name including title",
    gridColumn: 12,
  },
  {
    name: 'specialty',
    type: 'combobox',
    label: 'Medical Specialty',
    placeholder: 'Search specialties or type custom...',
    description: 'Select from list or type a custom specialty',
    required: true,
    gridColumn: 6,
    maxDropdownHeight: 200,
    dynamicOptions: 'specialties',
  },
  {
    name: 'practice',
    type: 'text',
    label: 'Practice/Hospital',
    placeholder: 'City General Hospital',
    required: false,
    description: 'Workplace or medical facility (optional)',
    gridColumn: 6,
  },
  {
    name: 'phone_number',
    type: 'tel',
    label: 'Phone Number',
    placeholder: '(555) 123-4567',
    description: 'Primary contact number',
    gridColumn: 6,
    maxLength: 20,
  },
  {
    name: 'email',
    type: 'email',
    labelKey: 'medical:practitioners.email.label',
    placeholderKey: 'medical:practitioners.email.placeholder',
    descriptionKey: 'medical:practitioners.email.description',
    gridColumn: 6,
  },
  {
    name: 'website',
    type: 'text',
    label: 'Website',
    placeholder: 'https://www.example.com',
    description: 'Professional website or practice page',
    gridColumn: 6,
  },
  {
    name: 'rating',
    type: 'rating',
    label: 'Rating',
    description: "Rate this practitioner's overall care quality",
    gridColumn: 12,
  },
];
