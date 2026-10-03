import { vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  linkCountKey,
  setLinkCount,
  useLinkCount,
  useLoadLinkCounts,
} from '../linkCountStore';

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

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

describe('useLinkCount', () => {
  it('is undefined until a count is known, then follows updates', () => {
    const key = linkCountKey('t1', 1, 'x');
    const { result } = renderHook(() => useLinkCount(key));
    expect(result.current).toBeUndefined();
    act(() => setLinkCount(key, 3));
    expect(result.current).toBe(3);
    act(() => setLinkCount(key, 0));
    expect(result.current).toBe(0);
  });

  it('keeps counts of different owners apart', () => {
    const a = linkCountKey('t2', 1, 'x');
    const b = linkCountKey('t2', 2, 'x');
    const { result } = renderHook(() => [useLinkCount(a), useLinkCount(b)]);
    act(() => setLinkCount(a, 5));
    expect(result.current).toEqual([5, undefined]);
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
      return [useLinkCount(keyA), useLinkCount(keyB)];
    });
    await waitFor(() => expect(result.current).toEqual([2, 0]));
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an owner that is not saved', () => {
    const load = vi.fn().mockResolvedValue(1);
    renderHook(() =>
      useLoadLinkCounts(
        [{ key: linkCountKey('t4', undefined, 'a'), load }],
        false
      )
    );
    expect(load).not.toHaveBeenCalled();
  });

  it('leaves a count unknown when its load fails, without affecting the others', async () => {
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
      return [useLinkCount(keyA), useLinkCount(keyB)];
    });
    await waitFor(() => expect(result.current[1]).toBe(4));
    expect(result.current[0]).toBeUndefined();
  });

  it('ignores an answer that arrives after the owner went away', async () => {
    const key = linkCountKey('t6', 1, 'a');
    let resolveLoad: (_n: number) => void = () => undefined;
    const load = vi.fn(
      () => new Promise<number>(resolve => (resolveLoad = resolve))
    );
    const { result, unmount } = renderHook(() => {
      useLoadLinkCounts([{ key, load }], true);
      return useLinkCount(key);
    });
    unmount();
    resolveLoad(9);
    await Promise.resolve();
    const { result: after } = renderHook(() => useLinkCount(key));
    expect(after.current).toBeUndefined();
    expect(result.current).toBeUndefined();
  });
});
