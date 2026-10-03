/** Form state of the Add/Edit Treatment dialog. */
export interface TreatmentFormData {
  treatment_name: string;
  treatment_type: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  dosage: string;
  frequency: string;
  mode: string;
  notes: string;
  condition_id: number | string;
  practitioner_id: number | string;
  tags: string[];
}

export const INITIAL_TREATMENT_FORM_DATA: TreatmentFormData = {
  treatment_name: '',
  treatment_type: '',
  description: '',
  start_date: '',
  end_date: '',
  status: 'planned',
  dosage: '',
  frequency: '',
  mode: 'simple',
  notes: '',
  condition_id: '',
  practitioner_id: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. */
export const validateTreatmentForm = (
  form: TreatmentFormData,
  patientId?: number | null
): string | null => {
  if (!form.treatment_name.trim()) return 'Treatment name is required';
  if (
    form.end_date &&
    form.start_date &&
    new Date(form.end_date) < new Date(form.start_date)
  ) {
    return 'End date cannot be before start date';
  }
  if (!patientId) return 'Patient information not available';
  return null;
};

/**
 * Request body for creating or updating a treatment. Fields are listed explicitly so
 * form-only state (such as pending links) is never sent to the API.
 */
export const buildTreatmentPayload = (
  form: TreatmentFormData,
  patientId: number
) => ({
  treatment_name: form.treatment_name,
  treatment_type: form.treatment_type || null,
  description: form.description || null,
  start_date: form.start_date || null,
  end_date: form.end_date || null,
  status: form.status,
  dosage: form.dosage || null,
  frequency: form.frequency || null,
  mode: form.mode || 'simple',
  notes: form.notes || null,
  tags: form.tags || [],
  patient_id: patientId,
  condition_id: form.condition_id || null,
  practitioner_id: form.practitioner_id || null,
});
