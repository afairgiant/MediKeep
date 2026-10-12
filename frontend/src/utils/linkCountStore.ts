import { useEffect, useSyncExternalStore } from 'react';

import logger from '../services/logger';

/**
 * Counts for the "(n)" on link tabs. A tab button needs its count before the tab is
 * opened, while the panel that changes it only mounts when the tab is open, so the two
 * share a small store keyed by owner and type instead of passing state through every
 * dialog. Counts are numbers only; no record data is kept here.
 */
const counts = new Map<string, number>();
// Keys whose last load failed: the count stays unknown, but it is no longer "loading"
const failed = new Set<string>();
const listeners = new Set<() => void>();

interface KeyLoad {
  /** Mounted loaders of the key: a record's view dialog and edit form can overlap */
  holders: number;
  /** The load in flight, shared by every holder */
  controller?: AbortController;
  /** Set while no holder is left, until the count is dropped */
  releaseTimer?: ReturnType<typeof setTimeout>;
}
const loads = new Map<string, KeyLoad>();

/**
 * How long a count outlives its last loader. A view dialog that hands over to its edit
 * form unmounts before the form mounts, and the form can then reuse the count instead
 * of asking again. A dialog reopened later never shows a stale number.
 */
export const LINK_COUNT_GRACE_MS = 2000;

const notify = () => listeners.forEach(listener => listener());

/** Key for one owner's link tab, e.g. `visit:55:procedures` or `procedures:88:visits`. */
export const linkCountKey = (
  owner: string,
  ownerId: number | null | undefined,
  type: string
) => `${owner}:${ownerId ?? 'new'}:${type}`;

export const setLinkCount = (key: string, count: number) => {
  const recovered = failed.delete(key);
  if (counts.get(key) === count && !recovered) return;
  counts.set(key, count);
  notify();
};

const clearLinkCount = (key: string) => {
  const hadCount = counts.delete(key);
  const hadFailure = failed.delete(key);
  if (hadCount || hadFailure) notify();
};

const markLinkCountFailed = (key: string) => {
  counts.delete(key);
  failed.add(key);
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A tab's count: undefined while it is not known, and `loading` while it is on its way. */
export interface LinkCountState {
  count: number | undefined;
  loading: boolean;
}

/**
 * The count state of a link list a page loads itself: absent while it loads, null when
 * its load failed.
 */
export const listCountState = (
  list: readonly unknown[] | null | undefined
): LinkCountState => ({
  count: Array.isArray(list) ? list.length : undefined,
  loading: list === undefined,
});

const stateOf = (token: string, enabled: boolean): LinkCountState => {
  if (token === '') return { count: undefined, loading: enabled };
  if (token === 'f') return { count: undefined, loading: false };
  return { count: Number(token), loading: false };
};

const tokenOf = (key: string) => {
  const count = counts.get(key);
  if (count !== undefined) return String(count);
  return failed.has(key) ? 'f' : '';
};

/**
 * The latest known count of one key. `enabled` says a load is expected (a saved record),
 * so a count that is not there yet reads as loading rather than as unknown.
 */
export const useLinkCount = (key: string, enabled = true): LinkCountState => {
  const token = useSyncExternalStore(
    subscribe,
    () => tokenOf(key),
    () => ''
  );
  return stateOf(token, enabled);
};

/** The latest known counts of several keys, in order. */
export const useLinkCounts = (
  keys: string[],
  enabled = true
): LinkCountState[] => {
  // A primitive snapshot, so React can tell whether anything changed
  const snapshot = useSyncExternalStore(
    subscribe,
    () => keys.map(tokenOf).join(','),
    () => ''
  );
  if (keys.length === 0) return [];
  return snapshot.split(',').map(token => stateOf(token, enabled));
};

export interface LinkCountLoader {
  key: string;
  /** Resolves to the number of links */
  load: (_signal: AbortSignal) => Promise<number>;
}

const startLoad = (key: string, state: KeyLoad, load: LinkCountLoader['load']) => {
  // Forget a failed attempt, so the key reads as loading again
  clearLinkCount(key);
  const controller = new AbortController();
  state.controller = controller;
  load(controller.signal)
    .then(count => {
      if (controller.signal.aborted) return;
      state.controller = undefined;
      setLinkCount(key, count);
    })
    .catch(err => {
      if (controller.signal.aborted) return;
      state.controller = undefined;
      markLinkCountFailed(key);
      logger.error('link_count_load_failed', {
        message: 'Failed to load a link count',
        key,
        error: err instanceof Error ? err.message : String(err),
        component: 'useLoadLinkCounts',
      });
    });
};

/**
 * Registers a loader of `key`. A count that is known, or already being loaded for another
 * holder, is reused; otherwise (first holder, a failed load, or a load aborted when the
 * last holder left) the count is loaded.
 */
const acquireKey = (key: string, load: LinkCountLoader['load']) => {
  let state = loads.get(key);
  if (!state) {
    state = { holders: 0 };
    loads.set(key, state);
    // A count nobody holds is stale
    clearLinkCount(key);
  }
  if (state.releaseTimer !== undefined) {
    clearTimeout(state.releaseTimer);
    state.releaseTimer = undefined;
  }
  state.holders += 1;
  if (counts.has(key) || state.controller) return;
  startLoad(key, state, load);
};

const releaseKey = (key: string) => {
  const state = loads.get(key);
  if (!state || state.holders === 0) return;
  state.holders -= 1;
  if (state.holders > 0) return;
  state.controller?.abort();
  state.controller = undefined;
  state.releaseTimer = setTimeout(() => {
    if (loads.get(key) !== state) return;
    loads.delete(key);
    clearLinkCount(key);
  }, LINK_COUNT_GRACE_MS);
};

/**
 * Loads several counts in parallel when `enabled` (a saved record), so the tab labels
 * can show them before any tab is opened. A count that cannot be loaded stays unknown
 * and its tab simply shows no number. Loaders of the same key share one load and one
 * count: a count is dropped only once the last of them has gone away (after a short
 * grace period), so one dialog unmounting never wipes the counts another dialog of the
 * same record has loaded.
 */
export const useLoadLinkCounts = (
  loaders: LinkCountLoader[],
  enabled: boolean
) => {
  // The loaders are rebuilt every render; what identifies the work is the keys
  const signature = loaders.map(loader => loader.key).join('|');

  useEffect(() => {
    if (!enabled) return undefined;
    loaders.forEach(({ key, load }) => acquireKey(key, load));
    return () => {
      loaders.forEach(({ key }) => releaseKey(key));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);
};

/** For tests: forgets every count, load and pending timer. */
export const resetLinkCountStore = () => {
  loads.forEach(state => {
    state.controller?.abort();
    if (state.releaseTimer !== undefined) clearTimeout(state.releaseTimer);
  });
  loads.clear();
  counts.clear();
  failed.clear();
  notify();
};
