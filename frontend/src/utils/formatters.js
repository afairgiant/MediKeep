/**
 * Formats field names into user-friendly labels
 *
 * @param {string} fieldName - The field name to format
 * @returns {string} Formatted label
 */
export const formatFieldLabel = fieldName => {
  // Handle specific field mappings
  const fieldMappings = {
    email: 'Email',
    password_hash: 'Password',
    password: 'Password',
    first_name: 'First Name',
    last_name: 'Last Name',
    username: 'Username',
    full_name: 'Full Name',
    birth_date: 'Birth Date',
    phone_number: 'Phone Number',
    patient_id: 'Patient ID',
    user_id: 'User ID',
    medication_name: 'Medication Name',
    test_name: 'Test Name',
    vaccine_name: 'Vaccine Name',
    start_date: 'Start Date',
    end_date: 'End Date',
    onset_date: 'Onset Date',
    created_at: 'Created At',
    updated_at: 'Updated At',
  };

  // Check if there's a specific mapping
  if (fieldMappings[fieldName]) {
    return fieldMappings[fieldName];
  }

  // Default: capitalize first letter and replace underscores with spaces
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
