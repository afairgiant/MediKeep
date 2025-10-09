import { useCallback } from 'react';

/**
 * Custom hook for handling form field changes in model forms
 *
 * @param {Function} setFormData - State setter for form data
 * @param {Function} setValidationErrors - State setter for validation errors
 * @returns {Object} Field handler functions
 */
export const useFieldHandlers = (setFormData, setValidationErrors) => {
  const handleFieldChange = useCallback(
    (fieldName, value) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));

      // Clear validation error for this field when user starts typing
      setValidationErrors(prev => {
        if (prev[fieldName]) {
          return {
            ...prev,
            [fieldName]: null,
          };
        }
        return prev;
      });
    },
    [setFormData, setValidationErrors]
  );

  return { handleFieldChange };
};
