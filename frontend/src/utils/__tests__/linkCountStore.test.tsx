import { vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  LINK_COUNT_GRACE_MS,
  linkCountKey,
  listCountState,
  setLinkCount,
  useLinkCount,
  useLinkCounts,
  useLoadLinkCounts,
} from '../linkCountStore';

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/** A hook that loads one key and reads it, like a dialog's tab buttons do. */
const useLoaded = (
  key: string,
  load: (_signal: AbortSignal) => Promise<number>
) => {
  useLoadLinkCounts([{ key, load }], true);
  return useLinkCount(key);
};

describe('linkCountKey', () => {
  it('keys a count by owner, id and type, with a marker for a record that is not saved', () => {
    expect(linkCountKey('visit', 55, 'procedures')).toBe('visit:55:procedures');
    expect(linkCountKey('procedures', 88, 'visits')).toBe(
      'procedures:88:visits'
    );
    expect(linkCountKey('visit', undefined, 'procedures')).toBe(
      'visit:new:procedures'
    );
  });
});

describe('listCountState', () => {
  it('is loading while the list is absent, unknown when its load failed, a number once loaded', () => {
    expect(listCountState(undefined)).toEqual({
      count: undefined,
      loading: true,
    });
    expect(listCountState(null)).toEqual({ count: undefined, loading: false });
    expect(listCountState([])).toEqual({ count: 0, loading: false });
    expect(listCountState([{ id: 1 }, { id: 2 }])).toEqual({
      count: 2,
      loading: false,
    });
  });
});

describe('useLinkCount', () => {
  it('is unknown until a count is known, loading only when one is expected, then follows updates', () => {
    const key = linkCountKey('t1', 1, 'x');
    const expecting = renderHook(() => useLinkCount(key));
    const notExpecting = renderHook(() => useLinkCount(key, false));
    expect(expecting.result.current).toEqual({
      count: undefined,
      loading: true,
    });
    expect(notExpecting.result.current).toEqual({
      count: undefined,
      loading: false,
    });
    act(() => setLinkCount(key, 3));
    expect(expecting.result.current).toEqual({ count: 3, loading: false });
    act(() => setLinkCount(key, 0));
    expect(expecting.result.current).toEqual({ count: 0, loading: false });
  });

  it('keeps counts of different owners apart', () => {
    const a = linkCountKey('t2', 1, 'x');
    const b = linkCountKey('t2', 2, 'x');
    const { result } = renderHook(() => useLinkCounts([a, b]));
    act(() => setLinkCount(a, 5));
    expect(result.current).toEqual([
      { count: 5, loading: false },
      { count: undefined, loading: true },
    ]);
  });
});

describe('useLoadLinkCounts', () => {
  it('loads every count in parallel for a saved owner', async () => {
    const keyA = linkCountKey('t3', 1, 'a');
    const keyB = linkCountKey('t3', 1, 'b');
    const loadA = vi.fn().mockResolvedValue(2);
    const loadB = vi.fn().mockResolvedValue(0);
    const { result } = renderHook(() => {
      useLoadLinkCounts(
        [
          { key: keyA, load: loadA },
          { key: keyB, load: loadB },
        ],
        true
      );
      return useLinkCounts([keyA, keyB]);
    });
    expect(result.current.map(state => state.loading)).toEqual([true, true]);
    await waitFor(() =>
      expect(result.current).toEqual([
        { count: 2, loading: false },
        { count: 0, loading: false },
      ])
    );
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an owner that is not saved', () => {
    const load = vi.fn().mockResolvedValue(1);
    const key = linkCountKey('t4', undefined, 'a');
    const { result } = renderHook(() => {
      useLoadLinkCounts([{ key, load }], false);
      return useLinkCount(key, false);
    });
    expect(load).not.toHaveBeenCalled();
    expect(result.current).toEqual({ count: undefined, loading: false });
  });

  it('marks a count whose load fails as unknown and no longer loading, without affecting the others', async () => {
    const keyA = linkCountKey('t5', 1, 'a');
    const keyB = linkCountKey('t5', 1, 'b');
    const { result } = renderHook(() => {
      useLoadLinkCounts(
        [
          { key: keyA, load: vi.fn().mockRejectedValue(new Error('boom')) },
          { key: keyB, load: vi.fn().mockResolvedValue(4) },
        ],
        true
      );
      return useLinkCounts([keyA, keyB]);
    });
    await waitFor(() =>
      expect(result.current).toEqual([
        { count: undefined, loading: false },
        { count: 4, loading: false },
      ])
    );
  });

  it('ignores an answer that arrives after the owner went away', async () => {
    const key = linkCountKey('t6', 1, 'a');
    let resolveLoad: (_n: number) => void = () => undefined;
    const load = vi.fn(
      () => new Promise<number>(resolve => (resolveLoad = resolve))
    );
    const { unmount } = renderHook(() => useLoaded(key, load));
    unmount();
    resolveLoad(9);
    await flush();
    const after = renderHook(() => useLinkCount(key));
    expect(after.result.current.count).toBeUndefined();
  });

  it('lets a card that loaded the links correct a failed count', async () => {
    const key = linkCountKey('t7', 1, 'a');
    const { result } = renderHook(() =>
      useLoaded(key, vi.fn().mockRejectedValue(new Error('boom')))
    );
    await waitFor(() =>
      expect(result.current).toEqual({ count: undefined, loading: false })
    );
    act(() => setLinkCount(key, 2));
    expect(result.current).toEqual({ count: 2, loading: false });
  });
});

describe('useLoadLinkCounts cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops the count a moment after the owner unmounts, so a reopen never shows a stale number', async () => {
    const key = linkCountKey('t9', 1, 'a');
    const first = renderHook(() =>
      useLoaded(key, vi.fn().mockResolvedValue(4))
    );
    await flush();
    expect(first.result.current.count).toBe(4);
    first.unmount();

    act(() => {
      vi.advanceTimersByTime(LINK_COUNT_GRACE_MS + 1);
    });

    const reopened = renderHook(() => useLinkCount(key));
    expect(reopened.result.current.count).toBeUndefined();
  });

  it('keeps the count through the grace period, so the edit form after a view dialog needs no new request', async () => {
    const key = linkCountKey('t10', 1, 'a');
    const load = vi.fn().mockResolvedValue(4);
    const view = renderHook(() => useLoaded(key, load));
    await flush();
    view.unmount();

    act(() => {
      vi.advanceTimersByTime(LINK_COUNT_GRACE_MS - 100);
    });
    const form = renderHook(() => useLoaded(key, load));

    expect(form.result.current).toEqual({ count: 4, loading: false });
    expect(load).toHaveBeenCalledTimes(1);

    // The form now holds it, so the pending drop of the view's grace period is cancelled
    act(() => {
      vi.advanceTimersByTime(LINK_COUNT_GRACE_MS * 2);
    });
    expect(form.result.current.count).toBe(4);
  });

  it('loads again when the last owner left before the load finished', async () => {
    const key = linkCountKey('t11', 1, 'a');
    let resolveFirst: (_n: number) => void = () => undefined;
    const slow = vi.fn(
      () => new Promise<number>(resolve => (resolveFirst = resolve))
    );
    const view = renderHook(() => useLoaded(key, slow));
    view.unmount();
    resolveFirst(7);

    const fast = vi.fn().mockResolvedValue(3);
    const form = renderHook(() => useLoaded(key, fast));
    await flush();

    expect(fast).toHaveBeenCalledTimes(1);
    expect(form.result.current).toEqual({ count: 3, loading: false });
  });
});

describe('useLoadLinkCounts with two holders of one key', () => {
  it('shares one load while it is in flight', async () => {
    const key = linkCountKey('t12', 1, 'a');
    let resolveLoad: (_n: number) => void = () => undefined;
    const load = vi.fn(
      () => new Promise<number>(resolve => (resolveLoad = resolve))
    );
    const view = renderHook(() => useLoaded(key, load));
    const form = renderHook(() => useLoaded(key, load));

    expect(load).toHaveBeenCalledTimes(1);
    resolveLoad(5);
    await flush();
    expect(view.result.current.count).toBe(5);
    expect(form.result.current.count).toBe(5);
  });

  it('does not load again for a holder that mounts once the count is known', async () => {
    const key = linkCountKey('t13', 1, 'a');
    const load = vi.fn().mockResolvedValue(2);
    const first = renderHook(() => useLoaded(key, load));
    await waitFor(() => expect(first.result.current.count).toBe(2));

    const second = renderHook(() => useLoaded(key, load));

    expect(second.result.current.count).toBe(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the counts when one of them unmounts, as when a view dialog hands over to the edit form', async () => {
    const key = linkCountKey('t14', 1, 'a');
    const view = renderHook(() => useLoaded(key, vi.fn().mockResolvedValue(4)));
    const form = renderHook(() => useLoaded(key, vi.fn().mockResolvedValue(4)));
    await waitFor(() => expect(form.result.current.count).toBe(4));

    view.unmount();

    expect(form.result.current.count).toBe(4);
    expect(renderHook(() => useLinkCount(key)).result.current.count).toBe(4);
  });

  it('does not wipe what the first holder already loaded when the second one mounts', async () => {
    const key = linkCountKey('t15', 1, 'a');
    const first = renderHook(() =>
      useLoaded(key, vi.fn().mockResolvedValue(2))
    );
    await waitFor(() => expect(first.result.current.count).toBe(2));

    renderHook(() => useLoaded(key, vi.fn().mockResolvedValue(2)));

    expect(first.result.current.count).toBe(2);
  });

  it('tries again when a holder mounts after a failed load', async () => {
    const key = linkCountKey('t16', 1, 'a');
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const first = renderHook(() => useLoaded(key, failing));
    await waitFor(() =>
      expect(first.result.current).toEqual({ count: undefined, loading: false })
    );

    const working = vi.fn().mockResolvedValue(6);
    renderHook(() => useLoaded(key, working));

    await waitFor(() => expect(first.result.current.count).toBe(6));
    expect(working).toHaveBeenCalledTimes(1);
  });
});
