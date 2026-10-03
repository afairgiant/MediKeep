import { useEffect, useSyncExternalStore } from 'react';

import logger from '../services/logger';

/**
 * Counts for the "(n)" on link tabs. A tab button needs its count before the tab is
 * opened, while the panel that changes it only mounts when the tab is open, so the two
 * share a small store keyed by owner and type instead of passing state through every
 * dialog. Counts are numbers only; no record data is kept here.
 */
const counts = new Map<string, number>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

/** Key for one owner's link tab, e.g. `visit:55:procedures` or `procedures:88:visits`. */
export const linkCountKey = (
  owner: string,
  ownerId: number | null | undefined,
  type: string
) => `${owner}:${ownerId ?? 'new'}:${type}`;

export const setLinkCount = (key: string, count: number) => {
  if (counts.get(key) === count) return;
  counts.set(key, count);
  notify();
};

const clearLinkCount = (key: string) => {
  if (counts.delete(key)) notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The latest known count, or undefined while it is not known yet. */
export const useLinkCount = (key: string): number | undefined =>
  useSyncExternalStore(
    subscribe,
    () => counts.get(key),
    () => undefined
  );

export interface LinkCountLoader {
  key: string;
  /** Resolves to the number of links */
  load: (_signal: AbortSignal) => Promise<number>;
}

/**
 * Loads several counts in parallel when `enabled` (a saved record), so the tab labels
 * can show them before any tab is opened. A count that cannot be loaded stays unknown
 * and its tab simply shows no number.
 */
export const useLoadLinkCounts = (
  loaders: LinkCountLoader[],
  enabled: boolean
) => {
  // The loaders are rebuilt every render; what identifies the work is the keys
  const signature = loaders.map(loader => loader.key).join('|');

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    loaders.forEach(({ key, load }) => {
      clearLinkCount(key);
      load(controller.signal)
        .then(count => {
          if (!controller.signal.aborted) setLinkCount(key, count);
        })
        .catch(err => {
          if (err instanceof Error && err.name === 'AbortError') return;
          logger.error('link_count_load_failed', {
            message: 'Failed to load a link count',
            key,
            error: err instanceof Error ? err.message : String(err),
            component: 'useLoadLinkCounts',
          });
        });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);
};
