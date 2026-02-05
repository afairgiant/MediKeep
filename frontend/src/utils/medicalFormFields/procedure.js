/**
 * Procedure form field configuration
 */

import { tagsFieldConfig } from './shared';

export const procedureFormFields = [
  {
    name: 'procedure_name',
    type: 'text',
    labelKey: 'medical:procedures.procedureName.label',
    placeholderKey: 'medical:procedures.procedureName.placeholder',
    required: true,
    descriptionKey: 'medical:procedures.procedureName.description',
    gridColumn: 8,
  },
  {
    name: 'procedure_type',
    type: 'select',
    labelKey: 'medical:procedures.procedureType.label',
    placeholderKey: 'medical:procedures.procedureType.placeholder',
    descriptionKey: 'medical:procedures.procedureType.description',
    gridColumn: 4,
    clearable: true,
    options: [
      {
        value: 'surgical',
        labelKey: 'medical:procedures.procedureType.options.surgical',
      },
      {
        value: 'diagnostic',
        labelKey: 'medical:procedures.procedureType.options.diagnostic',
      },
      {
        value: 'therapeutic',
        labelKey: 'medical:procedures.procedureType.options.therapeutic',
      },
      {
        value: 'preventive',
        labelKey: 'medical:procedures.procedureType.options.preventive',
      },
      {
        value: 'emergency',
        labelKey: 'medical:procedures.procedureType.options.emergency',
      },
    ],
  },
  {
    name: 'procedure_code',
    type: 'text',
    labelKey: 'medical:procedures.procedureCode.label',
    placeholderKey: 'medical:procedures.procedureCode.placeholder',
    descriptionKey: 'medical:procedures.procedureCode.description',
    gridColumn: 6,
  },
  {
    name: 'procedure_setting',
    type: 'select',
    labelKey: 'medical:procedures.procedureSetting.label',
    placeholderKey: 'medical:procedures.procedureSetting.placeholder',
    descriptionKey: 'medical:procedures.procedureSetting.description',
    gridColumn: 6,
    clearable: true,
    options: [
      {
        value: 'outpatient',
        labelKey: 'medical:procedures.procedureSetting.options.outpatient',
      },
      {
        value: 'inpatient',
        labelKey: 'medical:procedures.procedureSetting.options.inpatient',
      },
      {
        value: 'office',
        labelKey: 'medical:procedures.procedureSetting.options.office',
      },
      {
        value: 'emergency',
        labelKey: 'medical:procedures.procedureSetting.options.emergency',
      },
      {
        value: 'home',
        labelKey: 'medical:procedures.procedureSetting.options.home',
      },
    ],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'medical:procedures.description.label',
    placeholderKey: 'medical:procedures.description.placeholder',
    descriptionKey: 'medical:procedures.description.description',
    gridColumn: 12,
    minRows: 3,
    maxRows: 5,
  },
  {
    name: 'procedure_date',
    type: 'date',
    labelKey: 'medical:procedures.procedureDate.label',
    placeholderKey: 'medical:procedures.procedureDate.placeholder',
    required: true,
    descriptionKey: 'medical:procedures.procedureDate.description',
    gridColumn: 4,
  },
  {
    name: 'status',
    type: 'select',
    labelKey: 'common:labels.status',
    descriptionKey: 'medical:procedures.status.description',
    gridColumn: 4,
    dynamicOptions: 'statuses',
  },
  {
    name: 'procedure_duration',
    type: 'number',
    labelKey: 'medical:procedures.procedureDuration.label',
    placeholderKey: 'medical:procedures.procedureDuration.placeholder',
    descriptionKey: 'medical:procedures.procedureDuration.description',
    gridColumn: 4,
    min: 1,
  },
  {
    name: 'facility',
    type: 'text',
    labelKey: 'medical:procedures.facility.label',
    placeholderKey: 'medical:procedures.facility.placeholder',
    descriptionKey: 'medical:procedures.facility.description',
    gridColumn: 6,
  },
  {
    name: 'practitioner_id',
    type: 'select',
    labelKey: 'medical:procedures.practitioner.label',
    placeholderKey: 'medical:procedures.practitioner.placeholder',
    descriptionKey: 'medical:procedures.practitioner.description',
    gridColumn: 6,
    clearable: true,
    searchable: true,
    dynamicOptions: 'practitioners',
  },
  {
    name: 'procedure_complications',
    type: 'textarea',
    labelKey: 'medical:procedures.complications.label',
    placeholderKey: 'medical:procedures.complications.placeholder',
    descriptionKey: 'medical:procedures.complications.description',
    gridColumn: 12,
    minRows: 2,
    maxRows: 4,
  },
  {
    name: 'notes',
    type: 'textarea',
    labelKey: 'medical:procedures.notes.label',
    placeholderKey: 'medical:procedures.notes.placeholder',
    descriptionKey: 'medical:procedures.notes.description',
    gridColumn: 12,
    minRows: 3,
    maxRows: 6,
  },
  {
    name: 'anesthesia_type',
    type: 'select',
    labelKey: 'medical:procedures.anesthesiaType.label',
    placeholderKey: 'medical:procedures.anesthesiaType.placeholder',
    descriptionKey: 'medical:procedures.anesthesiaType.description',
    gridColumn: 6,
    clearable: true,
    options: [
      {
        value: 'general',
        labelKey: 'medical:procedures.anesthesiaType.options.general',
      },
      {
        value: 'local',
        labelKey: 'medical:procedures.anesthesiaType.options.local',
      },
      {
        value: 'regional',
        labelKey: 'medical:procedures.anesthesiaType.options.regional',
      },
      {
        value: 'sedation',
        labelKey: 'medical:procedures.anesthesiaType.options.sedation',
      },
      {
        value: 'none',
        labelKey: 'medical:procedures.anesthesiaType.options.none',
      },
    ],
  },
  {
    name: 'anesthesia_notes',
    type: 'text',
    labelKey: 'medical:procedures.anesthesiaNotes.label',
    placeholderKey: 'medical:procedures.anesthesiaNotes.placeholder',
    descriptionKey: 'medical:procedures.anesthesiaNotes.description',
    gridColumn: 6,
  },
  tagsFieldConfig,
];
