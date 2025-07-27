/**
 * Utilities for handling nested form data in medical records
 * Handles flattening nested objects for forms and restructuring for API submission
 */

import { formatPhoneNumber, cleanPhoneNumber, isPhoneField } from './phoneUtils';

/**
 * Flattens nested object properties into a flat form data structure
 * @param {Object} item - The item containing nested data
 * @param {Object} nestedFieldConfig - Configuration defining which fields are nested
 * @returns {Object} Flattened form data
 */
export const flattenNestedObject = (item, nestedFieldConfig) => {
  if (!item) return {};

  const flatData = {};

  // Copy basic fields
  Object.keys(item).forEach(key => {
    if (!nestedFieldConfig.nestedFields?.includes(key)) {
      flatData[key] = item[key] || '';
    }
  });

  // Flatten nested fields
  nestedFieldConfig.nestedFields?.forEach(nestedField => {
    const nestedData = item[nestedField] || {};
    Object.entries(nestedData).forEach(([key, value]) => {
      // Handle phone number formatting for display using centralized detection
      if (isPhoneField(key) && value) {
        flatData[key] = formatPhoneNumber(value);
      } else {
        flatData[key] = value || '';
      }
    });
  });

  return flatData;
};

/**
 * Restructures flat form data back into nested structure for API submission
 * @param {Object} formData - Flat form data from form
 * @param {Object} fieldConfig - Configuration defining field groupings
 * @returns {Object} Restructured data with nested objects
 */
export const restructureFormData = (formData, fieldConfig) => {
  const { basicFields = [], nestedFieldGroups = {} } = fieldConfig;

  // Build basic fields object
  const basicData = {};
  basicFields.forEach(field => {
    if (formData[field] !== undefined) {
      let value = formData[field];
      
      // Handle boolean fields properly
      if (field === 'is_primary') {
        value = Boolean(value);
      }
      
      basicData[field] = value;
    }
  });

  // Build nested field groups
  const nestedData = {};
  Object.entries(nestedFieldGroups).forEach(([groupName, fields]) => {
    const groupData = {};
    
    fields.forEach(field => {
      const value = formData[field];
      // Include field if it has a value (not undefined, null, or empty string)
      if (value !== undefined && value !== null && value !== '') {
        // Clean phone numbers before saving using centralized detection
        if (isPhoneField(field)) {
          const cleanedPhone = cleanPhoneNumber(value);
          if (cleanedPhone) { // Only add if cleanPhoneNumber returns a valid result
            groupData[field] = cleanedPhone;
          }
        } else {
          groupData[field] = value;
        }
      }
    });

    // Always add the group, even if empty (to maintain data structure)
    nestedData[groupName] = groupData;
  });

  return { ...basicData, ...nestedData };
};

/**
 * Initializes form data for both create and edit modes with nested data support
 * @param {Object|null} item - Existing item for edit mode, null for create mode
 * @param {Object} fieldConfig - Configuration defining all fields and their defaults
 * @param {Object} defaultValues - Default values for new items
 * @returns {Object} Initialized form data
 */
export const initializeFormData = (item, fieldConfig, defaultValues = {}) => {
  const { basicFields = [], nestedFieldGroups = {} } = fieldConfig;

  if (item) {
    // Edit mode - flatten existing item
    return flattenNestedObject(item, {
      nestedFields: Object.keys(nestedFieldGroups)
    });
  }

  // Create mode - return defaults
  const initData = { ...defaultValues };

  // Initialize basic fields
  basicFields.forEach(field => {
    if (!(field in initData)) {
      initData[field] = '';
    }
  });

  // Initialize nested fields
  Object.values(nestedFieldGroups).forEach(fields => {
    fields.forEach(field => {
      if (!(field in initData)) {
        initData[field] = '';
      }
    });
  });

  return initData;
};

/**
 * Configuration helper for insurance form fields
 * Defines which fields are basic vs nested for insurance forms
 */
export const insuranceFieldConfig = {
  basicFields: [
    'insurance_type',
    'company_name', 
    'employer_group',
    'member_name',
    'member_id',
    'group_number',
    'plan_name',
    'policy_holder_name',
    'relationship_to_holder',
    'effective_date',
    'expiration_date',
    'status',
    'is_primary',
    'notes'
  ],
  nestedFieldGroups: {
    coverage_details: [
      'primary_care_physician', 'deductible_individual', 'deductible_family',
      'copay_primary_care', 'copay_specialist', 'copay_emergency_room', 'copay_urgent_care',
      'plan_type', 'dental_plan_type', 'vision_plan_type', 'prescription_plan_type',
      'annual_maximum', 'preventive_coverage', 'basic_coverage', 'major_coverage',
      'exam_copay', 'frame_allowance', 'lens_coverage', 'contact_allowance',
      'bin_number', 'pcn_number', 'rxgroup', 'copay_generic', 'copay_brand', 
      'copay_specialty', 'pharmacy_network_info'
    ],
    contact_info: [
      'customer_service_phone', 'claims_address', 'website_url', 
      'preauth_phone', 'provider_services_phone'
    ]
  }
};

/**
 * Default values for new insurance records
 */
export const insuranceDefaultValues = {
  insurance_type: '',
  company_name: '',
  employer_group: '',
  member_name: '',
  member_id: '',
  group_number: '',
  plan_name: '',
  policy_holder_name: '',
  relationship_to_holder: '',
  effective_date: '',
  expiration_date: '',
  status: 'active',
  is_primary: false,
  notes: ''
};