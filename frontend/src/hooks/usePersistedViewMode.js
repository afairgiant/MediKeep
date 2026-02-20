import { useState, useEffect } from 'react';

const LEGACY_KEY = 'medikeep_viewmode';
const VALID_MODES = new Set(['cards', 'table']);

function readValidMode(key) {
  try {
    const stored = localStorage.getItem(key);
    if (VALID_MODES.has(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

export function usePersistedViewMode(pageKey, defaultMode = 'cards') {
  const storageKey = `medikeep_viewmode_${pageKey}`;

  const [viewMode, setViewMode] = useState(() => {
    return readValidMode(storageKey)
      ?? readValidMode(LEGACY_KEY)
      ?? defaultMode;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, viewMode);
    } catch {
      // Storage full or unavailable
    }
  }, [storageKey, viewMode]);

  return [viewMode, setViewMode];
}
