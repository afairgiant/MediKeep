import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'medikeep_search_history';
const MAX_ENTRIES = 20;

export interface SearchHistoryEntry {
  query: string;
  tags: string[];
  matchMode: string;
  timestamp: number;
}

interface UseSearchHistoryReturn {
  entries: SearchHistoryEntry[];
  addEntry: (query: string, tags: string[], matchMode: string) => void;
  removeEntry: (index: number) => void;
  clearHistory: () => void;
}

function buildDedupeKey(query: string, tags: string[]): string {
  return `${query.trim()}::${[...tags].sort().join(',')}`;
}

function loadFromStorage(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SearchHistoryEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.query === 'string' &&
        Array.isArray(item.tags) &&
        typeof item.matchMode === 'string' &&
        typeof item.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

function persistToStorage(entries: SearchHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be unavailable or quota exceeded; silently ignore
  }
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(() =>
    loadFromStorage()
  );

  useEffect(() => {
    persistToStorage(entries);
  }, [entries]);

  const addEntry = useCallback(
    (query: string, tags: string[], matchMode: string): void => {
      const trimmedQuery = query.trim();
      const hasContent = trimmedQuery.length > 0 || tags.length > 0;
      if (!hasContent) return;

      const newKey = buildDedupeKey(trimmedQuery, tags);
      const now = Date.now();

      setEntries((prev) => {
        const existingIndex = prev.findIndex(
          (entry) => buildDedupeKey(entry.query, entry.tags) === newKey
        );

        let updated: SearchHistoryEntry[];

        if (existingIndex !== -1) {
          updated = prev.map((entry, idx) =>
            idx === existingIndex
              ? { ...entry, matchMode, timestamp: now }
              : entry
          );
        } else {
          const newEntry: SearchHistoryEntry = {
            query: trimmedQuery,
            tags,
            matchMode,
            timestamp: now,
          };
          updated = [newEntry, ...prev];
        }

        // Keep sorted by newest first and cap at MAX_ENTRIES
        updated.sort((a, b) => b.timestamp - a.timestamp);
        return updated.slice(0, MAX_ENTRIES);
      });
    },
    []
  );

  const removeEntry = useCallback((index: number): void => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clearHistory = useCallback((): void => {
    setEntries([]);
  }, []);

  // entries are always stored in sorted order by addEntry
  return {
    entries,
    addEntry,
    removeEntry,
    clearHistory,
  };
}
