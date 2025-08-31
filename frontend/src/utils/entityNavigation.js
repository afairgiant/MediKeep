/**
 * Entity Navigation Utilities
 *
 * Provides navigation functions for moving between related entities.
 * This is data-focused and works with the entity relationships configuration.
 */
import logger from '../services/logger';


import {
  getRelationship,
  getRelationshipEndpoint,
  getRelationshipFilterKey,
  ENTITY_TYPES,
} from './entityRelationships';

// Map entity types to their actual route paths
const ENTITY_TO_ROUTE_MAP = {
  [ENTITY_TYPES.MEDICATION]: '/medications',
  [ENTITY_TYPES.LAB_RESULT]: '/lab-results',
  [ENTITY_TYPES.IMMUNIZATION]: '/immunizations',
  [ENTITY_TYPES.PROCEDURE]: '/procedures',
  [ENTITY_TYPES.ALLERGY]: '/allergies',
  [ENTITY_TYPES.CONDITION]: '/conditions',
  [ENTITY_TYPES.TREATMENT]: '/treatments',
  [ENTITY_TYPES.ENCOUNTER]: '/visits',
  [ENTITY_TYPES.VITALS]: '/vitals',
  [ENTITY_TYPES.PRACTITIONER]: '/practitioners',
  [ENTITY_TYPES.PHARMACY]: '/pharmacies',
  [ENTITY_TYPES.EMERGENCY_CONTACT]: '/emergency-contacts',
  [ENTITY_TYPES.PATIENT]: '/patients',
  [ENTITY_TYPES.FAMILY_MEMBER]: '/family-history',
};

/**
 * Generate a URL for navigating to related entities
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @param {string|number} entityId - The ID of the source entity
 * @param {Object} options - Navigation options
 * @param {boolean} options.autoOpen - Whether to auto-open a specific entity
 * @param {string|number} options.targetId - ID of specific target entity to open
 * @param {Object} options.queryParams - Additional query parameters
 * @returns {string|null} The navigation URL or null if relationship not found
 */
export const buildNavigationUrl = (
  sourceEntity,
  relationshipKey,
  entityId,
  options = {}
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) {
    logger.warn(
      `No relationship found for ${sourceEntity}.${relationshipKey}`
    );
    return null;
  }

  const { targetEntity, filterKey } = relationship;
  const searchParams = new URLSearchParams();

  // Add the primary filter parameter
  searchParams.set(filterKey, entityId);

  // Add auto-open parameter if specified
  if (options.autoOpen && options.targetId) {
    searchParams.set('view', options.targetId);
  }

  // Add any additional query parameters
  if (options.queryParams) {
    Object.entries(options.queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });
  }

  // Get the correct route path for the target entity type
  const routePath = ENTITY_TO_ROUTE_MAP[targetEntity] || `/${targetEntity}`;
  
  return `${routePath}?${searchParams.toString()}`;
};

/**
 * Generate a URL for navigating to a specific entity
 * @param {string} entityType - The entity type
 * @param {string|number} entityId - The entity ID
 * @param {Object} options - Navigation options
 * @param {boolean} options.autoOpen - Whether to auto-open the entity
 * @param {Object} options.filters - Filter parameters
 * @param {Object} options.queryParams - Additional query parameters
 * @returns {string} The navigation URL
 */
export const buildEntityUrl = (entityType, entityId, options = {}) => {
  const searchParams = new URLSearchParams();

  // Add auto-open parameter if specified
  if (options.autoOpen) {
    searchParams.set('view', entityId);
  }

  // Add filter parameters
  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });
  }

  // Add additional query parameters
  if (options.queryParams) {
    Object.entries(options.queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });
  }

  // Get the correct route path for the entity type
  const routePath = ENTITY_TO_ROUTE_MAP[entityType] || `/${entityType}`;
  
  // Handle special cases for specific entity IDs
  if (entityId && entityId !== 'undefined') {
    if (entityType === ENTITY_TYPES.PATIENT && entityId === 'me') {
      return `${routePath}/me`;
    }
    // For other entities, use the auto-open approach
    if (options.autoOpen) {
      searchParams.set('view', entityId);
    }
  }

  const queryString = searchParams.toString();
  return `${routePath}${queryString ? `?${queryString}` : ''}`;
};

/**
 * Parse navigation parameters from URL search params
 * @param {URLSearchParams} searchParams - URL search parameters
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {Object} Parsed navigation parameters
 */
export const parseNavigationParams = (
  searchParams,
  sourceEntity,
  relationshipKey
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) {
    return {
      isValid: false,
      errors: [`Invalid relationship: ${sourceEntity}.${relationshipKey}`],
    };
  }

  const { filterKey } = relationship;
  const entityId = searchParams.get(filterKey);
  const viewId = searchParams.get('view');

  return {
    isValid: true,
    entityId: entityId ? parseInt(entityId) : null,
    viewId: viewId ? parseInt(viewId) : null,
    filters: Object.fromEntries(
      Array.from(searchParams.entries()).filter(
        ([key]) => key !== filterKey && key !== 'view'
      )
    ),
  };
};

/**
 * Check if current URL indicates navigation from a related entity
 * @param {URLSearchParams} searchParams - URL search parameters
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {boolean} True if navigation is from related entity
 */
export const isNavigationFromRelated = (
  searchParams,
  sourceEntity,
  relationshipKey
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) return false;

  return searchParams.has(relationship.filterKey);
};

/**
 * Get the source entity information from navigation parameters
 * @param {URLSearchParams} searchParams - URL search parameters
 * @param {string} currentEntity - The current entity type
 * @returns {Object|null} Source entity info or null if not found
 */
export const getSourceEntityFromNavigation = (searchParams, currentEntity) => {
  // This would need to be implemented based on your specific navigation patterns
  // For now, return null as this is a more complex reverse lookup
  return null;
};

/**
 * Generate breadcrumb data for entity navigation
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @param {string|number} sourceId - The source entity ID
 * @param {string} sourceName - The source entity name
 * @returns {Array} Breadcrumb items
 */
export const generateBreadcrumbs = (
  sourceEntity,
  relationshipKey,
  sourceId,
  sourceName
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) return [];

  return [
    {
      label: sourceName || `${sourceEntity} #${sourceId}`,
      url: buildEntityUrl(sourceEntity, sourceId, { autoOpen: true }),
      entityType: sourceEntity,
      entityId: sourceId,
    },
    {
      label: relationship.displayName,
      url: buildNavigationUrl(sourceEntity, relationshipKey, sourceId),
      entityType: relationship.targetEntity,
      isRelationship: true,
    },
  ];
};

/**
 * Validate navigation parameters
 * @param {Object} params - Navigation parameters
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {Object} Validation result
 */
export const validateNavigationParams = (
  params,
  sourceEntity,
  relationshipKey
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) {
    return {
      isValid: false,
      errors: [`Invalid relationship: ${sourceEntity}.${relationshipKey}`],
    };
  }

  const errors = [];

  if (!params.entityId) {
    errors.push(
      `Missing required entity ID for relationship ${relationshipKey}`
    );
  }

  if (params.entityId && isNaN(parseInt(params.entityId))) {
    errors.push(`Invalid entity ID: ${params.entityId}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
