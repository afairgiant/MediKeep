/**
 * Profile completion utilities
 */

/**
 * Check if a patient's profile is complete
 * @param {Object} patient - Patient object from global state
 * @returns {Object} - { isComplete: boolean, missingFields: string[], completionPercentage: number }
 */
export const checkPatientProfileCompletion = patient => {
  if (!patient) {
    return {
      isComplete: false,
      missingFields: ['patient_data'],
      completionPercentage: 0,
    };
  }

  const requiredFields = [
    {
      key: 'first_name',
      label: 'First Name',
      check: val =>
        val && val.trim() !== '' && val.toLowerCase() !== 'first name',
    },
    {
      key: 'last_name',
      label: 'Last Name',
      check: val =>
        val && val.trim() !== '' && val.toLowerCase() !== 'last name',
    },
    {
      key: 'birthDate',
      label: 'Birth Date',
      check: val => val && val !== '1990-01-01', // Check for default placeholder date
    },
  ];

  const importantFields = [
    {
      key: 'gender',
      label: 'Gender',
      check: val => val && val !== 'OTHER',
    },
  ];

  const allFields = [...requiredFields, ...importantFields];
  const missingFields = [];
  let completedFields = 0;

  allFields.forEach(field => {
    const value = patient[field.key];
    if (field.check(value)) {
      completedFields++;
    } else {
      missingFields.push(field.label);
    }
  });

  const completionPercentage = Math.round(
    (completedFields / allFields.length) * 100
  );
  const isComplete = missingFields.length === 0;

  return {
    isComplete,
    missingFields,
    completionPercentage,
  };
};

/**
 * Check if patient has placeholder or default values that should be updated
 * @param {Object} patient - Patient object from global state
 * @returns {Object} - Information about placeholder values
 */
export const checkForPatientPlaceholderValues = patient => {
  if (!patient) return { hasPlaceholders: false, placeholderFields: [] };

  const placeholderFields = [];

  // Check for default placeholder names
  if (patient.first_name && patient.first_name.toLowerCase() === 'first name') {
    placeholderFields.push('First Name (placeholder)');
  }

  if (patient.last_name && patient.last_name.toLowerCase() === 'last name') {
    placeholderFields.push('Last Name (placeholder)');
  }

  // Check for default birth date
  if (patient.birthDate === '1990-01-01') {
    placeholderFields.push('Birth Date (default)');
  }

  // Note: Address is now considered optional, so we don't check for placeholder address

  // Check for default gender
  if (patient.gender === 'OTHER') {
    placeholderFields.push('Gender (default)');
  }

  return {
    hasPlaceholders: placeholderFields.length > 0,
    placeholderFields,
  };
};

/**
 * Get patient profile completion message based on completion status
 * @param {Object} patient - Patient object from global state
 * @returns {string} - Appropriate message for the user
 */
export const getPatientProfileCompletionMessage = patient => {
  const completion = checkPatientProfileCompletion(patient);
  const placeholders = checkForPatientPlaceholderValues(patient);

  if (completion.isComplete && !placeholders.hasPlaceholders) {
    return 'Your medical profile is complete! 🎉';
  }

  if (completion.completionPercentage >= 80) {
    return 'Almost there! Just a few more medical details needed.';
  }

  if (completion.completionPercentage >= 50) {
    return "Good progress! Let's finish setting up your medical profile.";
  }

  return "Let's complete your medical profile to get started with your health records.";
};

/**
 * Check if this is the user's first login
 * @param {string} username - Username to check
 * @returns {boolean} - Whether this is first login
 */
export const isFirstLogin = username => {
  if (!username) return false;
  const firstLoginKey = `firstLogin_${username}`;
  const isFirst = localStorage.getItem(firstLoginKey) !== 'completed';
  console.log(`Checking first login for ${username}:`, isFirst);
  return isFirst;
};

/**
 * Mark first login as completed for a user
 * @param {string} username - Username to mark as completed
 */
export const markFirstLoginCompleted = username => {
  if (!username) return;
  const firstLoginKey = `firstLogin_${username}`;
  localStorage.setItem(firstLoginKey, 'completed');
  console.log('First login marked as completed for:', username);
};

/**
 * Determine if user should see patient profile completion prompts (only on first login)
 * @param {Object} user - User object from auth context
 * @param {Object} patient - Patient object from global state
 * @returns {boolean} - Whether to show completion prompts
 */
export const shouldShowPatientProfileCompletionPrompt = (user, patient) => {
  if (!user || !patient || !isFirstLogin(user.username)) return false;

  const completion = checkPatientProfileCompletion(patient);
  const placeholders = checkForPatientPlaceholderValues(patient);

  return !completion.isComplete || placeholders.hasPlaceholders;
};
