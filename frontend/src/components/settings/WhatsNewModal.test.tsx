import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import WhatsNewModal from './WhatsNewModal';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      if (
        fallbackOrOpts &&
        typeof fallbackOrOpts === 'object' &&
        'defaultValue' in fallbackOrOpts
      ) {
        return String(fallbackOrOpts.defaultValue);
      }
      return key;
    },
  }),
}));

// Stub the heavy responsive modal with a lightweight wrapper so content is
// accessible but the full responsive logic is not under test here.
vi.mock('../adapters/ResponsiveModal', () => ({
  ResponsiveModal: ({
    opened,
    onClose,
    title,
    children,
  }: {
    opened: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    opened ? (
      <div role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="close dialog">
          close
        </button>
        {children}
      </div>
    ) : null,
}));

// Stub the Button adapter so we get a plain <button> with accessible text.
vi.mock('../ui', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

// sanitize-html is a heavy dependency; return input unchanged for these tests
// since XSS behaviour is covered in markdownRenderer.test.ts.
vi.mock('sanitize-html', () => ({
  default: vi.fn((html: string) => html),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeRelease(
  overrides: Partial<{
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
  }> = {}
) {
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
// Shared render helper
// ---------------------------------------------------------------------------

function renderModal(
  props: Partial<{
    opened: boolean;
    onClose: () => void;
    releases: ReturnType<typeof makeRelease>[];
    currentVersion: string;
  }> = {}
) {
  const merged = {
    opened: true,
    onClose: vi.fn(),
    releases: [makeRelease()],
    currentVersion: '0.58.0',
    ...props,
  };
  return render(<WhatsNewModal {...merged} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsNewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders the modal when opened is true', () => {
      renderModal({ opened: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render the modal when opened is false', () => {
      renderModal({ opened: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('release content', () => {
    it('renders the release name', () => {
      renderModal({
        releases: [makeRelease({ name: 'Version 0.58.0' })],
      });
      expect(screen.getByText('Version 0.58.0')).toBeInTheDocument();
    });

    it('falls back to tag_name when release name is empty', () => {
      renderModal({
        releases: [makeRelease({ name: '', tag_name: 'v0.58.0' })],
      });
      expect(screen.getByText('v0.58.0')).toBeInTheDocument();
    });

    it('renders release notes body as HTML', () => {
      const release = makeRelease({ body: '## Heading\n- item one' });
      renderModal({ releases: [release] });
      // The body div is present (renderReleaseMarkdown will produce HTML tags)
      expect(document.querySelector('.release-notes-body')).toBeInTheDocument();
    });

    it('shows "no changes" fallback when body is empty', () => {
      renderModal({
        releases: [makeRelease({ body: '' })],
      });
      expect(
        screen.getByText('No changes listed for this release')
      ).toBeInTheDocument();
    });

    it('renders multiple releases', () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', name: 'Release 0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' }),
      ];
      renderModal({ releases, currentVersion: '0.58.0' });
      expect(screen.getByText('Release 0.58.0')).toBeInTheDocument();
      expect(screen.getByText('Release 0.57.0')).toBeInTheDocument();
    });
  });

  describe('"Current" badge', () => {
    it('shows the "Current" badge for the release matching currentVersion', () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', name: 'Release 0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' }),
      ];
      renderModal({ releases, currentVersion: '0.58.0' });
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('does not show the "Current" badge for non-current releases', () => {
      const releases = [
        makeRelease({ tag_name: 'v0.58.0', name: 'Release 0.58.0' }),
        makeRelease({ tag_name: 'v0.57.0', name: 'Release 0.57.0' }),
      ];
      renderModal({ releases, currentVersion: '0.58.0' });
      // Only one badge for the current version
      expect(screen.getAllByText('Current')).toHaveLength(1);
    });

    it('matches version with leading "v" prefix against currentVersion without prefix', () => {
      renderModal({
        releases: [makeRelease({ tag_name: 'v0.58.0' })],
        currentVersion: '0.58.0',
      });
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('does not show "Current" badge when no release matches currentVersion', () => {
      renderModal({
        releases: [makeRelease({ tag_name: 'v0.57.0' })],
        currentVersion: '0.58.0',
      });
      expect(screen.queryByText('Current')).not.toBeInTheDocument();
    });
  });

  describe('empty releases', () => {
    it('shows the empty state message when releases array is empty', () => {
      renderModal({ releases: [] });
      expect(
        screen.getByText('No release notes available')
      ).toBeInTheDocument();
    });

    it('does not render a release-notes-body div when releases is empty', () => {
      renderModal({ releases: [] });
      expect(
        document.querySelector('.release-notes-body')
      ).not.toBeInTheDocument();
    });
  });

  describe('"View on GitHub" links', () => {
    it('renders a "View on GitHub" link for each release', () => {
      const releases = [
        makeRelease({
          tag_name: 'v0.58.0',
          html_url: 'https://github.com/example/releases/tag/v0.58.0',
        }),
        makeRelease({
          tag_name: 'v0.57.0',
          html_url: 'https://github.com/example/releases/tag/v0.57.0',
        }),
      ];
      renderModal({ releases });
      const links = screen.getAllByText('View on GitHub');
      expect(links).toHaveLength(2);
    });

    it('sets correct href on "View on GitHub" link', () => {
      const url = 'https://github.com/example/releases/tag/v0.58.0';
      renderModal({
        releases: [makeRelease({ html_url: url })],
      });
      const link = screen.getByText('View on GitHub').closest('a');
      expect(link).toHaveAttribute('href', url);
    });

    it('sets target="_blank" on "View on GitHub" link', () => {
      renderModal();
      const link = screen.getByText('View on GitHub').closest('a');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('dismiss button', () => {
    it('renders the dismiss button', () => {
      renderModal();
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });

    it('calls onClose when the dismiss button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByText('Got it'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the modal close button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByLabelText('close dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('date formatting', () => {
    it('renders the published date for a release', () => {
      // The component formats the date; we just confirm something is rendered
      // in the vicinity of the release without asserting locale-specific strings.
      renderModal({
        releases: [makeRelease({ published_at: '2026-03-01T00:00:00Z' })],
      });
      // The "Released {{date}}" fallback from publishedOn translation should appear
      expect(screen.getByText(/Released /)).toBeInTheDocument();
    });
  });
});
