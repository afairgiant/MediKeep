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
        // Check if it's already a Date object, if not try to create one
        let dateObj;
        if (date instanceof Date) {
          dateObj = date;
        } else if (typeof date === 'string') {
          // Handle string dates by parsing manually to avoid timezone issues
          const [year, month, day] = date.split('-').map(Number);
          dateObj = new Date(year, month - 1, day); // month is 0-indexed
        } else {
          dateObj = new Date(date);
        }
        
        // Verify we have a valid date before formatting
        if (!isNaN(dateObj.getTime())) {
          // Use local date formatting to avoid timezone issues with toISOString()
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }
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