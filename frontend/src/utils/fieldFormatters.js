/**
 * Utilities for formatting field labels and values in medical records
 * Provides consistent formatting across all medical pages
 */

import { formatPhoneNumber, cleanPhoneNumber } from './phoneUtils';

/**
 * Default label mappings for common medical record fields
 */
const defaultLabelMappings = {
  // Insurance fields
  'primary_care_physician': 'Primary Care Physician',
  'deductible_individual': 'Individual Deductible',
  'deductible_family': 'Family Deductible',
  'copay_primary_care': 'Primary Care Copay',
  'copay_specialist': 'Specialist Copay',
  'copay_emergency_room': 'Emergency Room Copay',
  'copay_urgent_care': 'Urgent Care Copay',
  'plan_type': 'Plan Type',
  'dental_plan_type': 'Dental Plan Type',
  'vision_plan_type': 'Vision Plan Type',
  'prescription_plan_type': 'Prescription Plan Type',
  'annual_maximum': 'Annual Maximum',
  'preventive_coverage': 'Preventive Coverage',
  'basic_coverage': 'Basic Coverage',
  'major_coverage': 'Major Coverage',
  'exam_copay': 'Exam Copay',
  'frame_allowance': 'Frame Allowance',
  'contact_allowance': 'Contact Allowance',
  'lens_coverage': 'Lens Coverage',
  'bin_number': 'BIN Number',
  'pcn_number': 'PCN Number',
  'rxgroup': 'RX Group',
  'copay_generic': 'Generic Copay',
  'copay_brand': 'Brand Name Copay',
  'copay_specialty': 'Specialty Copay',
  'pharmacy_network_info': 'Pharmacy Network',
  'customer_service_phone': 'Customer Service',
  'website_url': 'Website',
  'preauth_phone': 'Pre-authorization',
  'provider_services_phone': 'Provider Services',
  'claims_address': 'Claims Address',
  'employer_group': 'Employer/Group Sponsor',
  'policy_holder_name': 'Policy Holder Name',
  'relationship_to_holder': 'Relationship to Holder',
  'effective_date': 'Effective Date',
  'expiration_date': 'Expiration Date',
  'insurance_type': 'Insurance Type',
  'company_name': 'Company Name',
  'member_name': 'Member Name',
  'member_id': 'Member ID',
  'group_number': 'Group Number',
  'plan_name': 'Plan Name',
  
  // Common medical fields
  'first_name': 'First Name',
  'last_name': 'Last Name',
  'date_of_birth': 'Date of Birth',
  'phone_number': 'Phone Number',
  'email_address': 'Email Address',
  'created_at': 'Created Date',
  'updated_at': 'Last Updated',
  'is_primary': 'Primary',
  'is_active': 'Active Status',
  'start_date': 'Start Date',
  'end_date': 'End Date',
  'ordered_date': 'Ordered Date',
  'completed_date': 'Completed Date',
  'test_name': 'Test Name',
  'medication_name': 'Medication Name',
  'dosage_amount': 'Dosage Amount',
  'practitioner_name': 'Practitioner Name'
};

/**
 * Converts field names to human-readable labels
 * @param {string} fieldName - The field name (usually snake_case)
 * @param {Object} customMappings - Optional custom label mappings
 * @returns {string} Formatted label
 */
export const formatFieldLabel = (fieldName, customMappings = {}) => {
  if (!fieldName || typeof fieldName !== 'string') return '';

  // Check custom mappings first, then default mappings
  const allMappings = { ...defaultLabelMappings, ...customMappings };
  
  if (allMappings[fieldName]) {
    return allMappings[fieldName];
  }

  // Fallback: convert snake_case to Title Case
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Default format rules for different field types
 */
const defaultFormatRules = {
  currency: {
    fields: ['deductible', 'copay', 'allowance', 'maximum', 'cost', 'price', 'amount'],
    format: (value) => `$${value}`
  },
  percentage: {
    fields: ['coverage', 'percent'],
    excludeFields: ['lens_coverage'], // Some coverage fields are not percentages
    format: (value) => `${value}%`
  },
  phone: {
    fields: ['phone'],
    format: (value) => formatPhoneNumber(cleanPhoneNumber(value))
  },
  date: {
    fields: ['date', '_at'],
    format: (value) => {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
  },
  boolean: {
    fields: ['is_'],
    format: (value) => value ? 'Yes' : 'No'
  }
};

/**
 * Formats field values based on field type and content
 * @param {string} fieldName - The field name
 * @param {any} value - The value to format
 * @param {Object} customFormatRules - Optional custom formatting rules
 * @returns {string} Formatted value
 */
export const formatFieldValue = (fieldName, value, customFormatRules = {}) => {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  const allFormatRules = { ...defaultFormatRules, ...customFormatRules };

  // Apply format rules based on field name patterns
  for (const [ruleType, rule] of Object.entries(allFormatRules)) {
    const shouldApply = rule.fields.some(pattern => fieldName.includes(pattern));
    const shouldExclude = rule.excludeFields?.some(pattern => fieldName.includes(pattern));
    
    if (shouldApply && !shouldExclude) {
      try {
        return rule.format(value);
      } catch (error) {
        console.warn(`Error formatting ${fieldName} with rule ${ruleType}:`, error);
        return String(value);
      }
    }
  }

  // Default: return as string
  return String(value);
};

/**
 * Processes all phone fields in an object for consistent formatting
 * @param {Object} obj - Object containing phone fields
 * @returns {Object} Object with formatted phone fields
 */
export const formatPhoneFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const formatted = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    if (key.includes('phone') && value) {
      formatted[key] = formatPhoneNumber(cleanPhoneNumber(value));
    } else {
      formatted[key] = value;
    }
  });

  return formatted;
};

/**
 * Insurance-specific label mappings for print templates
 */
export const insurancePrintLabelMappings = {
  'primary_care_physician': 'Primary Care Physician',
  'deductible_individual': 'Individual Deductible',
  'deductible_family': 'Family Deductible',
  'copay_primary_care': 'Primary Care Copay',
  'copay_specialist': 'Specialist Copay',
  'copay_emergency_room': 'Emergency Room Copay',
  'copay_urgent_care': 'Urgent Care Copay',
  'plan_type': 'Plan Type',
  'dental_plan_type': 'Dental Plan Type',
  'vision_plan_type': 'Vision Plan Type',
  'prescription_plan_type': 'Prescription Plan Type',
  'annual_maximum': 'Annual Maximum',
  'preventive_coverage': 'Preventive Coverage',
  'basic_coverage': 'Basic Coverage',
  'major_coverage': 'Major Coverage',
  'exam_copay': 'Exam Copay',
  'frame_allowance': 'Frame Allowance',
  'lens_coverage': 'Lens Coverage',
  'contact_allowance': 'Contact Allowance',
  'bin_number': 'BIN Number',
  'pcn_number': 'PCN Number',
  'rxgroup': 'RX Group',
  'copay_generic': 'Generic Copay',
  'copay_brand': 'Brand Name Copay',
  'copay_specialty': 'Specialty Copay',
  'pharmacy_network_info': 'Pharmacy Network Info',
  'customer_service_phone': 'Customer Service Phone',
  'claims_address': 'Claims Address',
  'website_url': 'Website URL',
  'preauth_phone': 'Pre-authorization Phone',
  'provider_services_phone': 'Provider Services Phone'
};

/**
 * Contact info specific label mappings
 */
export const contactInfoLabelMappings = {
  'customer_service_phone': 'Customer Service Phone',
  'claims_address': 'Claims Address',
  'website_url': 'Website URL',
  'preauth_phone': 'Pre-authorization Phone',
  'provider_services_phone': 'Provider Services Phone'
};

/**
 * Formats a collection of fields with their labels and values
 * @param {Object} data - Object containing field data
 * @param {Object} options - Options for formatting
 * @returns {Array} Array of formatted field objects
 */
export const formatFieldCollection = (data, options = {}) => {
  const {
    customLabelMappings = {},
    customFormatRules = {},
    excludeEmpty = true,
    excludeFields = []
  } = options;

  const formatted = [];

  Object.entries(data).forEach(([key, value]) => {
    // Skip excluded fields
    if (excludeFields.includes(key)) return;
    
    // Skip empty values if requested
    if (excludeEmpty && (value === null || value === undefined || value === '')) return;

    formatted.push({
      key,
      label: formatFieldLabel(key, customLabelMappings),
      value: formatFieldValue(key, value, customFormatRules),
      rawValue: value
    });
  });

  return formatted;
};