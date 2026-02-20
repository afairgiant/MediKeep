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

/**
 * Persists a page-specific view mode ('cards' or 'table') in localStorage.
 *
 * Storage key: `medikeep_viewmode_${pageKey}`. Falls back to the legacy global
 * key `medikeep_viewmode` on first load for migration, then persists to the
 * page-specific key via useEffect.
 *
 * @param {string} pageKey - Page identifier (e.g. 'medications', 'lab-results').
 * @param {'cards' | 'table'} [defaultMode='cards'] - Fallback when nothing is stored.
 * @returns {['cards' | 'table', (mode: 'cards' | 'table') => void]}
 */
export function usePersistedViewMode(pageKey, defaultMode = 'cards') {
  if (typeof pageKey !== 'string' || pageKey.trim().length === 0) {
    throw new Error('usePersistedViewMode: "pageKey" must be a non-empty string');
  }

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
