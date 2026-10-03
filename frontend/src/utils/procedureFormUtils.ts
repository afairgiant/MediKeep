import { ERROR_MESSAGES } from '../constants/errorMessages';

/** Form state of the Add/Edit Procedure dialog. */
export interface ProcedureFormData {
  procedure_name: string;
  procedure_type: string;
  procedure_code: string;
  description: string;
  procedure_date: string;
  status: string;
  outcome: string;
  notes: string;
  facility: string;
  procedure_setting: string;
  procedure_complications: string;
  procedure_duration: string;
  practitioner_id: string;
  anesthesia_type: string;
  anesthesia_notes: string;
  tags: string[];
}

export const INITIAL_PROCEDURE_FORM_DATA: ProcedureFormData = {
  procedure_name: '',
  procedure_type: '',
  procedure_code: '',
  description: '',
  procedure_date: '',
  status: 'scheduled',
  outcome: '',
  notes: '',
  facility: '',
  procedure_setting: '',
  procedure_complications: '',
  procedure_duration: '',
  practitioner_id: '',
  anesthesia_type: '',
  anesthesia_notes: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. */
export const validateProcedureForm = (
  form: ProcedureFormData,
  patientId?: number | null
): string | null => {
  if (!form.procedure_name.trim()) return ERROR_MESSAGES.REQUIRED_FIELD_MISSING;
  if (!form.procedure_date) return ERROR_MESSAGES.INVALID_DATE;
  if (!patientId) return ERROR_MESSAGES.PATIENT_NOT_SELECTED;
  return null;
};

/** Request body for creating or updating a procedure. */
export const buildProcedurePayload = (
  form: ProcedureFormData,
  patientId: number
) => ({
  procedure_name: form.procedure_name,
  procedure_type: form.procedure_type || null,
  procedure_code: form.procedure_code || null,
  description: form.description,
  date: form.procedure_date || null,
  status: form.status,
  outcome: form.outcome || null,
  notes: form.notes || null,
  facility: form.facility || null,
  procedure_setting: form.procedure_setting || null,
  procedure_complications: form.procedure_complications || null,
  procedure_duration: form.procedure_duration
    ? parseInt(form.procedure_duration)
    : null,
  practitioner_id: form.practitioner_id ? parseInt(form.practitioner_id) : null,
  anesthesia_type: form.anesthesia_type || null,
  anesthesia_notes: form.anesthesia_notes || null,
  tags: form.tags || [],
  patient_id: patientId,
});
