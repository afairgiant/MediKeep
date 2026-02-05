/**
 * Practitioner form field configuration
 */

export const practitionerFormFields = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'medical:practitioners.form.name.label',
    placeholderKey: 'medical:practitioners.form.name.placeholder',
    required: true,
    descriptionKey: 'medical:practitioners.form.name.description',
    gridColumn: 12,
  },
  {
    name: 'specialty',
    type: 'combobox',
    labelKey: 'medical:practitioners.form.specialty.label',
    placeholderKey: 'medical:practitioners.form.specialty.placeholder',
    descriptionKey: 'medical:practitioners.form.specialty.description',
    required: true,
    gridColumn: 6,
    maxDropdownHeight: 200,
    dynamicOptions: 'specialties',
  },
  {
    name: 'practice',
    type: 'text',
    labelKey: 'medical:practitioners.form.practice.label',
    placeholderKey: 'medical:practitioners.form.practice.placeholder',
    required: false,
    descriptionKey: 'medical:practitioners.form.practice.description',
    gridColumn: 6,
  },
  {
    name: 'phone_number',
    type: 'tel',
    labelKey: 'medical:practitioners.form.phone.label',
    placeholderKey: 'medical:practitioners.form.phone.placeholder',
    descriptionKey: 'medical:practitioners.form.phone.description',
    gridColumn: 6,
    maxLength: 20,
  },
  {
    name: 'email',
    type: 'email',
    labelKey: 'medical:practitioners.form.email.label',
    placeholderKey: 'medical:practitioners.form.email.placeholder',
    descriptionKey: 'medical:practitioners.form.email.description',
    gridColumn: 6,
  },
  {
    name: 'website',
    type: 'text',
    labelKey: 'medical:practitioners.form.website.label',
    placeholderKey: 'medical:practitioners.form.website.placeholder',
    descriptionKey: 'medical:practitioners.form.website.description',
    gridColumn: 6,
  },
  {
    name: 'rating',
    type: 'rating',
    labelKey: 'medical:practitioners.form.rating.label',
    descriptionKey: 'medical:practitioners.form.rating.description',
    gridColumn: 12,
  },
];
