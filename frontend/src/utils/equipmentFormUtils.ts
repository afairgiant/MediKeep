/** Form state of the Add/Edit Medical Equipment dialog. */
export interface EquipmentFormData {
  equipment_name: string;
  equipment_type: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  prescribed_date: string;
  last_service_date: string;
  next_service_date: string;
  usage_instructions: string;
  status: string;
  supplier: string;
  notes: string;
  practitioner_id: number | string;
  tags: string[];
}

export const INITIAL_EQUIPMENT_FORM_DATA: EquipmentFormData = {
  equipment_name: '',
  equipment_type: '',
  manufacturer: '',
  model_number: '',
  serial_number: '',
  prescribed_date: '',
  last_service_date: '',
  next_service_date: '',
  usage_instructions: '',
  status: 'active',
  supplier: '',
  notes: '',
  practitioner_id: '',
  tags: [],
};

/** Error message to show, or null when the form can be submitted. */
export const validateEquipmentForm = (
  form: EquipmentFormData,
  patientId?: number | null
): string | null => {
  if (!form.equipment_name.trim()) return 'Equipment name is required';
  if (!form.equipment_type) return 'Equipment type is required';
  if (!patientId) return 'Patient information not available';
  return null;
};

/**
 * Request body for creating or updating equipment. Fields are listed explicitly so
 * form-only state is never sent to the API.
 */
export const buildEquipmentPayload = (
  form: EquipmentFormData,
  patientId: number
) => ({
  equipment_name: form.equipment_name,
  equipment_type: form.equipment_type,
  manufacturer: form.manufacturer || null,
  model_number: form.model_number || null,
  serial_number: form.serial_number || null,
  prescribed_date: form.prescribed_date || null,
  last_service_date: form.last_service_date || null,
  next_service_date: form.next_service_date || null,
  usage_instructions: form.usage_instructions || null,
  status: form.status || 'active',
  supplier: form.supplier || null,
  notes: form.notes || null,
  tags: form.tags || [],
  patient_id: patientId,
  practitioner_id: form.practitioner_id
    ? parseInt(String(form.practitioner_id), 10)
    : null,
});
