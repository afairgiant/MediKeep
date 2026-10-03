/** Form state of the Add/Edit Medication dialog. */
export interface MedicationFormData {
  medication_name: string;
  alternative_name: string;
  medication_type: string;
  dosage: string;
  frequency: string;
  route: string;
  indication: string;
  effective_period_start: string;
  effective_period_end: string;
  status: string;
  practitioner_id: string | number | null;
  pharmacy_id: string | number | null;
  notes: string;
  side_effects: string;
  tags?: string[];
  reminder_enabled: boolean;
  reminder_times: string[];
  reminder_days: number[] | null;
  reminder_message: string;
}

export const INITIAL_MEDICATION_FORM_DATA: MedicationFormData = {
  medication_name: '',
  alternative_name: '',
  medication_type: 'prescription',
  dosage: '',
  frequency: '',
  route: '',
  indication: '',
  effective_period_start: '',
  effective_period_end: '',
  status: 'active',
  practitioner_id: null,
  pharmacy_id: null,
  notes: '',
  side_effects: '',
  tags: [],
  reminder_enabled: false,
  reminder_times: [],
  reminder_days: null,
  reminder_message: '',
};

/** Error message to show, or null when the form can be submitted. Checked in this order. */
export const validateMedicationForm = (
  form: MedicationFormData,
  patientId?: number | null
): string | null => {
  if (!patientId) return 'Patient information not available';
  const name = form.medication_name?.trim() || '';
  if (!name) return 'Medication name is required';
  if (name.length < 2)
    return 'Medication name must be at least 2 characters long';
  return null;
};

/**
 * Request body for creating or updating a medication. Fields are listed explicitly so
 * form-only state (linked conditions, pending visit links) is never sent to the API.
 */
export const buildMedicationPayload = (
  form: MedicationFormData,
  patientId: number
) => {
  const payload: Record<string, unknown> = {
    medication_name: form.medication_name?.trim() || '',
    alternative_name: form.alternative_name?.trim() || null,
    medication_type: form.medication_type || 'prescription',
    dosage: form.dosage?.trim() || null,
    frequency: form.frequency?.trim() || null,
    route: form.route?.trim() || null,
    indication: form.indication?.trim() || null,
    status: form.status || 'active',
    patient_id: patientId,
    practitioner_id: form.practitioner_id
      ? parseInt(String(form.practitioner_id))
      : null,
    pharmacy_id: form.pharmacy_id ? parseInt(String(form.pharmacy_id)) : null,
    notes: form.notes?.trim() || null,
    side_effects: form.side_effects?.trim() || null,
    tags: form.tags || [],
    reminder_enabled: Boolean(form.reminder_enabled),
    reminder_times: Array.isArray(form.reminder_times)
      ? form.reminder_times.filter(Boolean)
      : [],
    reminder_days:
      Array.isArray(form.reminder_days) && form.reminder_days.length
        ? form.reminder_days
        : null,
    reminder_message: form.reminder_message?.trim() || null,
  };
  // Dates are only sent when set
  if (form.effective_period_start) {
    payload.effective_period_start = form.effective_period_start;
  }
  if (form.effective_period_end) {
    payload.effective_period_end = form.effective_period_end;
  }
  return payload;
};
