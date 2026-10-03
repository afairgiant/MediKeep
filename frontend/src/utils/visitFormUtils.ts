import { ERROR_MESSAGES } from '../constants/errorMessages';

/** Form state of the Add/Edit Visit dialog. */
export interface VisitFormData {
  reason: string;
  date: string;
  notes: string;
  practitioner_id: string | number;
  condition_id: string | number;
  visit_type: string;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  follow_up_instructions: string;
  duration_minutes: string | number;
  location: string;
  priority: string;
  tags: string[];
}

export const INITIAL_VISIT_FORM_DATA: VisitFormData = {
  reason: '',
  date: '',
  notes: '',
  practitioner_id: '',
  condition_id: '',
  visit_type: '',
  chief_complaint: '',
  diagnosis: '',
  treatment_plan: '',
  follow_up_instructions: '',
  duration_minutes: '',
  location: '',
  priority: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. */
export const validateVisitForm = (
  form: VisitFormData,
  patientId?: number | null
): string | null => {
  if (!form.reason.trim()) return ERROR_MESSAGES.REQUIRED_FIELD_MISSING;
  if (!form.date) return ERROR_MESSAGES.INVALID_DATE;
  if (!patientId) return ERROR_MESSAGES.PATIENT_NOT_SELECTED;
  return null;
};

/** Request body for creating or updating a visit (an "encounter" in the API). */
export const buildVisitPayload = (form: VisitFormData, patientId: number) => ({
  reason: form.reason,
  date: form.date,
  notes: form.notes || null,
  practitioner_id: form.practitioner_id || null,
  condition_id: form.condition_id ? parseInt(String(form.condition_id)) : null,
  visit_type: form.visit_type || null,
  chief_complaint: form.chief_complaint || null,
  diagnosis: form.diagnosis || null,
  treatment_plan: form.treatment_plan || null,
  follow_up_instructions: form.follow_up_instructions || null,
  duration_minutes: form.duration_minutes || null,
  location: form.location || null,
  priority: form.priority || null,
  tags: form.tags || [],
  patient_id: patientId,
});
