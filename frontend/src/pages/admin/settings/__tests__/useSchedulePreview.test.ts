import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { adminApiService } from '../../../../services/api/adminApi';
import { useSchedulePreview } from '../useSchedulePreview';
import { makePreview } from './fixtures';

const REQUEST = { preset: 'daily', time_of_day: '02:00' };
const HOUR_MS = 60 * 60 * 1000;

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

describe('useSchedulePreview', () => {
  let previewSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    previewSpy = vi
      .spyOn(adminApiService, 'previewAutoBackupSchedule')
      .mockResolvedValue(
        makePreview({
          upcoming_runs: [new Date(Date.now() + 2 * HOUR_MS).toISOString()],
        })
      );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('fetches again for the same draft after a save', async () => {
    const { rerender } = renderHook(
      ({ saved }) => useSchedulePreview(REQUEST, saved),
      { initialProps: { saved: {} } }
    );
    await flush();
    expect(previewSpy).toHaveBeenCalledTimes(1);

    rerender({ saved: {} });
    await flush();

    expect(previewSpy).toHaveBeenCalledTimes(2);
  });

  test('fetches again once the first listed run has passed', async () => {
    const saved = {};
    renderHook(() => useSchedulePreview(REQUEST, saved));
    await flush();
    expect(previewSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * HOUR_MS);
    });

    expect(previewSpy).toHaveBeenCalledTimes(2);
  });

  test('retries after a failure and clears the failed state', async () => {
    previewSpy.mockRejectedValueOnce(new Error('network'));
    const saved = {};
    const { result } = renderHook(() => useSchedulePreview(REQUEST, saved));
    await flush();
    expect(result.current.failed).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(previewSpy).toHaveBeenCalledTimes(2);
    expect(result.current.failed).toBe(false);
    expect(result.current.preview).not.toBeNull();
  });

  test('does nothing without a request', async () => {
    renderHook(() => useSchedulePreview(null, {}));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR_MS);
    });

    expect(previewSpy).not.toHaveBeenCalled();
  });
});
