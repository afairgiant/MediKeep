/**
 * Centralized navigation utility for linking between medical record entities
 * Based on the existing Treatment → Condition pattern
 */
import logger from '../services/logger';


export const ENTITY_ROUTES = {
  condition: '/conditions',
  medication: '/medications',
  procedure: '/procedures',
  practitioner: '/practitioners',
  pharmacy: '/pharmacies',
  allergy: '/allergies',
  treatment: '/treatments',
  encounter: '/encounters',
  lab_result: '/lab-results',
  immunization: '/immunizations',
  vitals: '/vitals',
  patient: '/patients'
};


/**
 * Navigate to a related entity and automatically open it
 * SECURITY: Uses URL parameters only - no client-side storage
 * @param {string} entityType - Type of entity to navigate to (e.g., 'condition', 'practitioner')
 * @param {number|string} entityId - ID of the entity to open
 * @param {function} navigate - React Router navigate function
 */
export const navigateToEntity = (entityType, entityId, navigate) => {
  if (!entityId || !entityType) return;
  
  const route = ENTITY_ROUTES[entityType];
  
  if (!route) {
    logger.error(`Unknown entity type: ${entityType}`);
    return;
  }
  
  // Sanitize entity ID
  const sanitizedId = parseInt(entityId, 10);
  if (isNaN(sanitizedId)) {
    logger.error('Invalid entity ID');
    return;
  }
  
  // SECURE: Navigate using URL parameters only
  navigate(`${route}?view=${sanitizedId}`);
};

/**
 * Extract entity ID from URL parameters
 * SECURITY: No storage dependencies
 * @param {object} location - React Router location object
 * @returns {string|null} - The entity ID from URL or null
 */
export const getEntityIdFromUrl = (location) => {
  const searchParams = new URLSearchParams(location.search);
  return searchParams.get('view');
};

/**
 * Create a click handler for entity navigation
 * SECURITY: Direct navigation without storage
 * @param {string} entityType - Type of entity to navigate to
 * @param {function} navigate - React Router navigate function
 * @returns {function} - Click handler function
 */
export const createEntityNavigationHandler = (entityType, navigate) => {
  return (entityId) => {
    navigateToEntity(entityType, entityId, navigate);
  };
};

/**
 * Create entity display name from entity object or ID
 * @param {string} entityType - Type of entity
 * @param {object|number} entityData - Entity object or ID
 * @param {function} getEntityName - Optional function to get entity name by ID
 * @returns {string} - Display name for the entity
 */
export const getEntityDisplayName = (entityType, entityData, getEntityName = null) => {
  if (!entityData) return null;
  
  // If it's just an ID
  if (typeof entityData === 'number' || typeof entityData === 'string') {
    if (getEntityName) {
      return getEntityName(entityData) || `${entityType} #${entityData}`;
    }
    return `${entityType} #${entityData}`;
  }
  
  // If it's an object, extract the appropriate display field
  switch (entityType) {
    case 'condition':
      return entityData.diagnosis || `Condition #${entityData.id}`;
    case 'practitioner':
      return entityData.name || `${entityData.first_name} ${entityData.last_name}` || `Practitioner #${entityData.id}`;
    case 'pharmacy':
      return entityData.name || `Pharmacy #${entityData.id}`;
    case 'medication':
      return entityData.medication_name || `Medication #${entityData.id}`;
    case 'procedure':
      return entityData.procedure_name || `Procedure #${entityData.id}`;
    case 'allergy':
      return entityData.allergen || `Allergy #${entityData.id}`;
    case 'treatment':
      return entityData.treatment_name || `Treatment #${entityData.id}`;
    default:
      return `${entityType} #${entityData.id}`;
  }
};

/**
 * Create a generic entity link component props
 * @param {string} entityType - Type of entity
 * @param {object} entityData - Entity data
 * @param {function} navigate - React Router navigate function
 * @param {function} getEntityName - Optional function to get entity name by ID
 * @returns {object} - Props for entity link component
 */
export const createEntityLinkProps = (entityType, entityData, navigate, getEntityName = null) => {
  if (!entityData) return null;
  
  const displayName = getEntityDisplayName(entityType, entityData, getEntityName);
  const entityId = typeof entityData === 'object' ? entityData.id : entityData;
  
  return {
    text: displayName,
    onClick: () => navigateToEntity(entityType, entityId, navigate),
    style: { cursor: 'pointer', textDecoration: 'underline' },
    c: 'blue'
  };
};