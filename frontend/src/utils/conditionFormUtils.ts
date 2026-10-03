import {
  formatDateForAPI,
  getTodayString,
  isDateInFuture,
  isEndDateBeforeStartDate,
} from './dateUtils';

/** Form state of the Add/Edit Condition dialog. */
export interface ConditionFormData {
  condition_name: string;
  diagnosis: string;
  notes: string;
  status: string;
  severity: string;
  practitioner_id: string | number;
  icd10_code: string;
  snomed_code: string;
  code_description: string;
  onset_date: string;
  end_date: string;
  tags: string[];
}

export const INITIAL_CONDITION_FORM_DATA: ConditionFormData = {
  condition_name: '',
  diagnosis: '',
  notes: '',
  status: 'active',
  severity: '',
  practitioner_id: '',
  icd10_code: '',
  snomed_code: '',
  code_description: '',
  onset_date: '',
  end_date: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. Checked in this order. */
export const validateConditionForm = (
  form: ConditionFormData,
  patientId?: number | null
): string | null => {
  if (!patientId) return 'Patient information not available';

  const todayString = getTodayString();
  if (isDateInFuture(form.onset_date)) {
    return `Onset date (${form.onset_date}) cannot be in the future. Please select a date on or before today (${todayString}).`;
  }
  if (isDateInFuture(form.end_date)) {
    return `End date (${form.end_date}) cannot be in the future. Please select a date on or before today (${todayString}).`;
  }
  if (isEndDateBeforeStartDate(form.onset_date, form.end_date)) {
    return 'End date cannot be before onset date';
  }
  if (!form.status) return 'Status is required. Please select a status.';
  if (!form.diagnosis) return 'Diagnosis is required.';
  return null;
};

/**
 * Request body for creating or updating a condition. Fields are listed explicitly so
 * form-only state (pending medications, pending visit links) is never sent to the API.
 */
export const buildConditionPayload = (
  form: ConditionFormData,
  patientId: number
) => ({
  condition_name: form.condition_name || null,
  diagnosis: form.diagnosis,
  notes: form.notes || null,
  status: form.status || 'active',
  severity: form.severity || null,
  practitioner_id: form.practitioner_id
    ? parseInt(String(form.practitioner_id))
    : null,
  icd10_code: form.icd10_code || null,
  snomed_code: form.snomed_code || null,
  code_description: form.code_description || null,
  onset_date: formatDateForAPI(form.onset_date),
  end_date: formatDateForAPI(form.end_date),
  tags: form.tags || [],
  patient_id: patientId,
});
