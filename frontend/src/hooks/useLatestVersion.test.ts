import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { clearLatestVersionCache, useLatestVersion } from './useLatestVersion';

vi.mock('../services/systemService', () => ({
  getReleaseNotes: vi.fn(),
}));

vi.mock('../services/logger', () => ({
  default: { warn: vi.fn() },
}));

import { getReleaseNotes } from '../services/systemService';

const mockGetReleaseNotes = vi.mocked(getReleaseNotes);

const respond = (latest_version: string | null) =>
  mockGetReleaseNotes.mockResolvedValue({ releases: [], latest_version } as Awaited<
    ReturnType<typeof getReleaseNotes>
  >);

describe('useLatestVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLatestVersionCache();
  });

  it('returns the newer release tag', async () => {
    respond('v0.73.0');

    const { result } = renderHook(() => useLatestVersion());

    await waitFor(() => expect(result.current).toBe('v0.73.0'));
  });

  it('returns null when up to date', async () => {
    respond(null);

    const { result } = renderHook(() => useLatestVersion());

    await waitFor(() => expect(mockGetReleaseNotes).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('does not fetch when disabled', () => {
    respond('v0.73.0');

    const { result } = renderHook(() => useLatestVersion(false));

    expect(mockGetReleaseNotes).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('shares one request between callers', async () => {
    respond('v0.73.0');

    const first = renderHook(() => useLatestVersion());
    const second = renderHook(() => useLatestVersion());

    await waitFor(() => expect(first.result.current).toBe('v0.73.0'));
    await waitFor(() => expect(second.result.current).toBe('v0.73.0'));
    expect(mockGetReleaseNotes).toHaveBeenCalledTimes(1);
  });

  it('returns null on failure and retries on the next mount', async () => {
    mockGetReleaseNotes.mockRejectedValueOnce(new Error('offline'));

    const first = renderHook(() => useLatestVersion());
    await waitFor(() => expect(mockGetReleaseNotes).toHaveBeenCalledTimes(1));
    expect(first.result.current).toBeNull();

    respond('v0.73.0');
    const second = renderHook(() => useLatestVersion());

    await waitFor(() => expect(second.result.current).toBe('v0.73.0'));
    expect(mockGetReleaseNotes).toHaveBeenCalledTimes(2);
  });
});
