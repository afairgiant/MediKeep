import { describe, expect, it, vi } from 'vitest';

import { ERROR_MESSAGES } from '../../constants/errorMessages';
import {
  INITIAL_TREATMENT_FORM_DATA,
  buildTreatmentPayload,
  validateTreatmentForm,
} from '../treatmentFormUtils';
import {
  INITIAL_CONDITION_FORM_DATA,
  buildConditionPayload,
  validateConditionForm,
} from '../conditionFormUtils';
import {
  INITIAL_MEDICATION_FORM_DATA,
  buildMedicationPayload,
  validateMedicationForm,
} from '../medicationFormUtils';
import {
  INITIAL_INJURY_FORM_DATA,
  buildInjuryPayload,
  validateInjuryForm,
} from '../injuryFormUtils';
import {
  INITIAL_PROCEDURE_FORM_DATA,
  buildProcedurePayload,
  validateProcedureForm,
} from '../procedureFormUtils';
import {
  applySymptomInputChange,
  buildSymptomPayload,
  createInitialSymptomFormData,
  validateSymptomForm,
} from '../symptomFormUtils';
import {
  INITIAL_VISIT_FORM_DATA,
  buildVisitPayload,
  validateVisitForm,
} from '../visitFormUtils';

describe('procedureFormUtils', () => {
  const filled = {
    ...INITIAL_PROCEDURE_FORM_DATA,
    procedure_name: 'Knee arthroscopy',
    procedure_date: '2026-01-15',
    procedure_duration: '45',
    practitioner_id: '3',
    tags: ['surgery'],
  };

  it('validates in the order name, date, patient', () => {
    expect(validateProcedureForm(INITIAL_PROCEDURE_FORM_DATA, 7)).toBe(
      ERROR_MESSAGES.REQUIRED_FIELD_MISSING
    );
    expect(validateProcedureForm({ ...filled, procedure_date: '' }, 7)).toBe(
      ERROR_MESSAGES.INVALID_DATE
    );
    expect(validateProcedureForm(filled, undefined)).toBe(
      ERROR_MESSAGES.PATIENT_NOT_SELECTED
    );
    expect(validateProcedureForm(filled, 7)).toBeNull();
    expect(validateProcedureForm({ ...filled, procedure_name: '   ' }, 7)).toBe(
      ERROR_MESSAGES.REQUIRED_FIELD_MISSING
    );
  });

  it('builds the API body with real column names and parsed numbers', () => {
    expect(buildProcedurePayload(filled, 7)).toEqual({
      procedure_name: 'Knee arthroscopy',
      procedure_type: null,
      procedure_code: null,
      description: '',
      date: '2026-01-15',
      status: 'scheduled',
      outcome: null,
      notes: null,
      facility: null,
      procedure_setting: null,
      procedure_complications: null,
      procedure_duration: 45,
      practitioner_id: 3,
      anesthesia_type: null,
      anesthesia_notes: null,
      tags: ['surgery'],
      patient_id: 7,
    });
  });

  it('never sends form-only fields', () => {
    const payload = buildProcedurePayload(
      { ...filled, pending_visit_links: [{ entityId: 1 }] } as never,
      7
    );
    expect(payload).not.toHaveProperty('pending_visit_links');
    expect(payload).not.toHaveProperty('procedure_date');
  });
});

describe('injuryFormUtils', () => {
  const filled = {
    ...INITIAL_INJURY_FORM_DATA,
    injury_name: 'Sprained ankle',
    body_part: 'ankle',
    date_of_injury: '2026-01-10',
    injury_type_id: 4,
  };

  it('requires the patient first, then the name', () => {
    expect(validateInjuryForm(filled, undefined)).toBe(
      'Patient information not available'
    );
    expect(validateInjuryForm(INITIAL_INJURY_FORM_DATA, 7)).toBe(
      ERROR_MESSAGES.REQUIRED_FIELD_MISSING
    );
    expect(validateInjuryForm(filled, 7)).toBeNull();
  });

  it('builds the API body, turning empty strings into null', () => {
    expect(buildInjuryPayload(filled, 7)).toEqual({
      injury_name: 'Sprained ankle',
      injury_type_id: 4,
      body_part: 'ankle',
      laterality: null,
      date_of_injury: '2026-01-10',
      mechanism: null,
      severity: null,
      status: 'active',
      treatment_received: null,
      recovery_notes: null,
      practitioner_id: null,
      notes: null,
      tags: [],
      patient_id: 7,
    });
  });

  it('never sends form-only fields (the page used to spread the whole form)', () => {
    const payload = buildInjuryPayload(
      { ...filled, pending_visit_links: [{ entityId: 1 }] } as never,
      7
    );
    expect(payload).not.toHaveProperty('pending_visit_links');
  });
});

describe('symptomFormUtils', () => {
  it('starts a new symptom with today as the first occurrence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00'));
    try {
      expect(createInitialSymptomFormData().first_occurrence_date).toBe(
        '2026-10-02'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('fills the resolved date with today when status becomes resolved, and clears it otherwise', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00'));
    try {
      const base = createInitialSymptomFormData();
      const resolved = applySymptomInputChange(base, {
        name: 'status',
        value: 'resolved',
      });
      expect(resolved.resolved_date).toBe('2026-10-02');

      // An existing resolved date is kept when it is already resolved
      const keep = applySymptomInputChange(
        { ...base, status: 'resolved', resolved_date: '2026-09-01' },
        { name: 'status', value: 'resolved' }
      );
      expect(keep.resolved_date).toBe('2026-09-01');

      const active = applySymptomInputChange(resolved, {
        name: 'status',
        value: 'active',
      });
      expect(active.resolved_date).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads checkboxes from checked and other fields from value', () => {
    const base = createInitialSymptomFormData();
    expect(
      applySymptomInputChange(base, {
        name: 'is_chronic',
        value: 'on',
        type: 'checkbox',
        checked: true,
      }).is_chronic
    ).toBe(true);
    expect(
      applySymptomInputChange(base, { name: 'symptom_name', value: 'Headache' })
        .symptom_name
    ).toBe('Headache');
  });

  it('validates and builds the API body without form-only fields', () => {
    const filled = {
      ...createInitialSymptomFormData(),
      symptom_name: 'Headache',
      first_occurrence_date: '2026-01-20',
    };
    expect(validateSymptomForm(filled, undefined)).toBe(
      'Patient information not available'
    );
    expect(validateSymptomForm(createInitialSymptomFormData(), 7)).toBe(
      ERROR_MESSAGES.REQUIRED_FIELD_MISSING
    );
    expect(validateSymptomForm(filled, 7)).toBeNull();

    const payload = buildSymptomPayload(
      { ...filled, pending_visit_links: [{ entityId: 1 }] } as never,
      7
    );
    expect(payload).toEqual({
      symptom_name: 'Headache',
      category: '',
      first_occurrence_date: '2026-01-20',
      status: 'active',
      is_chronic: false,
      resolved_date: null,
      typical_triggers: [],
      general_notes: '',
      tags: [],
      patient_id: 7,
    });
  });
});

describe('visitFormUtils', () => {
  const filled = {
    ...INITIAL_VISIT_FORM_DATA,
    reason: 'Annual checkup',
    date: '2026-03-01',
    condition_id: '12',
    practitioner_id: 5,
  };

  it('validates in the order reason, date, patient', () => {
    expect(validateVisitForm(INITIAL_VISIT_FORM_DATA, 7)).toBe(
      ERROR_MESSAGES.REQUIRED_FIELD_MISSING
    );
    expect(validateVisitForm({ ...filled, date: '' }, 7)).toBe(
      ERROR_MESSAGES.INVALID_DATE
    );
    expect(validateVisitForm(filled, null)).toBe(
      ERROR_MESSAGES.PATIENT_NOT_SELECTED
    );
    expect(validateVisitForm(filled, 7)).toBeNull();
  });

  it('builds the API body, parsing the condition id and nulling empty fields', () => {
    expect(buildVisitPayload(filled, 7)).toEqual({
      reason: 'Annual checkup',
      date: '2026-03-01',
      notes: null,
      practitioner_id: 5,
      condition_id: 12,
      visit_type: null,
      chief_complaint: null,
      diagnosis: null,
      treatment_plan: null,
      follow_up_instructions: null,
      duration_minutes: null,
      location: null,
      priority: null,
      tags: [],
      patient_id: 7,
    });
    expect(
      buildVisitPayload({ ...filled, condition_id: '' }, 7).condition_id
    ).toBeNull();
  });

  it('never sends form-only fields', () => {
    const payload = buildVisitPayload(
      { ...filled, pending_links: { procedures: [] } } as never,
      7
    );
    expect(payload).not.toHaveProperty('pending_links');
  });
});

describe('conditionFormUtils', () => {
  const filled = {
    ...INITIAL_CONDITION_FORM_DATA,
    diagnosis: 'Hypertension',
    onset_date: '2025-06-01',
    practitioner_id: '4',
  };

  it('checks the patient first, then dates, then status and diagnosis', () => {
    expect(validateConditionForm(filled, undefined)).toBe(
      'Patient information not available'
    );
    expect(
      validateConditionForm({ ...filled, onset_date: '2999-01-01' }, 7)
    ).toMatch(/^Onset date \(2999-01-01\) cannot be in the future/);
    expect(
      validateConditionForm({ ...filled, end_date: '2999-01-01' }, 7)
    ).toMatch(/^End date \(2999-01-01\) cannot be in the future/);
    expect(
      validateConditionForm({ ...filled, end_date: '2025-01-01' }, 7)
    ).toBe('End date cannot be before onset date');
    expect(validateConditionForm({ ...filled, status: '' }, 7)).toBe(
      'Status is required. Please select a status.'
    );
    expect(validateConditionForm(INITIAL_CONDITION_FORM_DATA, 7)).toBe(
      'Diagnosis is required.'
    );
    expect(validateConditionForm(filled, 7)).toBeNull();
  });

  it('builds the API body, parsing the practitioner and nulling empty fields', () => {
    const payload = buildConditionPayload(filled, 7);
    expect(payload).toMatchObject({
      condition_name: null,
      diagnosis: 'Hypertension',
      notes: null,
      status: 'active',
      severity: null,
      practitioner_id: 4,
      icd10_code: null,
      tags: [],
      patient_id: 7,
    });
    expect(payload.onset_date).toBeTruthy();
    expect(payload.end_date).toBeFalsy();
  });

  it('never sends form-only fields', () => {
    const payload = buildConditionPayload(
      {
        ...filled,
        pending_medication_ids: [1],
        pending_visit_links: [{ entityId: 1 }],
      } as never,
      7
    );
    expect(payload).not.toHaveProperty('pending_medication_ids');
    expect(payload).not.toHaveProperty('pending_visit_links');
  });
});

describe('medicationFormUtils', () => {
  const filled = {
    ...INITIAL_MEDICATION_FORM_DATA,
    medication_name: '  Ibuprofen ',
    dosage: ' 200mg ',
    practitioner_id: '3',
    pharmacy_id: 9,
  };

  it('requires the patient, then a name of at least two characters', () => {
    expect(validateMedicationForm(filled, undefined)).toBe(
      'Patient information not available'
    );
    expect(validateMedicationForm(INITIAL_MEDICATION_FORM_DATA, 7)).toBe(
      'Medication name is required'
    );
    expect(
      validateMedicationForm({ ...filled, medication_name: ' a ' }, 7)
    ).toBe('Medication name must be at least 2 characters long');
    expect(validateMedicationForm(filled, 7)).toBeNull();
  });

  it('trims text, parses ids and builds the reminder fields', () => {
    expect(
      buildMedicationPayload(
        {
          ...filled,
          reminder_enabled: true,
          reminder_times: ['08:00', '', '20:00'],
          reminder_days: [1, 3],
          reminder_message: ' take with food ',
        },
        7
      )
    ).toMatchObject({
      medication_name: 'Ibuprofen',
      dosage: '200mg',
      practitioner_id: 3,
      pharmacy_id: 9,
      patient_id: 7,
      reminder_enabled: true,
      reminder_times: ['08:00', '20:00'],
      reminder_days: [1, 3],
      reminder_message: 'take with food',
    });
  });

  it('sends reminders off by default and dates only when set', () => {
    const payload = buildMedicationPayload(filled, 7);
    expect(payload).toMatchObject({
      reminder_enabled: false,
      reminder_times: [],
      reminder_days: null,
      reminder_message: null,
    });
    expect(payload).not.toHaveProperty('effective_period_start');
    expect(
      buildMedicationPayload(
        { ...filled, effective_period_start: '2026-01-01' },
        7
      ).effective_period_start
    ).toBe('2026-01-01');
  });

  it('never sends form-only fields', () => {
    const payload = buildMedicationPayload(
      {
        ...filled,
        condition_ids: ['1'],
        pending_visit_links: [{ entityId: 1 }],
      } as never,
      7
    );
    expect(payload).not.toHaveProperty('condition_ids');
    expect(payload).not.toHaveProperty('pending_visit_links');
  });
});

describe('treatmentFormUtils', () => {
  const filled = { ...INITIAL_TREATMENT_FORM_DATA, treatment_name: 'Physio' };

  it('checks name, then date order, then patient', () => {
    expect(validateTreatmentForm(INITIAL_TREATMENT_FORM_DATA, undefined)).toBe(
      'Treatment name is required'
    );
    expect(
      validateTreatmentForm(
        { ...filled, start_date: '2026-02-01', end_date: '2026-01-01' },
        undefined
      )
    ).toBe('End date cannot be before start date');
    expect(validateTreatmentForm(filled, undefined)).toBe(
      'Patient information not available'
    );
    expect(validateTreatmentForm(filled, 7)).toBeNull();
  });

  it('builds the API body with empty fields as null and the mode defaulted', () => {
    expect(
      buildTreatmentPayload({ ...filled, mode: '', condition_id: 3 }, 7)
    ).toEqual({
      treatment_name: 'Physio',
      treatment_type: null,
      description: null,
      start_date: null,
      end_date: null,
      status: 'planned',
      dosage: null,
      frequency: null,
      mode: 'simple',
      notes: null,
      tags: [],
      patient_id: 7,
      condition_id: 3,
      practitioner_id: null,
    });
  });

  it('never sends form-only fields', () => {
    expect(
      buildTreatmentPayload({ ...filled, pending_links: [1] } as never, 7)
    ).not.toHaveProperty('pending_links');
  });
});
