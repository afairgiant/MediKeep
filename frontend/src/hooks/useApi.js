import { useState, useCallback, useRef } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (apiCall, options = {}) => {
    // Import getUserFriendlyError at the top of the function
    const { getUserFriendlyError } = await import('../constants/errorMessages.js');
    // Create new abort controller for this request
    const controller = new AbortController();
    
    // Store reference but don't cancel existing requests immediately
    // This prevents race conditions between multiple hooks
    const previousController = abortControllerRef.current;
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const result = await apiCall(controller.signal);

      // Check if request was cancelled
      if (controller.signal.aborted) {
        return null;
      }

      // Only cancel previous request if this one succeeded
      // This prevents successful requests from being cancelled by new ones
      if (previousController && !previousController.signal.aborted) {
        previousController.abort();
      }

      return result;
    } catch (err) {
      // Don't show errors if request was cancelled or if it's an AbortError
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        // Only show error if this is the most recent request
        if (abortControllerRef.current === controller) {
          // Use actual error message (already processed by extractErrorMessage in baseApi)
          // Fall back to options.errorMessage only if err.message is empty
          let errorMessage = err.message || options.errorMessage || 'An error occurred';

          // Apply getUserFriendlyError to format with error codes
          const operation = options.operation || 'save';
          const friendlyError = getUserFriendlyError(errorMessage, operation);

          setError(friendlyError);
        }
        // API error logged by apiService automatically
      }
      return null;
    } finally {
      // Only set loading to false if this is still the current request
      if (abortControllerRef.current === controller && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setErrorMessage = useCallback(message => {
    setError(message);
  }, []);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    loading,
    error,
    execute,
    clearError,
    setError: setErrorMessage,
    cleanup,
  };
};

/**
 * Hook for form state management with validation
 * @param {Object} initialValues - Initial form values
 * @param {Function} validationSchema - Validation function
 * @returns {Object} - Form state and handlers
 */
export const useForm = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = e => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = e => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    if (validationSchema) {
      const fieldErrors = validationSchema(values);
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] || '' }));
    }
  };

  const validate = () => {
    if (!validationSchema) return true;

    const validationErrors = validationSchema(values);
    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
    setValues,
  };
};
