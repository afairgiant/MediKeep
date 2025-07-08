import {
  IconPill,
  IconFlask,
  IconMedicalCross,
  IconBrain,
  IconAlertTriangle,
  IconVaccine,
  IconHeartbeat,
  IconPhoneCall,
  IconClipboardList,
  IconCalendarEvent,
  IconUser,
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
} from '@tabler/icons-react';

/**
 * Maps medical record model names to their corresponding route paths
 */
const ROUTE_MAPPING = {
  medication: '/medications',
  'medical medication': '/medications',
  lab_result: '/lab-results',
  'lab result': '/lab-results',
  'medical lab result': '/lab-results',
  procedure: '/procedures',
  'medical procedure': '/procedures',
  condition: '/conditions',
  'medical condition': '/conditions',
  allergy: '/allergies',
  'medical allergy': '/allergies',
  immunization: '/immunizations',
  'medical immunization': '/immunizations',
  vital: '/vitals',
  'vital sign': '/vitals',
  'medical vital': '/vitals',
  emergency_contact: '/emergency-contacts',
  'emergency contact': '/emergency-contacts',
  treatment: '/treatments',
  'medical treatment': '/treatments',
  encounter: '/visits',
  visit: '/visits',
  'medical visit': '/visits',
  patient: '/patients/me',
  'medical patient': '/patients/me',
};

/**
 * Maps medical record model names to their corresponding icons
 */
const ICON_MAPPING = {
  medication: IconPill,
  'medical medication': IconPill,
  lab_result: IconFlask,
  'lab result': IconFlask,
  'medical lab result': IconFlask,
  procedure: IconMedicalCross,
  'medical procedure': IconMedicalCross,
  condition: IconBrain,
  'medical condition': IconBrain,
  allergy: IconAlertTriangle,
  'medical allergy': IconAlertTriangle,
  immunization: IconVaccine,
  'medical immunization': IconVaccine,
  vital: IconHeartbeat,
  'vital sign': IconHeartbeat,
  'medical vital': IconHeartbeat,
  emergency_contact: IconPhoneCall,
  'emergency contact': IconPhoneCall,
  treatment: IconClipboardList,
  'medical treatment': IconClipboardList,
  encounter: IconCalendarEvent,
  visit: IconCalendarEvent,
  'medical visit': IconCalendarEvent,
  patient: IconUser,
  'medical patient': IconUser,
};

/**
 * Maps action types to their corresponding colors for badges
 */
const ACTION_COLOR_MAPPING = {
  created: 'green',
  updated: 'blue',
  deleted: 'red',
  added: 'green',
  modified: 'blue',
  removed: 'red',
  completed: 'teal',
  cancelled: 'gray',
  scheduled: 'yellow',
  viewed: 'indigo',
};

/**
 * Maps action types to their corresponding icons
 */
const ACTION_ICON_MAPPING = {
  created: IconPlus,
  updated: IconEdit,
  deleted: IconTrash,
  added: IconPlus,
  modified: IconEdit,
  removed: IconTrash,
  completed: IconEdit,
  cancelled: IconTrash,
  scheduled: IconCalendarEvent,
  viewed: IconEye,
};

/**
 * Generates the appropriate navigation URL for a given activity
 * @param {Object} activity - The activity object with id, model_name, and action
 * @param {boolean} includeHash - Whether to include hash for record highlighting
 * @returns {string|null} - The URL to navigate to, or null if navigation not supported
 */
export const getActivityNavigationUrl = (activity, includeHash = true) => {
  if (!activity || !activity.model_name) {
    return null;
  }

  const modelName = activity.model_name.toLowerCase();
  const basePath = ROUTE_MAPPING[modelName];

  if (!basePath) {
    console.warn(`No route mapping found for model: ${modelName}`);
    return null;
  }

  // For patient records, navigate directly to the patient info page
  if (modelName === 'patient') {
    return basePath;
  }

  // For most medical records, navigate to the list page with hash for highlighting
  if (includeHash && activity.id) {
    return `${basePath}#record-${activity.id}`;
  }

  return basePath;
};

/**
 * Gets the appropriate icon component for a given model name
 * @param {string} modelName - The model name from the activity
 * @returns {React.Component|null} - The icon component or null if not found
 */
export const getActivityIcon = (modelName) => {
  if (!modelName) {
    return null;
  }

  const normalizedModelName = modelName.toLowerCase();
  return ICON_MAPPING[normalizedModelName] || null;
};

/**
 * Gets the appropriate color for an action badge
 * @param {string} action - The action performed (created, updated, deleted, etc.)
 * @returns {string} - The Mantine color name for the badge
 */
export const getActionBadgeColor = (action) => {
  if (!action) {
    return 'gray';
  }

  const normalizedAction = action.toLowerCase();
  return ACTION_COLOR_MAPPING[normalizedAction] || 'gray';
};

/**
 * Gets the appropriate icon for an action
 * @param {string} action - The action performed (created, updated, deleted, etc.)
 * @returns {React.Component|null} - The icon component for the action
 */
export const getActionIcon = (action) => {
  if (!action) {
    return null;
  }

  const normalizedAction = action.toLowerCase();
  return ACTION_ICON_MAPPING[normalizedAction] || null;
};

/**
 * Formats the activity description for better readability
 * @param {Object} activity - The activity object
 * @returns {string} - The formatted description
 */
export const formatActivityDescription = (activity) => {
  if (!activity || !activity.description) {
    return 'Unknown activity';
  }

  // If description is already well-formatted, return as is
  if (activity.description.length > 50) {
    return activity.description;
  }

  // For shorter descriptions, try to enhance them with context
  const { model_name, action, description } = activity;
  
  if (model_name && action) {
    const modelDisplayName = getModelDisplayName(model_name);
    const actionDisplayName = getActionDisplayName(action);
    
    // If the description doesn't already include the model name, add context
    if (!description.toLowerCase().includes(modelDisplayName.toLowerCase())) {
      return `${actionDisplayName} ${modelDisplayName.toLowerCase()}: ${description}`;
    }
  }

  return description;
};

/**
 * Gets a human-readable display name for a model
 * @param {string} modelName - The model name
 * @returns {string} - The display name
 */
export const getModelDisplayName = (modelName) => {
  const displayNames = {
    medication: 'Medication',
    'medical medication': 'Medication',
    lab_result: 'Lab Result',
    'lab result': 'Lab Result',
    'medical lab result': 'Lab Result',
    procedure: 'Procedure',
    'medical procedure': 'Procedure',
    condition: 'Condition',
    'medical condition': 'Condition',
    allergy: 'Allergy',
    'medical allergy': 'Allergy',
    immunization: 'Immunization',
    'medical immunization': 'Immunization',
    vital: 'Vital Signs',
    'vital sign': 'Vital Signs',
    'medical vital': 'Vital Signs',
    emergency_contact: 'Emergency Contact',
    'emergency contact': 'Emergency Contact',
    treatment: 'Treatment',
    'medical treatment': 'Treatment',
    encounter: 'Visit',
    visit: 'Visit',
    'medical visit': 'Visit',
    patient: 'Patient Information',
    'medical patient': 'Patient Information',
  };

  return displayNames[modelName?.toLowerCase()] || modelName || 'Record';
};

/**
 * Gets a human-readable display name for an action
 * @param {string} action - The action name
 * @returns {string} - The display name
 */
export const getActionDisplayName = (action) => {
  const displayNames = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    added: 'Added',
    modified: 'Modified',
    removed: 'Removed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    scheduled: 'Scheduled',
    viewed: 'Viewed',
  };

  return displayNames[action?.toLowerCase()] || action || 'Modified';
};

/**
 * Determines if an activity should be clickable
 * @param {Object} activity - The activity object
 * @returns {boolean} - Whether the activity should be clickable
 */
export const isActivityClickable = (activity) => {
  if (!activity || !activity.model_name) {
    return false;
  }

  // Don't make deleted items clickable since the record no longer exists
  if (activity.action?.toLowerCase() === 'deleted' || activity.action?.toLowerCase() === 'removed') {
    return false;
  }

  // Check if we have a route mapping for this model
  const url = getActivityNavigationUrl(activity);
  return url !== null;
};

/**
 * Gets a tooltip text for an activity item
 * @param {Object} activity - The activity object
 * @returns {string} - The tooltip text
 */
export const getActivityTooltip = (activity) => {
  if (!activity) {
    return '';
  }

  const isClickable = isActivityClickable(activity);
  const modelDisplayName = getModelDisplayName(activity.model_name);

  if (isClickable) {
    return `Click to go to ${modelDisplayName.toLowerCase()}`;
  } else if (activity.action?.toLowerCase() === 'deleted') {
    return `${modelDisplayName} was deleted`;
  } else {
    return `View ${modelDisplayName.toLowerCase()}`;
  }
};

/**
 * Gets filter options for activity filtering
 * @returns {Array} - Array of filter options
 */
export const getActivityFilterOptions = () => {
  return [
    { value: 'all', label: 'All Activity' },
    { value: 'medication', label: 'Medications' },
    { value: 'lab_result', label: 'Lab Results' },
    { value: 'procedure', label: 'Procedures' },
    { value: 'condition', label: 'Conditions' },
    { value: 'allergy', label: 'Allergies' },
    { value: 'immunization', label: 'Immunizations' },
    { value: 'vital', label: 'Vital Signs' },
    { value: 'emergency_contact', label: 'Emergency Contacts' },
    { value: 'treatment', label: 'Treatments' },
    { value: 'encounter', label: 'Visits' },
    { value: 'patient', label: 'Patient Info' },
  ];
};

/**
 * Gets action filter options for activity filtering
 * @returns {Array} - Array of action filter options
 */
export const getActionFilterOptions = () => {
  return [
    { value: 'all', label: 'All Actions' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'completed', label: 'Completed' },
    { value: 'scheduled', label: 'Scheduled' },
  ];
};

/**
 * Filters activities based on type and action filters
 * @param {Array} activities - Array of activity objects
 * @param {string} typeFilter - Type filter ('all' or specific model name)
 * @param {string} actionFilter - Action filter ('all' or specific action)
 * @returns {Array} - Filtered activities
 */
export const filterActivities = (activities, typeFilter = 'all', actionFilter = 'all') => {
  if (!Array.isArray(activities)) {
    return [];
  }

  return activities.filter(activity => {
    const typeMatch = typeFilter === 'all' || activity.model_name?.toLowerCase() === typeFilter;
    const actionMatch = actionFilter === 'all' || activity.action?.toLowerCase() === actionFilter;
    
    return typeMatch && actionMatch;
  });
};

/**
 * Groups activities by a specified field
 * @param {Array} activities - Array of activity objects
 * @param {string} groupBy - Field to group by ('date', 'model_name', 'action')
 * @returns {Object} - Grouped activities
 */
export const groupActivities = (activities, groupBy = 'date') => {
  if (!Array.isArray(activities)) {
    return {};
  }

  return activities.reduce((groups, activity) => {
    let key;
    
    switch (groupBy) {
      case 'date':
        key = new Date(activity.timestamp).toDateString();
        break;
      case 'model_name':
        key = getModelDisplayName(activity.model_name);
        break;
      case 'action':
        key = getActionDisplayName(activity.action);
        break;
      default:
        key = 'Other';
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    
    groups[key].push(activity);
    return groups;
  }, {});
};