import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounce hook to limit the rate of expensive operations
 * Useful for search inputs and other user interactions
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Debounced callback hook for function calls
 * Returns a debounced version of the callback
 * Fixed: Uses useRef to prevent memory leaks and stale closures
 */
export const useDebouncedCallback = (callback, delay, dependencies = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Reset timeout when dependencies change
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, dependencies);

  return debouncedCallback;
};

export default useDebounce;