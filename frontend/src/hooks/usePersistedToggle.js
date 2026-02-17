import { useState, useEffect } from 'react';

/**
 * Persists a boolean toggle value in localStorage.
 * Follows the same pattern as usePersistedViewMode but for boolean state.
 *
 * @param {string} storageKey - The localStorage key to persist under
 * @param {boolean} defaultValue - The default value when nothing is stored
 * @returns {[boolean, function]} - The current value and a setter function
 */
export function usePersistedToggle(storageKey, defaultValue = false) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true' || stored === 'false') {
        return stored === 'true';
      }
    } catch {
      // Storage unavailable
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // Storage full or unavailable
    }
  }, [storageKey, value]);

  return [value, setValue];
}
