import {
  dateInFutureMessage,
  endBeforeOnsetMessage,
  patientNotAvailableMessage,
  requiredMessage,
} from './formCheckMessages';
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
  if (!patientId) return patientNotAvailableMessage();

  const todayString = getTodayString();
  if (isDateInFuture(form.onset_date)) {
    return dateInFutureMessage(
      'shared:fields.onsetDate',
      'Onset Date',
      form.onset_date,
      todayString
    );
  }
  if (isDateInFuture(form.end_date)) {
    return dateInFutureMessage(
      'shared:labels.endDate',
      'End Date',
      form.end_date,
      todayString
    );
  }
  if (isEndDateBeforeStartDate(form.onset_date, form.end_date)) {
    return endBeforeOnsetMessage();
  }
  if (!form.status) return requiredMessage('shared:fields.status', 'Status');
  if (!form.diagnosis)
    return requiredMessage('shared:labels.diagnosis', 'Diagnosis');
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
