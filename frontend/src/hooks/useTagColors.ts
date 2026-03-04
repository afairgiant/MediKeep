import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import logger from '../services/logger';

interface TagColorEntry {
  id: number;
  tag: string;
  color: string | null;
  usage_count: number;
  entity_types: string[];
}

interface UseTagColorsReturn {
  getTagColor: (tagName: string) => string | null;
  tagColors: Record<string, string>;
  tagEntries: TagColorEntry[];
  isLoading: boolean;
  refresh: () => void;
}

let cachedTagColors: Record<string, string> = {};
let cachedEntries: TagColorEntry[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export function useTagColors(): UseTagColorsReturn {
  const [tagColorMap, setTagColorMap] = useState<Record<string, string>>(cachedTagColors);
  const [entries, setEntries] = useState<TagColorEntry[]>(cachedEntries);
  const [isLoading, setIsLoading] = useState(false);

  const fetchColors = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cacheTimestamp > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
      setTagColorMap(cachedTagColors);
      setEntries(cachedEntries);
      return;
    }

    setIsLoading(true);
    try {
      const data: TagColorEntry[] = await api.get('/tags/popular', {
        params: { limit: 50 }
      });
      const colors: Record<string, string> = {};
      for (const entry of data) {
        if (entry.color) {
          colors[entry.tag] = entry.color;
        }
      }
      cachedTagColors = colors;
      cachedEntries = data;
      cacheTimestamp = Date.now();
      setTagColorMap(colors);
      setEntries(data);
    } catch (error) {
      logger.error('Failed to fetch tag colors', {
        component: 'useTagColors',
        error
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const getTagColor = useCallback(
    (tagName: string): string | null => tagColorMap[tagName] ?? null,
    [tagColorMap]
  );

  const refresh = useCallback(() => {
    fetchColors(true);
  }, [fetchColors]);

  return useMemo(
    () => ({ getTagColor, tagColors: tagColorMap, tagEntries: entries, isLoading, refresh }),
    [getTagColor, tagColorMap, entries, isLoading, refresh]
  );
}
