/**
 * Equipment Constants
 *
 * Shared constants for medical equipment across the application.
 * This centralizes equipment type labels, status options, and related utilities.
 */

/**
 * Equipment type options for form select fields
 * Used in: EquipmentFormWrapper, TreatmentEquipmentRelationships
 */
export const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'cpap', label: 'CPAP Machine' },
  { value: 'bipap', label: 'BiPAP Machine' },
  { value: 'nebulizer', label: 'Nebulizer' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'blood_pressure_monitor', label: 'Blood Pressure Monitor' },
  { value: 'glucose_monitor', label: 'Glucose Monitor' },
  { value: 'pulse_oximeter', label: 'Pulse Oximeter' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'walker', label: 'Walker' },
  { value: 'cane', label: 'Cane' },
  { value: 'crutches', label: 'Crutches' },
  { value: 'oxygen_concentrator', label: 'Oxygen Concentrator' },
  { value: 'oxygen_tank', label: 'Oxygen Tank' },
  { value: 'hearing_aid', label: 'Hearing Aid' },
  { value: 'insulin_pump', label: 'Insulin Pump' },
  { value: 'continuous_glucose_monitor', label: 'Continuous Glucose Monitor' },
  { value: 'tens_unit', label: 'TENS Unit' },
  { value: 'brace', label: 'Brace' },
  { value: 'prosthetic', label: 'Prosthetic' },
  { value: 'other', label: 'Other' },
];

/**
 * Equipment type labels lookup map
 * Used for displaying equipment type labels from type values
 */
export const EQUIPMENT_TYPE_LABELS = Object.fromEntries(
  EQUIPMENT_TYPE_OPTIONS.map(option => [option.value, option.label])
);

/**
 * Equipment status options for form select fields
 */
export const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
];

/**
 * Status color mapping for badges
 */
const STATUS_COLORS = {
  active: 'green',
  inactive: 'gray',
  replaced: 'blue',
  returned: 'orange',
  lost: 'red',
};

/**
 * Get the display label for an equipment type
 * @param {string} type - The equipment type value
 * @returns {string|null} The display label or the raw value for custom types
 */
export function getEquipmentTypeLabel(type) {
  if (!type) return null;
  return EQUIPMENT_TYPE_LABELS[type] || type;
}

/**
 * Get the color for an equipment status badge
 * @param {string} status - The equipment status
 * @returns {string} The color name for Mantine Badge
 */
export function getEquipmentStatusColor(status) {
  return STATUS_COLORS[status] || 'gray';
}

/**
 * Format an equipment item for display in select options
 * @param {Object} equipment - The equipment object
 * @returns {string} Formatted label string
 */
export function formatEquipmentLabel(equipment) {
  let label = equipment.equipment_name;
  const typeLabel = getEquipmentTypeLabel(equipment.equipment_type);
  if (typeLabel) {
    label += ` (${typeLabel})`;
  }
  if (equipment.status && equipment.status !== 'active') {
    label += ` - ${equipment.status}`;
  }
  return label;
}
