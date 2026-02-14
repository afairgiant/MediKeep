import { useState, useEffect } from 'react';

const STORAGE_KEY = 'medikeep_viewmode';

export function usePersistedViewMode(defaultMode = 'cards') {
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'cards' || stored === 'table') {
        return stored;
      }
    } catch {
      // Storage unavailable
    }
    return defaultMode;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // Storage full or unavailable
    }
  }, [viewMode]);

  return [viewMode, setViewMode];
}
