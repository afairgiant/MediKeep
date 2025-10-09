/**
 * Unified Status Configuration
 * 
 * Standardized status values and labels for all medical entities.
 * This ensures consistency across the application and matches the backend enums.
 */

// Condition Status Options
export const CONDITION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active - Currently being treated' },
  { value: 'inactive', label: 'Inactive - Not currently treated' },
  { value: 'resolved', label: 'Resolved - No longer an issue' },
  { value: 'chronic', label: 'Chronic - Long-term condition' },
  { value: 'recurrence', label: 'Recurrence - Condition has returned' },
  { value: 'relapse', label: 'Relapse - Condition has worsened' },
];

// Medication Status Options
export const MEDICATION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active - Currently taking' },
  { value: 'inactive', label: 'Inactive - No longer taking' },
  { value: 'on_hold', label: 'On Hold - Temporarily stopped' },
  { value: 'completed', label: 'Completed - Finished course' },
  { value: 'cancelled', label: 'Cancelled - Prescription cancelled' },
];

// Allergy Status Options
export const ALLERGY_STATUS_OPTIONS = [
  { value: 'active', label: 'Active - Current allergy' },
  { value: 'inactive', label: 'Inactive - No longer relevant' },
  { value: 'resolved', label: 'Resolved - No longer allergic' },
];

// Lab Result Status Options
export const LAB_RESULT_STATUS_OPTIONS = [
  { value: 'ordered', label: 'Ordered - Test has been ordered' },
  { value: 'in_progress', label: 'In Progress - Sample collected' },
  { value: 'completed', label: 'Completed - Results available' },
  { value: 'cancelled', label: 'Cancelled - Test cancelled' },
];

// Procedure Status Options
export const PROCEDURE_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled - Procedure planned' },
  { value: 'in_progress', label: 'In Progress - Currently performing' },
  { value: 'completed', label: 'Completed - Procedure finished' },
  { value: 'cancelled', label: 'Cancelled - Procedure cancelled' },
];

// Treatment Status Options
export const TREATMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active - Currently receiving treatment' },
  { value: 'in_progress', label: 'In Progress - Treatment ongoing' },
  { value: 'completed', label: 'Completed - Treatment finished' },
  { value: 'cancelled', label: 'Cancelled - Treatment stopped' },
  { value: 'on_hold', label: 'On Hold - Treatment paused' },
];

// Severity Level Options
export const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild - Minor impact' },
  { value: 'moderate', label: 'Moderate - Noticeable impact' },
  { value: 'severe', label: 'Severe - Significant impact' },
  { value: 'critical', label: 'Critical - Life-threatening' },
];

// Encounter Priority Options
export const ENCOUNTER_PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine - Regular appointment' },
  { value: 'urgent', label: 'Urgent - Needs prompt attention' },
  { value: 'emergency', label: 'Emergency - Immediate care required' },
];

// Emergency Contact Relationship Options
export const EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'child', label: 'Child' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandmother', label: 'Grandmother' },
  { value: 'grandfather', label: 'Grandfather' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'grandson', label: 'Grandson' },
  { value: 'granddaughter', label: 'Granddaughter' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'cousin', label: 'Cousin' },
  { value: 'friend', label: 'Friend' },
  { value: 'neighbor', label: 'Neighbor' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

// Status Badge Colors and Icons
export const STATUS_STYLES = {
  // Active states - Green
  active: {
    color: 'var(--mantine-color-green-8)',
    backgroundColor: 'var(--mantine-color-green-1)',
    borderColor: 'var(--mantine-color-green-3)',
    icon: '🟢',
  },
  
  // Inactive/Stopped states - Gray
  inactive: {
    color: 'var(--mantine-color-gray-6)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    borderColor: 'var(--mantine-color-gray-3)',
    icon: '⚫',
  },
  
  // Completed/Resolved states - Blue
  completed: {
    color: 'var(--mantine-color-blue-8)',
    backgroundColor: 'var(--mantine-color-blue-1)',
    borderColor: 'var(--mantine-color-blue-3)',
    icon: '✅',
  },
  resolved: {
    color: 'var(--mantine-color-blue-8)',
    backgroundColor: 'var(--mantine-color-blue-1)',
    borderColor: 'var(--mantine-color-blue-3)',
    icon: '✅',
  },
  
  // Cancelled states - Red
  cancelled: {
    color: 'var(--mantine-color-red-8)',
    backgroundColor: 'var(--mantine-color-red-1)',
    borderColor: 'var(--mantine-color-red-3)',
    icon: '❌',
  },
  
  // On Hold/Paused states - Orange
  on_hold: {
    color: 'var(--mantine-color-yellow-8)',
    backgroundColor: 'var(--mantine-color-yellow-1)',
    borderColor: 'var(--mantine-color-yellow-3)',
    icon: '⏸️',
  },
  
  // In Progress states - Blue
  in_progress: {
    color: 'var(--mantine-color-cyan-8)',
    backgroundColor: 'var(--mantine-color-cyan-1)',
    borderColor: 'var(--mantine-color-cyan-3)',
    icon: '🔄',
  },
  
  // Chronic states - Purple
  chronic: {
    color: 'var(--mantine-color-gray-7)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    borderColor: 'var(--mantine-color-gray-4)',
    icon: '🔵',
  },
  
  // Special condition states
  recurrence: {
    color: 'var(--mantine-color-red-8)',
    backgroundColor: 'var(--mantine-color-red-1)',
    borderColor: 'var(--mantine-color-red-3)',
    icon: '🔄',
  },
  relapse: {
    color: 'var(--mantine-color-red-8)',
    backgroundColor: 'var(--mantine-color-red-1)',
    borderColor: 'var(--mantine-color-red-3)',
    icon: '⚠️',
  },
  
  // Lab/Procedure specific
  ordered: {
    color: 'var(--mantine-color-gray-6)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    borderColor: 'var(--mantine-color-gray-3)',
    icon: '📋',
  },
  scheduled: {
    color: 'var(--mantine-color-cyan-8)',
    backgroundColor: 'var(--mantine-color-cyan-1)',
    borderColor: 'var(--mantine-color-cyan-3)',
    icon: '📅',
  },
};

// Severity Badge Colors
export const SEVERITY_STYLES = {
  mild: {
    color: 'var(--mantine-color-green-8)',
    backgroundColor: 'var(--mantine-color-green-1)',
    borderColor: 'var(--mantine-color-green-3)',
    icon: '🟢',
  },
  moderate: {
    color: 'var(--mantine-color-yellow-8)',
    backgroundColor: 'var(--mantine-color-yellow-1)',
    borderColor: 'var(--mantine-color-yellow-3)',
    icon: '🟡',
  },
  severe: {
    color: 'var(--mantine-color-orange-8)',
    backgroundColor: 'var(--mantine-color-orange-1)',
    borderColor: 'var(--mantine-color-orange-3)',
    icon: '🟠',
  },
  critical: {
    color: 'var(--mantine-color-red-8)',
    backgroundColor: 'var(--mantine-color-red-1)',
    borderColor: 'var(--mantine-color-red-3)',
    icon: '🔴',
  },
};

// Helper function to get status style
export const getStatusStyle = (status) => {
  return STATUS_STYLES[status] || STATUS_STYLES.inactive;
};

// Helper function to get severity style
export const getSeverityStyle = (severity) => {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.mild;
};

// Helper function to format status display
export const formatStatusDisplay = (status) => {
  const style = getStatusStyle(status);
  return {
    text: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    icon: style.icon,
    style: style,
  };
};

// Helper function to format severity display
export const formatSeverityDisplay = (severity) => {
  const style = getSeverityStyle(severity);
  return {
    text: severity.charAt(0).toUpperCase() + severity.slice(1),
    icon: style.icon,
    style: style,
  };
};