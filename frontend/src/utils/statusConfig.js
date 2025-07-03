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
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
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
    color: '#2d5a2d',
    backgroundColor: '#e8f5e8',
    borderColor: '#c3e6c3',
    icon: '🟢',
  },
  
  // Inactive/Stopped states - Gray
  inactive: {
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    borderColor: '#dee2e6',
    icon: '⚫',
  },
  
  // Completed/Resolved states - Blue
  completed: {
    color: '#0d47a1',
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
    icon: '✅',
  },
  resolved: {
    color: '#0d47a1',
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
    icon: '✅',
  },
  
  // Cancelled states - Red
  cancelled: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    icon: '❌',
  },
  
  // On Hold/Paused states - Orange
  on_hold: {
    color: '#856404',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    icon: '⏸️',
  },
  
  // In Progress states - Blue
  in_progress: {
    color: '#0c5460',
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    icon: '🔄',
  },
  
  // Chronic states - Purple
  chronic: {
    color: '#495057',
    backgroundColor: '#e9ecef',
    borderColor: '#ced4da',
    icon: '🔵',
  },
  
  // Special condition states
  recurrence: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    icon: '🔄',
  },
  relapse: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    icon: '⚠️',
  },
  
  // Lab/Procedure specific
  ordered: {
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    borderColor: '#dee2e6',
    icon: '📋',
  },
  scheduled: {
    color: '#0c5460',
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    icon: '📅',
  },
};

// Severity Badge Colors
export const SEVERITY_STYLES = {
  mild: {
    color: '#2d5a2d',
    backgroundColor: '#e8f5e8',
    borderColor: '#c3e6c3',
    icon: '🟢',
  },
  moderate: {
    color: '#856404',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    icon: '🟡',
  },
  severe: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    icon: '🟠',
  },
  critical: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
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