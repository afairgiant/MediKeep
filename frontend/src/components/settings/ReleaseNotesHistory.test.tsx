import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import render from '../../test-utils/render';
import ReleaseNotesHistory from './ReleaseNotesHistory';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      if (fallbackOrOpts && typeof fallbackOrOpts === 'object' && 'defaultValue' in fallbackOrOpts) {
        return String(fallbackOrOpts.defaultValue);
      }
      return key;
    },
  }),
}));

vi.mock('../../services/systemService', () => ({
  getVersionInfo: vi.fn(),
  getReleaseNotes: vi.fn(),
}));

// sanitize-html is a heavy dependency; return input unchanged for these tests.
vi.mock('sanitize-html', () => ({
  default: vi.fn((html: string) => html),
}));

// Stub Mantine's Accordion so we can test content without full Mantine setup.
// The Accordion.Control text and Accordion.Panel content are rendered directly.
vi.mock('@mantine/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mantine/core')>();
  return {
    ...original,
    Accordion: Object.assign(
      ({ children }: { children: React.ReactNode }) => (
        <div data-testid="accordion">{children}</div>
      ),
      {
        Item: ({ children, value }: { children: React.ReactNode; value: string }) => (
          <div data-testid={`accordion-item-${value}`}>{children}</div>
        ),
        Control: ({ children }: { children: React.ReactNode }) => (
          <div data-testid="accordion-control">{children}</div>
        ),
        Panel: ({ children }: { children: React.ReactNode }) => (
          <div data-testid="accordion-panel">{children}</div>
        ),
      }
    ),
    Skeleton: ({ height }: { height?: number }) => (
      <div data-testid="skeleton" style={{ height }} />
    ),
    Badge: ({ children, ...rest }: { children: React.ReactNode }) => (
      <span data-testid="badge" {...rest}>{children}</span>
    ),
    Group: ({ children, ...rest }: { children: React.ReactNode }) => (
      <div {...rest}>{children}</div>
    ),
    Text: ({ children, ...rest }: { children: React.ReactNode }) => (
      <span {...rest}>{children}</span>
    ),
    Anchor: ({
      children,
      href,
      target,
      rel,
      ...rest
    }: {
      children: React.ReactNode;
      href?: string;
      target?: string;
      rel?: string;
    }) => (
      <a href={href} target={target} rel={rel} {...rest}>
        {children}
      </a>
    ),
    Stack: ({ children, ...rest }: { children: React.ReactNode }) => (
      <div {...rest}>{children}</div>
    ),
  };
});

// Stub the Button adapter to a plain <button>.
vi.mock('../ui', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

// ---------------------------------------------------------------------------
// Import mocked service so we can configure it per-test
// ---------------------------------------------------------------------------

import { getVersionInfo, getReleaseNotes } from '../../services/systemService';

const mockGetVersionInfo = vi.mocked(getVersionInfo);
const mockGetReleaseNotes = vi.mocked(getReleaseNotes);

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReleaseNotesHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders skeleton placeholders while data is loading', () => {
      // Never resolves so the component stays in loading state
      mockGetVersionInfo.mockReturnValue(new Promise(() => {}));
      mockGetReleaseNotes.mockReturnValue(new Promise(() => {}));

      render(<ReleaseNotesHistory />);

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render the accordion while loading', () => {
      mockGetVersionInfo.mockReturnValue(new Promise(() => {}));
      mockGetReleaseNotes.mockReturnValue(new Promise(() => {}));

      render(<ReleaseNotesHistory />);

      expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
    });
  });

  describe('successful data fetch', () => {
    it('renders only the latest release when collapsed', async () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', name: 'Release 0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' }),
      ];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Release 0.58.0')).toBeInTheDocument();
      });
      expect(screen.queryByText('Release 0.57.0')).not.toBeInTheDocument();
    });

    it('renders all releases after clicking "Show more releases"', async () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', name: 'Release 0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' }),
      ];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Release 0.58.0')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Show more releases'));

      expect(screen.getByText('Release 0.57.0')).toBeInTheDocument();
    });

    it('shows the "Current" badge for the release matching currentVersion', async () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0' }),
      ];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Current')).toBeInTheDocument();
      });
      expect(screen.getAllByText('Current')).toHaveLength(1);
    });

    it('does not show "Current" badge when no release matches currentVersion', async () => {
      const releases = [makeRelease({ tag_name: 'v0.57.0' })];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.queryByTestId('accordion')).toBeInTheDocument();
      });
      expect(screen.queryByText('Current')).not.toBeInTheDocument();
    });

    it('renders a "View on GitHub" link for the visible release', async () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', html_url: 'https://github.com/example/v0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', html_url: 'https://github.com/example/v0.57.0' }),
      ];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getAllByText('View on GitHub')).toHaveLength(1);
      });

      // Expand to see all
      fireEvent.click(screen.getByText('Show more releases'));
      expect(screen.getAllByText('View on GitHub')).toHaveLength(2);
    });

    it('renders release body content inside the accordion panel', async () => {
      const releases = [makeRelease({ tag_name: 'v0.58.0', body: '## Changes\n- new feature' })];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(document.querySelector('.release-notes-body')).toBeInTheDocument();
      });
    });

    it('shows "no changes" text when a release body is empty', async () => {
      const releases = [makeRelease({ body: '' })];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('No changes listed for this release')).toBeInTheDocument();
      });
    });

    it('falls back to tag_name when release name is empty', async () => {
      const releases = [makeRelease({ name: '', tag_name: 'v0.58.0' })];

      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('v0.58.0')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('renders the empty state message when releases array is empty', async () => {
      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases: [] } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('No release notes available')).toBeInTheDocument();
      });
    });

    it('does not render the accordion when releases array is empty', async () => {
      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases: [] } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    it('renders the error message when the API call fails', async () => {
      mockGetVersionInfo.mockRejectedValue(new Error('Network error'));
      mockGetReleaseNotes.mockRejectedValue(new Error('Network error'));

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load release notes')).toBeInTheDocument();
      });
    });

    it('renders a retry button in the error state', async () => {
      mockGetVersionInfo.mockRejectedValue(new Error('Network error'));
      mockGetReleaseNotes.mockRejectedValue(new Error('Network error'));

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('retries the fetch when the retry button is clicked', async () => {
      // First call fails, second call succeeds
      mockGetVersionInfo
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          releases: [makeRelease({ name: 'Retry success' })],
        } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText('Retry success')).toBeInTheDocument();
      });
    });

    it('does not render the accordion in the error state', async () => {
      mockGetVersionInfo.mockRejectedValue(new Error('Network error'));
      mockGetReleaseNotes.mockRejectedValue(new Error('Network error'));

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls getVersionInfo and getReleaseNotes on mount', async () => {
      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases: [] } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(mockGetVersionInfo).toHaveBeenCalledTimes(1);
        expect(mockGetReleaseNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('requests 5 releases from getReleaseNotes', async () => {
      mockGetVersionInfo.mockResolvedValue({ version: '0.58.0' } as Awaited<ReturnType<typeof getVersionInfo>>);
      mockGetReleaseNotes.mockResolvedValue({ releases: [] } as Awaited<ReturnType<typeof getReleaseNotes>>);

      render(<ReleaseNotesHistory />);

      await waitFor(() => {
        expect(mockGetReleaseNotes).toHaveBeenCalledWith(5);
      });
    });
  });
});
