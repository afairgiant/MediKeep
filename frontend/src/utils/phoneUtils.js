/**
 * Phone number formatting utilities with centralized field detection
 */

/**
 * Centralized configuration for phone field identification
 */
export const PHONE_FIELD_PATTERNS = [
  'phone',
  'telephone',
  'mobile',
  'cell'
];

/**
 * Centralized phone field detection utility
 * Replaces fragile string matching throughout the codebase
 * 
 * @param {string} fieldName - The field name to check
 * @param {string} fieldType - Optional field type (e.g., 'tel')
 * @returns {boolean} True if field is a phone field
 */
export const isPhoneField = (fieldName, fieldType = '') => {
  if (!fieldName) return false;
  
  // Check if field type is 'tel'
  if (fieldType === 'tel') return true;
  
  // Check if field name contains any phone patterns
  const lowercaseFieldName = fieldName.toLowerCase();
  return PHONE_FIELD_PATTERNS.some(pattern => 
    lowercaseFieldName.includes(pattern)
  );
};

/**
 * Format a phone number for display
 * Converts digits-only format to user-friendly display format
 *
 * @param {string|null} phoneNumber - The phone number (digits only from database)
 * @returns {string} - Formatted phone number for display
 */
export const formatPhoneNumber = phoneNumber => {
  // Return empty string if no phone number
  if (!phoneNumber || phoneNumber.trim() === '') {
    return '';
  }

  // Remove any non-digit characters (just in case)
  const digits = phoneNumber.replace(/\D/g, '');

  // Handle different phone number lengths
  if (digits.length === 10) {
    // US format: (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US format with country code: +1 (XXX) XXX-XXXX
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length >= 10 && digits.length <= 15) {
    // International format: parse from the end (reverse) since local numbers are more standardized
    // Most countries use 7-10 digit local numbers, so work backwards
    
    if (digits.length === 10) {
      // Could be: +C XXX XXX XXXX (1-digit country code)
      return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    } else if (digits.length === 11) {
      // Could be: +CC XXX XXX XXXX (2-digit country code) 
      return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    } else if (digits.length === 12) {
      // Could be: +CCC XXX XXX XXXX (3-digit country code) or +CC XXXX XXX XXX
      // Assume last 7 digits are local number, format as XXX-XXXX
      const countryCode = digits.slice(0, -7);
      const localNumber = digits.slice(-7);
      
      // Add space within country code if it's longer than 3 digits
      let formattedCountryCode = countryCode;
      if (countryCode.length > 3) {
        formattedCountryCode = `${countryCode.slice(0, 3)} ${countryCode.slice(3)}`;
      }
      
      return `+${formattedCountryCode} ${localNumber.slice(0, 3)} ${localNumber.slice(3)}`;
    } else if (digits.length === 13) {
      // Assume last 8 digits are local number, format as XXXX-XXXX  
      const countryCode = digits.slice(0, -8);
      const localNumber = digits.slice(-8);
      
      // Add space within country code if it's longer than 3 digits
      let formattedCountryCode = countryCode;
      if (countryCode.length > 3) {
        formattedCountryCode = `${countryCode.slice(0, 3)} ${countryCode.slice(3)}`;
      }
      
      return `+${formattedCountryCode} ${localNumber.slice(0, 4)} ${localNumber.slice(4)}`;
    } else {
      // For other lengths, assume last 7-8 digits are local
      const localLength = Math.min(8, digits.length - 1);
      const countryCode = digits.slice(0, -localLength);
      const localNumber = digits.slice(-localLength);
      
      // Add space within country code if it's longer than 3 digits
      let formattedCountryCode = countryCode;
      if (countryCode.length > 3) {
        formattedCountryCode = `${countryCode.slice(0, 3)} ${countryCode.slice(3)}`;
      }
      
      if (localLength <= 7) {
        return `+${formattedCountryCode} ${localNumber.slice(0, 3)} ${localNumber.slice(3)}`;
      } else {
        return `+${formattedCountryCode} ${localNumber.slice(0, 4)} ${localNumber.slice(4)}`;
      }
    }
  }

  // If length is not standard, return as-is with dashes
  return digits.replace(/(\d{3})/g, '$1-').replace(/-$/, '');
};

/**
 * Clean phone number input for form submission
 * Removes all non-digit characters for database storage
 *
 * @param {string} phoneNumber - The phone number input from user
 * @returns {string} - Cleaned phone number (digits only)
 */
export const cleanPhoneNumber = phoneNumber => {
  if (!phoneNumber) return '';
  return phoneNumber.replace(/\D/g, '');
};

/**
 * Validate phone number format
 *
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidPhoneNumber = phoneNumber => {
  if (!phoneNumber) return true; // Allow empty phone numbers

  const digits = cleanPhoneNumber(phoneNumber);
  return digits.length >= 10 && digits.length <= 15;
};

/**
 * Format phone number as user types (for input fields)
 * Provides real-time formatting as the user enters the number
 * Now preserves user input formatting characters for better UX
 *
 * @param {string} value - Current input value
 * @returns {string} - Formatted value for display in input
 */
export const formatPhoneInput = value => {
  // If user is actively typing formatting characters, preserve them temporarily
  // This allows users to type "(555) 123-4567" as shown in placeholder
  if (value.includes('(') || value.includes(')') || value.includes('-') || value.includes(' ')) {
    const digits = cleanPhoneNumber(value);
    
    // Only format if we have enough digits, otherwise preserve user input
    if (digits.length >= 10) {
      // Apply standard formatting
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
      }
    }
    
    // If not enough digits yet, let user continue typing with their formatting
    return value;
  }

  // For pure digit input, apply automatic formatting
  const digits = cleanPhoneNumber(value);

  // For very short numbers, just return digits
  if (digits.length <= 3) {
    return digits;
  }
  
  // For 10 digits or less, use US format
  if (digits.length <= 10) {
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  // For 11+ digits, use international format with + prefix
  // Use the same reverse-parsing logic as formatPhoneNumber
  if (digits.length === 11 && digits.startsWith('1')) {
    // US with country code: +1 (XXX) XXX-XXXX
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length >= 11) {
    // International format: work backwards from local number
    if (digits.length <= 12) {
      // Assume last 7 digits are local number
      const countryCode = digits.slice(0, -7);
      const localNumber = digits.slice(-7);
      
      // Add space within country code if it's longer than 3 digits
      let formattedCountryCode = countryCode;
      if (countryCode.length > 3) {
        formattedCountryCode = `${countryCode.slice(0, 3)} ${countryCode.slice(3)}`;
      }
      
      return `+${formattedCountryCode} ${localNumber.slice(0, 3)} ${localNumber.slice(3)}`;
    } else {
      // For longer numbers, assume last 8 digits are local
      const countryCode = digits.slice(0, -8);
      const localNumber = digits.slice(-8);
      
      // Add space within country code if it's longer than 3 digits
      let formattedCountryCode = countryCode;
      if (countryCode.length > 3) {
        formattedCountryCode = `${countryCode.slice(0, 3)} ${countryCode.slice(3)}`;
      }
      
      return `+${formattedCountryCode} ${localNumber.slice(0, 4)} ${localNumber.slice(4)}`;
    }
  }
  
  return digits;
};

/**
 * Formats phone number specifically for display purposes
 * Provides consistent formatting across the application
 * 
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} Formatted phone number for display
 */
export const formatPhoneForDisplay = (phoneNumber) => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return '';
  }
  
  const cleaned = cleanPhoneNumber(phoneNumber);
  return formatPhoneNumber(cleaned);
};

/**
 * Formats phone number for storage (digits only)
 * Ensures consistent data format in database
 * 
 * @param {string} phoneNumber - Raw phone number input
 * @returns {string} Cleaned phone number for storage
 */
export const formatPhoneForStorage = (phoneNumber) => {
  return cleanPhoneNumber(phoneNumber);
};

/**
 * Processes all phone fields in an object
 * Applies consistent formatting to all phone fields in a data object
 * 
 * @param {Object} data - Object containing potential phone fields
 * @param {Function} formatter - Formatting function to apply (formatPhoneForDisplay or formatPhoneForStorage)
 * @returns {Object} Object with processed phone fields
 */
export const processPhoneFields = (data, formatter = formatPhoneForDisplay) => {
  if (!data || typeof data !== 'object') return data;
  
  const processed = {};
  
  Object.entries(data).forEach(([key, value]) => {
    if (isPhoneField(key) && value) {
      processed[key] = formatter(value);
    } else {
      processed[key] = value;
    }
  });
  
  return processed;
};
