import { ERROR_MESSAGES } from '../constants/errorMessages';

/** Form state of the Add/Edit Injury dialog. */
export interface InjuryFormData {
  injury_name: string;
  injury_type_id: number | string | null;
  body_part: string;
  laterality: string;
  date_of_injury: string;
  mechanism: string;
  severity: string;
  status: string;
  treatment_received: string;
  recovery_notes: string;
  practitioner_id: number | string | null;
  notes: string;
  tags: string[];
}

export const INITIAL_INJURY_FORM_DATA: InjuryFormData = {
  injury_name: '',
  injury_type_id: null,
  body_part: '',
  laterality: '',
  date_of_injury: '',
  mechanism: '',
  severity: '',
  status: 'active',
  treatment_received: '',
  recovery_notes: '',
  practitioner_id: null,
  notes: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. */
export const validateInjuryForm = (
  form: InjuryFormData,
  patientId?: number | null
): string | null => {
  if (!patientId) return 'Patient information not available';
  if (!form.injury_name.trim()) return ERROR_MESSAGES.REQUIRED_FIELD_MISSING;
  return null;
};

/**
 * Request body for creating or updating an injury. Fields are listed explicitly so
 * form-only state (such as pending visit links) is never sent to the API.
 */
export const buildInjuryPayload = (
  form: InjuryFormData,
  patientId: number
) => ({
  injury_name: form.injury_name,
  injury_type_id: form.injury_type_id || null,
  body_part: form.body_part,
  laterality: form.laterality || null,
  date_of_injury: form.date_of_injury || null,
  mechanism: form.mechanism || null,
  severity: form.severity || null,
  status: form.status,
  treatment_received: form.treatment_received || null,
  recovery_notes: form.recovery_notes || null,
  practitioner_id: form.practitioner_id || null,
  notes: form.notes || null,
  tags: form.tags,
  patient_id: patientId,
});
