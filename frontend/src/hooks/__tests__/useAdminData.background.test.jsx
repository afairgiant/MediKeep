import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminData } from '../useAdminData';

vi.mock('../../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Why these two flags stay separate: see the note on loadData in useAdminData.js.
describe('useAdminData background declaration', () => {
  let load;

  const setup = (config = {}) => {
    load = vi.fn(() => Promise.resolve({ ok: true }));
    return renderHook(() =>
      useAdminData({
        entityName: 'Test Entity',
        apiMethodsConfig: { load },
        ...config,
      })
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const lastBackground = () => {
    const [, options] = load.mock.calls.at(-1);
    return options?.background;
  };

  test('the initial load is not background', async () => {
    setup();

    await waitFor(() => expect(load).toHaveBeenCalled());

    expect(lastBackground()).toBe(false);
  });

  test('the auto-refresh interval is background', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = setup({ autoRefresh: true, refreshInterval: 30000 });

    await waitFor(() => expect(load).toHaveBeenCalled());
    load.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(load).toHaveBeenCalled();
    expect(lastBackground()).toBe(true);
    unmount();
  });

  // The regression that matters: Refresh All passes silent=true.
  test('a silent manual refresh is NOT background', async () => {
    const { result } = setup();

    await waitFor(() => expect(load).toHaveBeenCalled());
    load.mockClear();

    await act(async () => {
      await result.current.refreshData(true);
    });

    expect(load).toHaveBeenCalled();
    expect(lastBackground()).toBe(false);
  });

  test('a loud manual refresh is not background either', async () => {
    const { result } = setup();

    await waitFor(() => expect(load).toHaveBeenCalled());
    load.mockClear();

    await act(async () => {
      await result.current.refreshData();
    });

    expect(lastBackground()).toBe(false);
  });
});
