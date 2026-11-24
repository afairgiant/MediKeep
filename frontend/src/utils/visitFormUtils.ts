import {
  invalidDateMessage,
  patientNotSelectedMessage,
  requiredFieldsMissingMessage,
} from './formCheckMessages';
import { usableOffsets } from './visitReminders';

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
  /** HH:MM; empty for an all-day visit. */
  visit_time: string;
  reminder_enabled: boolean;
  reminder_offsets: number[];
  reminder_include_details: boolean;
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
  visit_time: '',
  reminder_enabled: false,
  reminder_offsets: [],
  reminder_include_details: false,
};

/** Error message to show, or null when the form can be submitted. */
export const validateVisitForm = (
  form: VisitFormData,
  patientId?: number | null
): string | null => {
  if (!form.reason.trim()) return requiredFieldsMissingMessage();
  if (!form.date) return invalidDateMessage();
  if (!patientId) return patientNotSelectedMessage();
  return null;
};

/** Request body for creating or updating a visit (an "encounter" in the API). */
export const buildVisitPayload = (form: VisitFormData, patientId: number) => {
  // Hour-based offsets are kept while editing but can't fire without a start time
  const offsets = usableOffsets(
    form.reminder_offsets ?? [],
    Boolean(form.visit_time)
  );
  return {
    reason: form.reason,
    date: form.date,
    notes: form.notes || null,
    practitioner_id: form.practitioner_id || null,
    condition_id: form.condition_id
      ? parseInt(String(form.condition_id))
      : null,
    visit_type: form.visit_type || null,
    chief_complaint: form.chief_complaint || null,
    diagnosis: form.diagnosis || null,
    treatment_plan: form.treatment_plan || null,
    follow_up_instructions: form.follow_up_instructions || null,
    duration_minutes: form.duration_minutes || null,
    location: form.location || null,
    priority: form.priority || null,
    tags: form.tags || [],
    visit_time: form.visit_time || null,
    // Saved as off when nothing is left to fire, so the visit never claims reminders it can't send
    reminder_enabled: Boolean(form.reminder_enabled) && offsets.length > 0,
    reminder_offsets: offsets,
    reminder_include_details: Boolean(form.reminder_include_details),
    patient_id: patientId,
  };
};
