import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import render from '../../../test-utils/render';
import Footer from '../Footer';
import { clearLatestVersionCache } from '../../../hooks/useLatestVersion';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  default: {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}));

vi.mock('../../../services/systemService', () => ({
  getReleaseNotes: vi.fn(),
}));

import { useAuth } from '../../../contexts/AuthContext';
import { getReleaseNotes } from '../../../services/systemService';

const mockUseAuth = vi.mocked(useAuth);
const mockGetReleaseNotes = vi.mocked(getReleaseNotes);

const signedIn = (isAuthenticated: boolean) =>
  mockUseAuth.mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);

beforeEach(() => {
  vi.clearAllMocks();
  clearLatestVersionCache();
  mockGetReleaseNotes.mockResolvedValue({
    releases: [],
    latest_version: 'v0.73.0',
  } as Awaited<ReturnType<typeof getReleaseNotes>>);
});

test('shows the update label next to the copyright when signed in', async () => {
  signedIn(true);

  render(<Footer />);

  expect(
    await screen.findByText('(update available: v0.73.0)')
  ).toBeInTheDocument();
});

test('shows nothing when the instance is up to date', async () => {
  signedIn(true);
  mockGetReleaseNotes.mockResolvedValue({
    releases: [],
    latest_version: null,
  } as Awaited<ReturnType<typeof getReleaseNotes>>);

  render(<Footer />);

  await waitFor(() => expect(mockGetReleaseNotes).toHaveBeenCalled());
  expect(screen.queryByText(/update available/)).not.toBeInTheDocument();
});

test('does not check for updates before sign-in', () => {
  signedIn(false);

  render(<Footer />);

  expect(mockGetReleaseNotes).not.toHaveBeenCalled();
  expect(screen.queryByText(/update available/)).not.toBeInTheDocument();
});
