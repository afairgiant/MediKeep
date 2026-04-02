import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { useReleaseNotes } from './useReleaseNotes';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  default: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

vi.mock('../services/systemService', () => ({
  getVersionInfo: vi.fn(),
  getReleaseNotes: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked modules for per-test configuration
// ---------------------------------------------------------------------------

import { useAuth } from '../contexts/AuthContext';
import { getVersionInfo, getReleaseNotes } from '../services/systemService';

const mockUseAuth = vi.mocked(useAuth);
const mockGetVersionInfo = vi.mocked(getVersionInfo);
const mockGetReleaseNotes = vi.mocked(getReleaseNotes);

// ---------------------------------------------------------------------------
// localStorage helpers
//
// setupTests.js replaces global.localStorage with a vi.fn() mock, so we must
// configure getItem/setItem return values per-test rather than using real
// storage. We keep a simple in-memory map and wire it into the mock.
// ---------------------------------------------------------------------------

function storageKey(userId: string | number): string {
  return `medikeep_last_seen_version_${userId}`;
}

// Configure localStorage.getItem to return `storedValue` for `key` and null
// for everything else. Pass `null` to simulate no stored value.
function mockLocalStorageGetItem(key: string, storedValue: string | null): void {
  vi.mocked(localStorage.getItem).mockImplementation((k: string) =>
    k === key ? storedValue : null
  );
}

// Capture what value was stored via setItem for a given key.
function captureLocalStorageSetItem(): { getLastCall: (key: string) => string | undefined } {
  const calls: Map<string, string> = new Map();
  vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
    calls.set(k, v);
  });
  return {
    getLastCall: (key: string) => calls.get(key),
  };
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeRelease(overrides: Partial<{
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}> = {}) {
  return {
    tag_name: 'v0.58.0',
    name: 'Release 0.58.0',
    body: '## Changes\n- added feature',
    published_at: '2026-03-01T00:00:00Z',
    html_url: 'https://github.com/example/releases/tag/v0.58.0',
    ...overrides,
  };
}

function makeAuthenticatedUser(id: string | number = 1) {
  return { user: { id }, isAuthenticated: true };
}

// ---------------------------------------------------------------------------
// Provider wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <MantineProvider>{children}</MantineProvider>
    </BrowserRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useReleaseNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no stored version (simulates first-time user)
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
  });

  describe('unauthenticated user', () => {
    it('does not fetch data and sets loading to false when not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetVersionInfo).not.toHaveBeenCalled();
      expect(mockGetReleaseNotes).not.toHaveBeenCalled();
      expect(result.current.showModal).toBe(false);
    });

    it('does not fetch data when authenticated but user id is absent', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: undefined as unknown as string },
        isAuthenticated: true,
      } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetVersionInfo).not.toHaveBeenCalled();
    });
  });

  describe('first-time user (no localStorage entry)', () => {
    it('shows modal with the current release when version matches exactly', async () => {
      // localStorage.getItem returns null (already the default)
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      const currentRelease = makeRelease({ tag_name: 'v0.58.0' });
      const olderRelease = makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [currentRelease, olderRelease],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(true);
      expect(result.current.unseenReleases).toHaveLength(1);
      expect(result.current.unseenReleases[0].tag_name).toBe('v0.58.0');
    });

    it('shows the closest release at or below currentVersion when no exact match', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      const olderRelease = makeRelease({ tag_name: 'v0.57.0', name: 'Closest' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [olderRelease],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(true);
      expect(result.current.unseenReleases).toHaveLength(1);
      expect(result.current.unseenReleases[0].name).toBe('Closest');
    });

    it('does not show releases newer than currentVersion for first-time user', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      const newerRelease = makeRelease({ tag_name: 'v0.60.0', name: 'Future' });
      const currentRelease = makeRelease({ tag_name: 'v0.58.0', name: 'Current' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [newerRelease, currentRelease],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(true);
      expect(result.current.unseenReleases).toHaveLength(1);
      // Should show v0.58.0 (current), not v0.60.0 (future)
      expect(result.current.unseenReleases[0].tag_name).toBe('v0.58.0');
    });

    it('does not show modal when releases array is empty', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(false);
    });
  });

  describe('returning user (localStorage entry present)', () => {
    it('does not show modal when stored version matches current version', async () => {
      const userId = 42;
      mockLocalStorageGetItem(storageKey(userId), 'v0.58.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const release = makeRelease({ tag_name: 'v0.58.0' });

      mockGetVersionInfo.mockResolvedValue({ version: 'v0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [release],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(false);
      expect(result.current.unseenReleases).toHaveLength(0);
    });

    it('shows releases between lastSeen and currentVersion after upgrade', async () => {
      const userId = 7;
      mockLocalStorageGetItem(storageKey(userId), 'v0.56.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const v58 = makeRelease({ tag_name: 'v0.58.0', name: 'v0.58.0' });
      const v57 = makeRelease({ tag_name: 'v0.57.0', name: 'v0.57.0' });
      const v56 = makeRelease({ tag_name: 'v0.56.0', name: 'v0.56.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [v58, v57, v56],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(true);
      // v0.57.0 and v0.58.0 are both newer than v0.56.0 and at or below currentVersion
      expect(result.current.unseenReleases).toHaveLength(2);
      // Hook sorts newest first
      expect(result.current.unseenReleases[0].tag_name).toBe('v0.58.0');
      expect(result.current.unseenReleases[1].tag_name).toBe('v0.57.0');
    });

    it('excludes releases newer than currentVersion (not yet upgraded to)', async () => {
      const userId = 13;
      mockLocalStorageGetItem(storageKey(userId), 'v0.50.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      // GitHub has releases newer than what user is running
      const v55 = makeRelease({ tag_name: 'v0.55.0', name: 'v0.55.0' });
      const v54 = makeRelease({ tag_name: 'v0.54.0', name: 'v0.54.0' });
      const v53 = makeRelease({ tag_name: 'v0.53.0', name: 'v0.53.0' });
      const v51 = makeRelease({ tag_name: 'v0.51.0', name: 'v0.51.0' });
      const v50 = makeRelease({ tag_name: 'v0.50.0', name: 'v0.50.0' });

      // User upgraded to v0.53.0, but GitHub already has v0.54.0 and v0.55.0
      mockGetVersionInfo.mockResolvedValue({ version: '0.53.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [v55, v54, v53, v51, v50],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(true);
      // Only v0.51.0 and v0.53.0 should show (between v0.50.0 and v0.53.0)
      expect(result.current.unseenReleases).toHaveLength(2);
      expect(result.current.unseenReleases[0].tag_name).toBe('v0.53.0');
      expect(result.current.unseenReleases[1].tag_name).toBe('v0.51.0');
    });

    it('does not show modal when user has not upgraded (lastSeen equals currentVersion)', async () => {
      const userId = 14;
      mockLocalStorageGetItem(storageKey(userId), 'v0.50.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const v55 = makeRelease({ tag_name: 'v0.55.0', name: 'v0.55.0' });
      const v50 = makeRelease({ tag_name: 'v0.50.0', name: 'v0.50.0' });

      // User is still on v0.50.0 - no upgrade happened
      mockGetVersionInfo.mockResolvedValue({ version: '0.50.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [v55, v50],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // No releases between v0.50.0 (lastSeen) and v0.50.0 (currentVersion)
      expect(result.current.showModal).toBe(false);
      expect(result.current.unseenReleases).toHaveLength(0);
    });

    it('does not show modal when stored version (without v-prefix) equals current version', async () => {
      const userId = 3;
      // Stored without leading 'v'; current version also without leading 'v'
      mockLocalStorageGetItem(storageKey(userId), '0.58.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const release = makeRelease({ tag_name: 'v0.58.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [release],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showModal).toBe(false);
    });
  });

  describe('dismissModal', () => {
    it('sets showModal to false when dismissed', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(5) as ReturnType<typeof useAuth>);

      const release = makeRelease({ tag_name: 'v0.58.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [release],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.showModal).toBe(true));

      act(() => {
        result.current.dismissModal();
      });

      expect(result.current.showModal).toBe(false);
    });

    it('writes currentVersion to localStorage under the user-specific key', async () => {
      const userId = 9;
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const release = makeRelease({ tag_name: 'v0.58.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [release],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const spy = captureLocalStorageSetItem();

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.showModal).toBe(true));
      await waitFor(() => expect(result.current.currentVersion).toBe('0.58.0'));

      act(() => {
        result.current.dismissModal();
      });

      expect(spy.getLastCall(storageKey(userId))).toBe('0.58.0');
    });

    it('does not call localStorage.setItem when currentVersion is empty', async () => {
      const userId = 2;
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      // API failure means currentVersion stays as empty string
      mockGetVersionInfo.mockRejectedValue(new Error('network error'));
      mockGetReleaseNotes.mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Confirm currentVersion is empty before dismissing
      expect(result.current.currentVersion).toBe('');

      act(() => {
        result.current.dismissModal();
      });

      // setItem should not have been called for the storage key
      const setItemCalls = vi.mocked(localStorage.setItem).mock.calls;
      const storedForUser = setItemCalls.find(([k]) => k === storageKey(userId));
      expect(storedForUser).toBeUndefined();
    });
  });

  describe('loading and error states', () => {
    it('starts in loading state while fetch is pending', () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      // Never resolves
      mockGetVersionInfo.mockReturnValue(new Promise(() => {}));
      mockGetReleaseNotes.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      expect(result.current.loading).toBe(true);
    });

    it('sets error when the API call throws an Error', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      mockGetVersionInfo.mockRejectedValue(new Error('Server error'));
      mockGetReleaseNotes.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('Server error');
      expect(result.current.showModal).toBe(false);
    });

    it('sets a generic error message for non-Error rejection', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      mockGetVersionInfo.mockRejectedValue('string rejection');
      mockGetReleaseNotes.mockRejectedValue('string rejection');

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('Failed to fetch release notes');
    });

    it('exposes all releases in the releases field after a successful fetch', async () => {
      mockUseAuth.mockReturnValue(makeAuthenticatedUser(1) as ReturnType<typeof useAuth>);

      const releases = [
        makeRelease({ tag_name: 'v0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0' }),
      ];

      mockGetVersionInfo.mockResolvedValue({ version: '0.57.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases,
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.releases).toHaveLength(2);
    });
  });

  describe('version comparison edge cases', () => {
    it('treats "v0.57.0" stored value and "0.57.0" current version as equal', async () => {
      const userId = 11;
      // Stored has leading 'v', current version from server does not
      mockLocalStorageGetItem(storageKey(userId), 'v0.57.0');

      mockUseAuth.mockReturnValue(makeAuthenticatedUser(userId) as ReturnType<typeof useAuth>);

      const v58 = makeRelease({ tag_name: 'v0.58.0' });
      const v57 = makeRelease({ tag_name: 'v0.57.0' });

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({
        releases: [v58, v57],
      } as Awaited<ReturnType<typeof getReleaseNotes>>);

      const { result } = renderHook(() => useReleaseNotes(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Only v0.58.0 is strictly newer than v0.57.0
      expect(result.current.unseenReleases).toHaveLength(1);
      expect(result.current.unseenReleases[0].tag_name).toBe('v0.58.0');
    });
  });
});
