/**
 * Phone number formatting utilities
 */

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
 *
 * @param {string} value - Current input value
 * @returns {string} - Formatted value for display in input
 */
export const formatPhoneInput = value => {
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
