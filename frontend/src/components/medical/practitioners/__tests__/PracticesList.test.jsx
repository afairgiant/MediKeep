import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import PracticesList from '../PracticesList';

// Mock hooks
const mockRefresh = vi.fn();
vi.mock('../../../../hooks', () => ({
  usePractices: vi.fn(() => ({
    practices: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
  })),
}));

vi.mock('../../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'lg',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (typeof opts === 'string') return opts;
      if (opts?.name) return key.replace('{{name}}', opts.name);
      if (opts?.count !== undefined) return key.replace('{{count}}', opts.count);
      return key;
    },
  }),
}));

// Mock API service
const mockGetPractice = vi.fn();
const mockDeletePractice = vi.fn();
vi.mock('../../../../services/api', () => ({
  apiService: {
    getPractice: (...args) => mockGetPractice(...args),
    deletePractice: (...args) => mockDeletePractice(...args),
  },
}));

// Mock notifications
const mockNotificationsShow = vi.fn();
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args) => mockNotificationsShow(...args),
  },
}));

// Mock frontendLogger
vi.mock('../../../../services/frontendLogger', () => ({
  default: {
    logError: vi.fn(),
    logInfo: vi.fn(),
  },
}));

const { usePractices } = await import('../../../../hooks');

const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

const samplePractices = [
  { id: 1, name: 'City Clinic', phone_number: '555-0100', website: 'https://city.example.com', practitioner_count: 3 },
  { id: 2, name: 'Downtown Health', phone_number: '555-0200', website: null, practitioner_count: 0 },
  { id: 3, name: 'Rural Practice', phone_number: null, website: null, practitioner_count: 1 },
];

describe('PracticesList', () => {
  const defaultProps = {
    onPracticeSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usePractices.mockReturnValue({
      practices: samplePractices,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
  });

  describe('Rendering', () => {
    test('renders table with practices data', () => {
      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      // ResponsiveTable renders both screen and print tables, so use getAllByText
      expect(screen.getAllByText('City Clinic').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Downtown Health').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rural Practice').length).toBeGreaterThan(0);
    });

    test('renders practitioner count badges', () => {
      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      // ResponsiveTable renders both screen and print tables
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    test('shows loading state', () => {
      usePractices.mockReturnValue({
        practices: [],
        loading: true,
        error: null,
        refresh: mockRefresh,
      });

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('practitioners.loading')).toBeInTheDocument();
    });

    test('shows footer counts', () => {
      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('practitioners.practices.totalCount')).toBeInTheDocument();
      expect(screen.getByText('practitioners.practices.unusedCount')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    test('filters practices by name', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      const searchInput = screen.getByPlaceholderText('practitioners.practices.searchPlaceholder');
      await user.type(searchInput, 'City');

      expect(screen.getAllByText('City Clinic').length).toBeGreaterThan(0);
      expect(screen.queryByText('Downtown Health')).not.toBeInTheDocument();
      expect(screen.queryByText('Rural Practice')).not.toBeInTheDocument();
    });

    test('shows empty state when search has no results', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      const searchInput = screen.getByPlaceholderText('practitioners.practices.searchPlaceholder');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('practitioners.practices.emptyTitle')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    test('shows empty state when no practices exist', () => {
      usePractices.mockReturnValue({
        practices: [],
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('practitioners.practices.emptyTitle')).toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    test('delete button is disabled for practices with practitioners', () => {
      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      // Find all delete buttons - those for practices with practitioners should be disabled
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // City Clinic (count=3) - disabled
      expect(deleteButtons[0]).toBeDisabled();
      // Downtown Health (count=0) - enabled
      expect(deleteButtons[1]).not.toBeDisabled();
      // Rural Practice (count=1) - disabled
      expect(deleteButtons[2]).toBeDisabled();
    });

    test('calls delete API after confirmation for practice with 0 practitioners', async () => {
      window.confirm = vi.fn(() => true);
      mockDeletePractice.mockResolvedValue({});

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      // The second practice (Downtown Health) has 0 practitioners
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[1]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeletePractice).toHaveBeenCalledWith(2);

      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'practitioners.practices.deleteSuccess',
            color: 'green',
          })
        );
      });
      expect(mockRefresh).toHaveBeenCalled();
      expect(defaultProps.onPracticeSaved).toHaveBeenCalled();
    });

    test('does not delete when user cancels confirmation', async () => {
      window.confirm = vi.fn(() => false);

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[1]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeletePractice).not.toHaveBeenCalled();
    });
  });

  describe('Edit', () => {
    test('fetches practice and opens edit modal', async () => {
      const practiceData = { id: 1, name: 'City Clinic', phone_number: '555-0100' };
      mockGetPractice.mockResolvedValue(practiceData);

      render(
        <MantineWrapper>
          <PracticesList {...defaultProps} />
        </MantineWrapper>
      );

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(mockGetPractice).toHaveBeenCalledWith(1);
      });
    });
  });
});
