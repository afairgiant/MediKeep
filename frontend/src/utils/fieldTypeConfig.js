/**
 * Centralized field type configuration for medical records
 * Consolidates field identification logic across the application
 */

/**
 * Field patterns for different data types
 * Used for automatic formatting and validation
 */

// Currency-related fields (formatted with $ prefix)
export const CURRENCY_FIELDS = [
  'deductible',
  'copay', 
  'allowance',
  'maximum',
  'cost',
  'price',
  'amount',
  'fee'
];

// Percentage-related fields (formatted with % suffix)
export const PERCENTAGE_FIELDS = [
  'coverage',
  'percent',
  'rate'
];

// Fields that should be excluded from percentage formatting
export const PERCENTAGE_EXCLUDE_FIELDS = [
  'lens_coverage' // This field contains text, not percentages
];

// Phone number fields (already defined in phoneUtils.js, imported here for consistency)
export const PHONE_FIELDS = [
  'phone',
  'telephone',
  'mobile',
  'cell'
];

// Date-related fields (formatted as dates)
export const DATE_FIELDS = [
  'date',
  '_at', // created_at, updated_at, etc.
  '_on'  // scheduled_on, etc.
];

// Boolean fields (formatted as Yes/No)
export const BOOLEAN_FIELDS = [
  'is_',
  'has_',
  'can_',
  'should_',
  'enabled',
  'active',
  'primary'
];

/**
 * Field type mappings for easy lookup
 * Maps field types to their corresponding field arrays
 */
export const FIELD_TYPE_MAPPINGS = {
  currency: CURRENCY_FIELDS,
  percentage: PERCENTAGE_FIELDS,
  phone: PHONE_FIELDS,
  date: DATE_FIELDS,
  boolean: BOOLEAN_FIELDS
};

/**
 * Field type exclusions
 * Fields that should be excluded from certain formatting rules
 */
export const FIELD_EXCLUSIONS = {
  percentage: PERCENTAGE_EXCLUDE_FIELDS
};

/**
 * Determines the field type based on field name patterns
 * @param {string} fieldName - The field name to check
 * @returns {string|null} The field type or null if no match
 */
export const getFieldType = (fieldName) => {
  if (!fieldName || typeof fieldName !== 'string') return null;
  
  const lowercaseFieldName = fieldName.toLowerCase();
  
  // Check each field type
  for (const [typeName, patterns] of Object.entries(FIELD_TYPE_MAPPINGS)) {
    const hasMatch = patterns.some(pattern => lowercaseFieldName.includes(pattern));
    
    // Check for exclusions
    if (hasMatch && FIELD_EXCLUSIONS[typeName]) {
      const isExcluded = FIELD_EXCLUSIONS[typeName].some(excludePattern => 
        lowercaseFieldName.includes(excludePattern)
      );
      if (isExcluded) continue;
    }
    
    if (hasMatch) return typeName;
  }
  
  return null;
};

/**
 * Checks if a field matches a specific type
 * @param {string} fieldName - The field name to check
 * @param {string} fieldType - The type to check against
 * @returns {boolean} True if field matches the type
 */
export const isFieldType = (fieldName, fieldType) => {
  if (!fieldName || !fieldType) return false;
  
  const patterns = FIELD_TYPE_MAPPINGS[fieldType];
  if (!patterns) return false;
  
  const lowercaseFieldName = fieldName.toLowerCase();
  const hasMatch = patterns.some(pattern => lowercaseFieldName.includes(pattern));
  
  // Check for exclusions
  if (hasMatch && FIELD_EXCLUSIONS[fieldType]) {
    const isExcluded = FIELD_EXCLUSIONS[fieldType].some(excludePattern => 
      lowercaseFieldName.includes(excludePattern)
    );
    return !isExcluded;
  }
  
  return hasMatch;
};

/**
 * Insurance-specific field configurations
 * Grouped by insurance type for type-specific validation
 */
export const INSURANCE_FIELD_CONFIG = {
  medical: {
    required: ['company_name', 'member_name', 'member_id'],
    coverage_fields: [
      'primary_care_physician', 'deductible_individual', 'deductible_family',
      'copay_primary_care', 'copay_specialist', 'copay_emergency_room', 'copay_urgent_care'
    ]
  },
  dental: {
    required: ['company_name', 'member_name', 'member_id'],
    coverage_fields: [
      'annual_maximum', 'preventive_coverage', 'basic_coverage', 'major_coverage'
    ]
  },
  vision: {
    required: ['company_name', 'member_name', 'member_id'],
    coverage_fields: [
      'exam_copay', 'frame_allowance', 'lens_coverage', 'contact_allowance'
    ]
  },
  prescription: {
    required: ['company_name', 'member_name', 'member_id'],
    coverage_fields: [
      'bin_number', 'pcn_number', 'rxgroup', 'copay_generic', 'copay_brand', 'copay_specialty'
    ]
  }
};

/**
 * Gets insurance-specific field configuration
 * @param {string} insuranceType - The insurance type
 * @returns {Object} Configuration object for the insurance type
 */
export const getInsuranceFieldConfig = (insuranceType) => {
  return INSURANCE_FIELD_CONFIG[insuranceType] || INSURANCE_FIELD_CONFIG.medical;
};