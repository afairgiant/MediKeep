/**
 * Centralized deletion configuration and confirmation utilities
 * Eliminates code duplication across admin components
 */

// Medical data types that get cascaded when deleting a user/patient
const MEDICAL_DATA_TYPES = [
  'Medications',
  'Lab Results',
  'Allergies',
  'Conditions',
  'Procedures',
  'Immunizations',
  'Vital Signs',
  'Encounters',
  'Treatments',
];

// Model-specific deletion configurations
const DELETION_CONFIG = {
  user: {
    requiresEnhancedWarning: true,
    cascadeTypes: [
      'patient record',
      ...MEDICAL_DATA_TYPES.map(type => type.toLowerCase()),
    ],
    getWarningMessage: (records, isBulk = false) => {
      if (isBulk) {
        const usernames = records.map(r => r.username || 'Unknown').join(', ');
        return `⚠️ WARNING: Bulk Delete ${records.length} Users?

Selected users: ${usernames}

This action will PERMANENTLY DELETE:
• All ${records.length} user accounts
• Their linked patient records (if they exist)
• ALL associated medical data for each user including:
  ${MEDICAL_DATA_TYPES.map(type => `- ${type}`).join('\n  ')}

⚠️ This action CANNOT be undone!

Are you absolutely sure you want to proceed?`;
      } else {
        const username = records.username || 'Unknown User';
        return `⚠️ WARNING: Delete User "${username}"?

This action will PERMANENTLY DELETE:
• The user account
• Their linked patient record (if exists)
• ALL medical data including:
  ${MEDICAL_DATA_TYPES.map(type => `- ${type}`).join('\n  ')}

⚠️ This action CANNOT be undone!

Are you absolutely sure you want to proceed?`;
      }
    },
  },
  // Add other models here if they need special handling
  patient: {
    requiresEnhancedWarning: true,
    cascadeTypes: MEDICAL_DATA_TYPES.map(type => type.toLowerCase()),
    getWarningMessage: (records, isBulk = false) => {
      const patientName = isBulk
        ? `${records.length} patients`
        : records.first_name && records.last_name
          ? `${records.first_name} ${records.last_name}`
          : 'patient';

      return `⚠️ WARNING: Delete ${patientName}?

This will permanently delete ALL medical data including:
${MEDICAL_DATA_TYPES.map(type => `- ${type}`).join('\n')}

⚠️ This action CANNOT be undone!

Are you absolutely sure you want to proceed?`;
    },
  },
};

/**
 * Get confirmation message for model deletion
 * @param {string} modelName - The model being deleted
 * @param {Object|Array} records - Record(s) being deleted
 * @param {boolean} isBulk - Whether this is a bulk deletion
 * @returns {string} Confirmation message
 */
export const getDeletionConfirmationMessage = (
  modelName,
  records,
  isBulk = false
) => {
  const config = DELETION_CONFIG[modelName];

  if (!config || !config.requiresEnhancedWarning) {
    // Default confirmation for non-special models
    const count = isBulk
      ? Array.isArray(records)
        ? records.length
        : 'selected'
      : 'this';
    return `Are you sure you want to delete ${count} ${modelName}${isBulk && count !== 'this' ? 's' : ''}?`;
  }

  return config.getWarningMessage(records, isBulk);
};

/**
 * Check if a model requires enhanced deletion warnings
 * @param {string} modelName - The model name
 * @returns {boolean}
 */
export const requiresEnhancedDeletionWarning = modelName => {
  return DELETION_CONFIG[modelName]?.requiresEnhancedWarning || false;
};

/**
 * Get the types of data that will be cascaded when deleting a model
 * @param {string} modelName - The model name
 * @returns {Array<string>}
 */
export const getCascadeTypes = modelName => {
  return DELETION_CONFIG[modelName]?.cascadeTypes || [];
};
