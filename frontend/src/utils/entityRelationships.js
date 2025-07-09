/**
 * Entity Relationship Configuration
 *
 * Defines the relationships between different entities in the medical records system.
 * This is purely data-focused - no UI concerns here.
 */

// Core entity types
export const ENTITY_TYPES = {
  PATIENT: 'patient',
  CONDITION: 'condition',
  TREATMENT: 'treatment',
  MEDICATION: 'medication',
  PROCEDURE: 'procedure',
  ALLERGY: 'allergy',
  LAB_RESULT: 'lab_result',
  ENCOUNTER: 'encounter',
  VITALS: 'vitals',
  IMMUNIZATION: 'immunization',
  PHARMACY: 'pharmacy',
  PRACTITIONER: 'practitioner',
  EMERGENCY_CONTACT: 'emergency_contact',
};

// Relationship types
export const RELATIONSHIP_TYPES = {
  ONE_TO_MANY: 'one_to_many', // One source entity can have many target entities
  MANY_TO_ONE: 'many_to_one', // Many source entities can reference one target entity
  ONE_TO_ONE: 'one_to_one', // One-to-one relationship
};

/**
 * Entity Relationship Definitions
 *
 * Structure:
 * sourceEntity: {
 *   relationshipKey: {
 *     targetEntity: string,           // The target entity type
 *     relationshipType: string,       // Type of relationship
 *     foreignKey: string,             // Foreign key field name
 *     displayName: string,            // Human-readable name for UI
 *     description: string,            // Description of the relationship
 *     isRequired: boolean,            // Whether this relationship is required
 *     cascadeDelete: boolean,         // Whether to cascade delete
 *     apiEndpoint: string,            // API endpoint for fetching related entities
 *     filterKey: string               // Key to use when filtering by this relationship
 *   }
 * }
 */
export const ENTITY_RELATIONSHIPS = {
  [ENTITY_TYPES.CONDITION]: {
    treatments: {
      targetEntity: ENTITY_TYPES.TREATMENT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'condition_id',
      displayName: 'Related Treatments',
      description: 'Treatments prescribed for this condition',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/conditions/{id}/treatments/',
      filterKey: 'condition_id',
    },
    medications: {
      targetEntity: ENTITY_TYPES.MEDICATION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'condition_id',
      displayName: 'Related Medications',
      description: 'Medications prescribed for this condition',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/conditions/{id}/medications/',
      filterKey: 'condition_id',
    },
    procedures: {
      targetEntity: ENTITY_TYPES.PROCEDURE,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'condition_id',
      displayName: 'Related Procedures',
      description: 'Procedures performed for this condition',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/conditions/{id}/procedures/',
      filterKey: 'condition_id',
    },
  },

  [ENTITY_TYPES.TREATMENT]: {
    condition: {
      targetEntity: ENTITY_TYPES.CONDITION,
      relationshipType: RELATIONSHIP_TYPES.MANY_TO_ONE,
      foreignKey: 'condition_id',
      displayName: 'Related Condition',
      description: 'The condition this treatment addresses',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/treatments/{id}/condition/',
      filterKey: 'id',
    },
    practitioner: {
      targetEntity: ENTITY_TYPES.PRACTITIONER,
      relationshipType: RELATIONSHIP_TYPES.MANY_TO_ONE,
      foreignKey: 'practitioner_id',
      displayName: 'Prescribing Practitioner',
      description: 'The practitioner who prescribed this treatment',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/treatments/{id}/practitioner/',
      filterKey: 'id',
    },
  },

  [ENTITY_TYPES.MEDICATION]: {
    condition: {
      targetEntity: ENTITY_TYPES.CONDITION,
      relationshipType: RELATIONSHIP_TYPES.MANY_TO_ONE,
      foreignKey: 'condition_id',
      displayName: 'Related Condition',
      description: 'The condition this medication treats',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/medications/{id}/condition/',
      filterKey: 'id',
    },
    pharmacy: {
      targetEntity: ENTITY_TYPES.PHARMACY,
      relationshipType: RELATIONSHIP_TYPES.MANY_TO_ONE,
      foreignKey: 'pharmacy_id',
      displayName: 'Pharmacy',
      description: 'The pharmacy where this medication is filled',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/medications/{id}/pharmacy/',
      filterKey: 'id',
    },
    practitioner: {
      targetEntity: ENTITY_TYPES.PRACTITIONER,
      relationshipType: RELATIONSHIP_TYPES.MANY_TO_ONE,
      foreignKey: 'practitioner_id',
      displayName: 'Prescribing Practitioner',
      description: 'The practitioner who prescribed this medication',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/medications/{id}/practitioner/',
      filterKey: 'id',
    },
  },

  [ENTITY_TYPES.PATIENT]: {
    conditions: {
      targetEntity: ENTITY_TYPES.CONDITION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Medical Conditions',
      description: 'All conditions for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/conditions/',
      filterKey: 'patient_id',
    },
    treatments: {
      targetEntity: ENTITY_TYPES.TREATMENT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Treatments',
      description: 'All treatments for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/treatments/',
      filterKey: 'patient_id',
    },
    medications: {
      targetEntity: ENTITY_TYPES.MEDICATION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Medications',
      description: 'All medications for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/medications/',
      filterKey: 'patient_id',
    },
    allergies: {
      targetEntity: ENTITY_TYPES.ALLERGY,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Allergies',
      description: 'All allergies for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/allergies/',
      filterKey: 'patient_id',
    },
    lab_results: {
      targetEntity: ENTITY_TYPES.LAB_RESULT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Lab Results',
      description: 'All lab results for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/lab-results/',
      filterKey: 'patient_id',
    },
    encounters: {
      targetEntity: ENTITY_TYPES.ENCOUNTER,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Medical Encounters',
      description: 'All medical encounters for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/encounters/',
      filterKey: 'patient_id',
    },
    vitals: {
      targetEntity: ENTITY_TYPES.VITALS,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Vital Signs',
      description: 'All vital signs for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/vitals/',
      filterKey: 'patient_id',
    },
    immunizations: {
      targetEntity: ENTITY_TYPES.IMMUNIZATION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Immunizations',
      description: 'All immunizations for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/immunizations/',
      filterKey: 'patient_id',
    },
    emergency_contacts: {
      targetEntity: ENTITY_TYPES.EMERGENCY_CONTACT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'patient_id',
      displayName: 'Emergency Contacts',
      description: 'All emergency contacts for this patient',
      isRequired: false,
      cascadeDelete: true,
      apiEndpoint: '/api/v1/patients/{id}/emergency-contacts/',
      filterKey: 'patient_id',
    },
  },

  [ENTITY_TYPES.PRACTITIONER]: {
    patients: {
      targetEntity: ENTITY_TYPES.PATIENT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Patients',
      description: 'All patients under this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/patients/',
      filterKey: 'practitioner_id',
    },
    conditions: {
      targetEntity: ENTITY_TYPES.CONDITION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Diagnosed Conditions',
      description: 'All conditions diagnosed by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/conditions/',
      filterKey: 'practitioner_id',
    },
    treatments: {
      targetEntity: ENTITY_TYPES.TREATMENT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Prescribed Treatments',
      description: 'All treatments prescribed by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/treatments/',
      filterKey: 'practitioner_id',
    },
    medications: {
      targetEntity: ENTITY_TYPES.MEDICATION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Prescribed Medications',
      description: 'All medications prescribed by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/medications/',
      filterKey: 'practitioner_id',
    },
    procedures: {
      targetEntity: ENTITY_TYPES.PROCEDURE,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Performed Procedures',
      description: 'All procedures performed by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/procedures/',
      filterKey: 'practitioner_id',
    },
    encounters: {
      targetEntity: ENTITY_TYPES.ENCOUNTER,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Medical Encounters',
      description: 'All encounters conducted by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/encounters/',
      filterKey: 'practitioner_id',
    },
    lab_results: {
      targetEntity: ENTITY_TYPES.LAB_RESULT,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Ordered Lab Results',
      description: 'All lab results ordered by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/lab-results/',
      filterKey: 'practitioner_id',
    },
    immunizations: {
      targetEntity: ENTITY_TYPES.IMMUNIZATION,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Administered Immunizations',
      description: 'All immunizations administered by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/immunizations/',
      filterKey: 'practitioner_id',
    },
    vitals: {
      targetEntity: ENTITY_TYPES.VITALS,
      relationshipType: RELATIONSHIP_TYPES.ONE_TO_MANY,
      foreignKey: 'practitioner_id',
      displayName: 'Recorded Vitals',
      description: 'All vital signs recorded by this practitioner',
      isRequired: false,
      cascadeDelete: false,
      apiEndpoint: '/api/v1/practitioners/{id}/vitals/',
      filterKey: 'practitioner_id',
    },
  },
};

/**
 * Utility functions for working with entity relationships
 */

/**
 * Get all relationships for a given source entity
 * @param {string} sourceEntity - The source entity type
 * @returns {Object} Object containing all relationships for the source entity
 */
export const getEntityRelationships = sourceEntity => {
  return ENTITY_RELATIONSHIPS[sourceEntity] || {};
};

/**
 * Get a specific relationship between two entities
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {Object|null} The relationship definition or null if not found
 */
export const getRelationship = (sourceEntity, relationshipKey) => {
  const relationships = getEntityRelationships(sourceEntity);
  return relationships[relationshipKey] || null;
};

/**
 * Check if a relationship exists between two entities
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {boolean} True if the relationship exists
 */
export const hasRelationship = (sourceEntity, relationshipKey) => {
  return getRelationship(sourceEntity, relationshipKey) !== null;
};

/**
 * Get all target entities that can be related to a source entity
 * @param {string} sourceEntity - The source entity type
 * @returns {Array} Array of target entity types
 */
export const getRelatedEntityTypes = sourceEntity => {
  const relationships = getEntityRelationships(sourceEntity);
  return Object.values(relationships).map(rel => rel.targetEntity);
};

/**
 * Get the API endpoint for a relationship
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @param {string|number} entityId - The ID of the source entity
 * @returns {string|null} The API endpoint or null if not found
 */
export const getRelationshipEndpoint = (
  sourceEntity,
  relationshipKey,
  entityId
) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  if (!relationship) return null;

  return relationship.apiEndpoint.replace('{id}', entityId);
};

/**
 * Get the filter key for a relationship
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {string|null} The filter key or null if not found
 */
export const getRelationshipFilterKey = (sourceEntity, relationshipKey) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);
  return relationship?.filterKey || null;
};

/**
 * Validate that a relationship exists and is properly configured
 * @param {string} sourceEntity - The source entity type
 * @param {string} relationshipKey - The relationship key
 * @returns {Object} Validation result with isValid and errors
 */
export const validateRelationship = (sourceEntity, relationshipKey) => {
  const relationship = getRelationship(sourceEntity, relationshipKey);

  if (!relationship) {
    return {
      isValid: false,
      errors: [
        `Relationship '${relationshipKey}' not found for entity '${sourceEntity}'`,
      ],
    };
  }

  const errors = [];
  const requiredFields = [
    'targetEntity',
    'relationshipType',
    'foreignKey',
    'displayName',
    'apiEndpoint',
    'filterKey',
  ];

  requiredFields.forEach(field => {
    if (!relationship[field]) {
      errors.push(
        `Missing required field '${field}' in relationship '${relationshipKey}'`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};
