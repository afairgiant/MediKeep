import { useState, useEffect } from 'react';

const LEGACY_KEY = 'medikeep_viewmode';

function getStorageKey(pageKey) {
  return `medikeep_viewmode_${pageKey}`;
}

function readValidMode(key) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'cards' || stored === 'table') {
      return stored;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

export function usePersistedViewMode(pageKey, defaultMode = 'cards') {
  const storageKey = getStorageKey(pageKey);

  const [viewMode, setViewMode] = useState(() => {
    // Try page-specific key first
    const pageValue = readValidMode(storageKey);
    if (pageValue) return pageValue;

    // Migrate from legacy global key
    const legacyValue = readValidMode(LEGACY_KEY);
    if (legacyValue) {
      try {
        localStorage.setItem(storageKey, legacyValue);
      } catch {
        // Storage full or unavailable
      }
      return legacyValue;
    }

    return defaultMode;
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
