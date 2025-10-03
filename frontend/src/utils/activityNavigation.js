import logger from '../services/logger';

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
  IconShieldCheck,
} from '@tabler/icons-react';
import { ENTITY_TYPES } from './entityRelationships';
import { buildEntityUrl } from './entityNavigation';

/**
 * Maps medical record model names to their corresponding entity types
 */
const MODEL_TO_ENTITY_TYPE = {
  medication: ENTITY_TYPES.MEDICATION,
  'medical medication': ENTITY_TYPES.MEDICATION,
  lab_result: ENTITY_TYPES.LAB_RESULT,
  'lab result': ENTITY_TYPES.LAB_RESULT,
  'medical lab result': ENTITY_TYPES.LAB_RESULT,
  procedure: ENTITY_TYPES.PROCEDURE,
  'medical procedure': ENTITY_TYPES.PROCEDURE,
  condition: ENTITY_TYPES.CONDITION,
  'medical condition': ENTITY_TYPES.CONDITION,
  allergy: ENTITY_TYPES.ALLERGY,
  'medical allergy': ENTITY_TYPES.ALLERGY,
  immunization: ENTITY_TYPES.IMMUNIZATION,
  'medical immunization': ENTITY_TYPES.IMMUNIZATION,
  vital: ENTITY_TYPES.VITALS,
  vitals: ENTITY_TYPES.VITALS,
  'vital sign': ENTITY_TYPES.VITALS,
  'vital signs': ENTITY_TYPES.VITALS,
  'medical vital': ENTITY_TYPES.VITALS,
  'medical vitals': ENTITY_TYPES.VITALS,
  emergency_contact: ENTITY_TYPES.EMERGENCY_CONTACT,
  'emergency contact': ENTITY_TYPES.EMERGENCY_CONTACT,
  treatment: ENTITY_TYPES.TREATMENT,
  'medical treatment': ENTITY_TYPES.TREATMENT,
  encounter: ENTITY_TYPES.ENCOUNTER,
  visit: ENTITY_TYPES.ENCOUNTER,
  'medical visit': ENTITY_TYPES.ENCOUNTER,
  pharmacy: ENTITY_TYPES.PHARMACY,
  'medical pharmacy': ENTITY_TYPES.PHARMACY,
  practitioner: ENTITY_TYPES.PRACTITIONER,
  'medical practitioner': ENTITY_TYPES.PRACTITIONER,
  doctor: ENTITY_TYPES.PRACTITIONER,
  'medical doctor': ENTITY_TYPES.PRACTITIONER,
  patient: ENTITY_TYPES.PATIENT,
  'medical patient': ENTITY_TYPES.PATIENT,
  insurance: ENTITY_TYPES.INSURANCE,
  'medical insurance': ENTITY_TYPES.INSURANCE,
};

/**
 * Maps entity types to their corresponding route paths
 */
const ENTITY_TYPE_TO_ROUTE = {
  [ENTITY_TYPES.MEDICATION]: '/medications',
  [ENTITY_TYPES.LAB_RESULT]: '/lab-results',
  [ENTITY_TYPES.PROCEDURE]: '/procedures',
  [ENTITY_TYPES.CONDITION]: '/conditions',
  [ENTITY_TYPES.ALLERGY]: '/allergies',
  [ENTITY_TYPES.IMMUNIZATION]: '/immunizations',
  [ENTITY_TYPES.VITALS]: '/vitals',
  [ENTITY_TYPES.EMERGENCY_CONTACT]: '/emergency-contacts',
  [ENTITY_TYPES.TREATMENT]: '/treatments',
  [ENTITY_TYPES.ENCOUNTER]: '/visits',
  [ENTITY_TYPES.PHARMACY]: '/pharmacies',
  [ENTITY_TYPES.PRACTITIONER]: '/practitioners',
  [ENTITY_TYPES.PATIENT]: '/patients/me',
  [ENTITY_TYPES.INSURANCE]: '/insurance',
};

/**
 * Maps entity types to their corresponding icons
 */
const ENTITY_TYPE_TO_ICON = {
  [ENTITY_TYPES.MEDICATION]: IconPill,
  [ENTITY_TYPES.LAB_RESULT]: IconFlask,
  [ENTITY_TYPES.PROCEDURE]: IconMedicalCross,
  [ENTITY_TYPES.CONDITION]: IconBrain,
  [ENTITY_TYPES.ALLERGY]: IconAlertTriangle,
  [ENTITY_TYPES.IMMUNIZATION]: IconVaccine,
  [ENTITY_TYPES.VITALS]: IconHeartbeat,
  [ENTITY_TYPES.EMERGENCY_CONTACT]: IconPhoneCall,
  [ENTITY_TYPES.TREATMENT]: IconClipboardList,
  [ENTITY_TYPES.ENCOUNTER]: IconCalendarEvent,
  [ENTITY_TYPES.PHARMACY]: IconPill,
  [ENTITY_TYPES.PRACTITIONER]: IconUser,
  [ENTITY_TYPES.PATIENT]: IconUser,
  [ENTITY_TYPES.INSURANCE]: IconShieldCheck,
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
 * @param {boolean} includeViewParam - Whether to include view parameter for direct linking
 * @returns {string|null} - The URL to navigate to, or null if navigation not supported
 */
export const getActivityNavigationUrl = (activity, includeViewParam = true) => {
  if (!activity || !activity.model_name) {
    return null;
  }

  const modelName = activity.model_name.toLowerCase();
  const entityType = MODEL_TO_ENTITY_TYPE[modelName];

  if (!entityType) {
    logger.warn(`No entity type mapping found for model: ${modelName}`);
    return null;
  }

  const basePath = ENTITY_TYPE_TO_ROUTE[entityType];

  if (!basePath) {
    logger.warn(`No route mapping found for entity type: ${entityType}`);
    return null;
  }

  // For patient records, navigate directly to the patient info page
  if (entityType === ENTITY_TYPES.PATIENT) {
    return basePath;
  }

  // For most medical records, navigate to the list page with view parameter for direct linking
  if (includeViewParam && activity.id) {
    return buildEntityUrl(entityType, activity.id, { autoOpen: true });
  }

  return basePath;
};

/**
 * Gets the appropriate icon component for a given model name
 * @param {string} modelName - The model name from the activity
 * @returns {React.Component|null} - The icon component or null if not found
 */
export const getActivityIcon = modelName => {
  if (!modelName) {
    return null;
  }

  const normalizedModelName = modelName.toLowerCase();
  const entityType = MODEL_TO_ENTITY_TYPE[normalizedModelName];
  
  if (!entityType) {
    return null;
  }

  return ENTITY_TYPE_TO_ICON[entityType] || null;
};

/**
 * Gets the appropriate color for an action badge
 * @param {string} action - The action performed (created, updated, deleted, etc.)
 * @returns {string} - The Mantine color name for the badge
 */
export const getActionBadgeColor = action => {
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
export const getActionIcon = action => {
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
export const formatActivityDescription = activity => {
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
 * Maps entity types to their display names
 */
const ENTITY_TYPE_TO_DISPLAY_NAME = {
  [ENTITY_TYPES.MEDICATION]: 'Medication',
  [ENTITY_TYPES.LAB_RESULT]: 'Lab Result',
  [ENTITY_TYPES.PROCEDURE]: 'Procedure',
  [ENTITY_TYPES.CONDITION]: 'Condition',
  [ENTITY_TYPES.ALLERGY]: 'Allergy',
  [ENTITY_TYPES.IMMUNIZATION]: 'Immunization',
  [ENTITY_TYPES.VITALS]: 'Vital Signs',
  [ENTITY_TYPES.EMERGENCY_CONTACT]: 'Emergency Contact',
  [ENTITY_TYPES.TREATMENT]: 'Treatment',
  [ENTITY_TYPES.ENCOUNTER]: 'Visit',
  [ENTITY_TYPES.PHARMACY]: 'Pharmacy',
  [ENTITY_TYPES.PRACTITIONER]: 'Practitioner',
  [ENTITY_TYPES.PATIENT]: 'Patient Information',
  [ENTITY_TYPES.INSURANCE]: 'Insurance',
};

/**
 * Gets a human-readable display name for a model
 * @param {string} modelName - The model name
 * @returns {string} - The display name
 */
export const getModelDisplayName = modelName => {
  if (!modelName) {
    return 'Record';
  }

  const normalizedModelName = modelName.toLowerCase();
  const entityType = MODEL_TO_ENTITY_TYPE[normalizedModelName];
  
  if (!entityType) {
    return modelName;
  }

  return ENTITY_TYPE_TO_DISPLAY_NAME[entityType] || modelName;
};

/**
 * Gets a human-readable display name for an action
 * @param {string} action - The action name
 * @returns {string} - The display name
 */
export const getActionDisplayName = action => {
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
export const isActivityClickable = activity => {
  if (!activity || !activity.model_name) {
    return false;
  }

  // Don't make deleted items clickable since the record no longer exists
  if (
    activity.action?.toLowerCase() === 'deleted' ||
    activity.action?.toLowerCase() === 'removed'
  ) {
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
export const getActivityTooltip = activity => {
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
    { value: ENTITY_TYPES.MEDICATION, label: 'Medications' },
    { value: ENTITY_TYPES.LAB_RESULT, label: 'Lab Results' },
    { value: ENTITY_TYPES.PROCEDURE, label: 'Procedures' },
    { value: ENTITY_TYPES.CONDITION, label: 'Conditions' },
    { value: ENTITY_TYPES.ALLERGY, label: 'Allergies' },
    { value: ENTITY_TYPES.IMMUNIZATION, label: 'Immunizations' },
    { value: ENTITY_TYPES.VITALS, label: 'Vital Signs' },
    { value: ENTITY_TYPES.EMERGENCY_CONTACT, label: 'Emergency Contacts' },
    { value: ENTITY_TYPES.TREATMENT, label: 'Treatments' },
    { value: ENTITY_TYPES.ENCOUNTER, label: 'Visits' },
    { value: ENTITY_TYPES.PHARMACY, label: 'Pharmacies' },
    { value: ENTITY_TYPES.PRACTITIONER, label: 'Practitioners' },
    { value: ENTITY_TYPES.PATIENT, label: 'Patient Info' },
    { value: ENTITY_TYPES.INSURANCE, label: 'Insurance' },
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
export const filterActivities = (
  activities,
  typeFilter = 'all',
  actionFilter = 'all'
) => {
  if (!Array.isArray(activities)) {
    return [];
  }

  return activities.filter(activity => {
    const modelName = activity.model_name?.toLowerCase();
    const entityType = MODEL_TO_ENTITY_TYPE[modelName];
    
    const typeMatch =
      typeFilter === 'all' || entityType === typeFilter;
    const actionMatch =
      actionFilter === 'all' || activity.action?.toLowerCase() === actionFilter;

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
