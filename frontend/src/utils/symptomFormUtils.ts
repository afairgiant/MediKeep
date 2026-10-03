import { ERROR_MESSAGES } from '../constants/errorMessages';
import { getTodayString } from './dateUtils';

/** Form state of the Add/Edit Symptom dialog. */
export interface SymptomFormData {
  symptom_name: string;
  category: string;
  first_occurrence_date: string;
  status: string;
  is_chronic: boolean;
  resolved_date: string;
  typical_triggers: string[];
  general_notes: string;
  tags: string[];
}

/** A fresh Add form: the first occurrence defaults to today. */
export const createInitialSymptomFormData = (): SymptomFormData => ({
  symptom_name: '',
  category: '',
  first_occurrence_date: getTodayString(),
  status: 'active',
  is_chronic: false,
  resolved_date: '',
  typical_triggers: [],
  general_notes: '',
  tags: [],
});

interface FieldTarget {
  name: string;
  value: unknown;
  type?: string;
  checked?: boolean;
}

/**
 * Applies one field change. Setting the status to "resolved" fills the resolved
 * date with today (when empty); moving away from "resolved" clears it.
 */
export const applySymptomInputChange = <T extends SymptomFormData>(
  prev: T,
  { name, value, type, checked }: FieldTarget
): T => {
  const updated = {
    ...prev,
    [name]: type === 'checkbox' ? checked : value,
  };
  if (name === 'status') {
    if (value === 'resolved' && !prev.resolved_date) {
      updated.resolved_date = getTodayString();
    } else if (value !== 'resolved') {
      updated.resolved_date = '';
    }
  }
  return updated;
};

/** Error message to show, or null when the form can be submitted. */
export const validateSymptomForm = (
  form: SymptomFormData,
  patientId?: number | null
): string | null => {
  if (!patientId) return 'Patient information not available';
  if (!form.symptom_name.trim()) return ERROR_MESSAGES.REQUIRED_FIELD_MISSING;
  return null;
};

/**
 * Request body for creating or updating a symptom. Fields are listed explicitly so
 * form-only state (such as pending visit links) is never sent to the API.
 */
export const buildSymptomPayload = (
  form: SymptomFormData,
  patientId: number
) => ({
  symptom_name: form.symptom_name,
  category: form.category,
  first_occurrence_date: form.first_occurrence_date,
  status: form.status,
  is_chronic: form.is_chronic,
  resolved_date: form.resolved_date || null,
  typical_triggers: form.typical_triggers,
  general_notes: form.general_notes,
  tags: form.tags,
  patient_id: patientId,
});
