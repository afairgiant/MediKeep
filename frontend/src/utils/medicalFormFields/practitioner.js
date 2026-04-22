/**
 * Practitioner form field configuration
 */

export const practitionerFormFields = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'shared:fields.fullName',
    placeholderKey: 'medical:practitioners.form.name.placeholder',
    required: true,
    descriptionKey: 'medical:practitioners.form.name.description',
    gridColumn: 12,
  },
  {
    name: 'specialty_id',
    type: 'specialty-select',
    labelKey: 'medical:practitioners.form.specialty.label',
    placeholderKey: 'medical:practitioners.form.specialty.placeholder',
    descriptionKey: 'medical:practitioners.form.specialty.description',
    required: true,
    gridColumn: 6,
  },
  {
    name: 'practice_id',
    type: 'combobox',
    labelKey: 'medical:practitioners.form.practice.label',
    placeholderKey: 'medical:practitioners.form.practice.placeholder',
    required: false,
    descriptionKey: 'medical:practitioners.form.practice.description',
    gridColumn: 6,
    maxDropdownHeight: 200,
    dynamicOptions: 'practices',
    creatable: true,
  },
  {
    name: 'phone_number',
    type: 'tel',
    labelKey: 'shared:labels.phoneNumber',
    placeholderKey: 'shared:fields.15551234567',
    descriptionKey: 'medical:practitioners.form.phone.description',
    gridColumn: 6,
    maxLength: 20,
  },
  {
    name: 'email',
    type: 'email',
    labelKey: 'shared:fields.emailAddress',
    placeholderKey: 'medical:practitioners.form.email.placeholder',
    descriptionKey: 'medical:practitioners.form.email.description',
    gridColumn: 6,
  },
  {
    name: 'website',
    type: 'text',
    labelKey: 'shared:labels.website',
    placeholderKey: 'medical:practitioners.form.website.placeholder',
    descriptionKey: 'medical:practitioners.form.website.description',
    gridColumn: 6,
  },
  {
    name: 'rating',
    type: 'rating',
    labelKey: 'shared:labels.rating',
    descriptionKey: 'medical:practitioners.form.rating.description',
    gridColumn: 12,
  },
];
