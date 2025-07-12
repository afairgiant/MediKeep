import { useCallback } from 'react';

/**
 * Reusable hook for handling form input changes in Mantine forms
 * Provides standardized handlers for TextInput, Select, and DateInput components
 * 
 * @param {Function} onInputChange - Callback function to handle form data changes
 * @returns {Object} - Object containing form handler functions
 */
export function useFormHandlers(onInputChange) {
  // Handle TextInput onChange (receives event object)
  const handleTextInputChange = useCallback(
    field => event => {
      const syntheticEvent = {
        target: {
          name: field,
          value: event.target.value || '',
        },
      };
      onInputChange(syntheticEvent);
    },
    [onInputChange]
  );

  // Handle Select onChange (receives value directly)
  const handleSelectChange = useCallback(
    field => value => {
      const syntheticEvent = {
        target: {
          name: field,
          value: value || '',
        },
      };
      onInputChange(syntheticEvent);
    },
    [onInputChange]
  );

  // Handle date changes (receives Date object or null)
  const handleDateChange = useCallback(
    field => date => {
      let formattedDate = '';
      if (date) {
        // Format date as YYYY-MM-DD for consistent backend handling
        formattedDate = date.toISOString().split('T')[0];
      }
      const syntheticEvent = {
        target: {
          name: field,
          value: formattedDate,
        },
      };
      onInputChange(syntheticEvent);
    },
    [onInputChange]
  );

  // Handle numeric input changes (for numbers with validation)
  const handleNumberChange = useCallback(
    field => value => {
      const syntheticEvent = {
        target: {
          name: field,
          value: value || '',
        },
      };
      onInputChange(syntheticEvent);
    },
    [onInputChange]
  );

  // Handle checkbox changes (receives boolean)
  const handleCheckboxChange = useCallback(
    field => checked => {
      const syntheticEvent = {
        target: {
          name: field,
          value: checked,
        },
      };
      onInputChange(syntheticEvent);
    },
    [onInputChange]
  );

  return {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
    handleNumberChange,
    handleCheckboxChange,
  };
}