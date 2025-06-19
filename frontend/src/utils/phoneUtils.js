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
    // International format: break into groups
    if (digits.length <= 12) {
      // Break into groups of 3-3-rest
      const part1 = digits.slice(0, 3);
      const part2 = digits.slice(3, 6);
      const part3 = digits.slice(6);
      return `${part1}-${part2}-${part3}`;
    } else {
      // For longer numbers, just add dashes every 3-4 digits
      return digits.replace(/(\d{3})(\d{3})(\d{4})(.*)/, '$1-$2-$3-$4');
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

  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else {
    // For longer numbers, still format but show all digits
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}${digits.slice(10)}`;
  }
};
