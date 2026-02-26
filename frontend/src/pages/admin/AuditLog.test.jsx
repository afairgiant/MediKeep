import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Must be before any component imports so ResizeObserver is available
vi.hoisted(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// Mock AdminLayout
vi.mock('../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

// Mock ThemeContext (avoids matchMedia issues)
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  MantineIntegratedThemeProvider: ({ children }) => children,
}));

// Mock logger
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock useDateFormat
vi.mock('../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDateTime: (d) => d || '-',
    formatDate: (d) => d || '-',
  }),
}));

// Mock the admin API service
const mockGetActivityLog = vi.fn();
const mockGetActivityLogFilters = vi.fn();
const mockExportActivityLog = vi.fn();

vi.mock('../../services/api/adminApi', () => ({
  adminApiService: {
    getActivityLog: (...args) => mockGetActivityLog(...args),
    getActivityLogFilters: (...args) => mockGetActivityLogFilters(...args),
    exportActivityLog: (...args) => mockExportActivityLog(...args),
  },
  default: {
    getActivityLog: (...args) => mockGetActivityLog(...args),
    getActivityLogFilters: (...args) => mockGetActivityLogFilters(...args),
    exportActivityLog: (...args) => mockExportActivityLog(...args),
  },
}));

// Mock @mantine/dates (DatePickerInput uses complex internals)
vi.mock('@mantine/dates', () => ({
  DatePickerInput: ({ value, onChange, placeholder, ...props }) => (
    <input
      data-testid="date-range-input"
      placeholder={placeholder}
      onChange={() => {}}
      {...props}
    />
  ),
}));

import AuditLog from './AuditLog';

const mockFilters = {
  actions: [
    { value: 'created', label: 'Created' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'updated', label: 'Updated' },
  ],
  entity_types: [
    { value: 'patient', label: 'Patient' },
    { value: 'medication', label: 'Medication' },
  ],
  users: [
    { value: 1, label: 'admin' },
  ],
};

const mockData = {
  items: [
    {
      id: 1,
      user_id: 1,
      username: 'admin',
      action: 'created',
      entity_type: 'patient',
      entity_type_display: 'Patient',
      entity_id: 42,
      description: 'Created patient record for John Doe',
      timestamp: '2024-01-15T10:30:00',
      ip_address: '127.0.0.1',
    },
    {
      id: 2,
      user_id: 1,
      username: 'admin',
      action: 'deleted',
      entity_type: 'medication',
      entity_type_display: 'Medication',
      entity_id: 10,
      description: 'Deleted medication record',
      timestamp: '2024-01-15T09:00:00',
      ip_address: '127.0.0.1',
    },
  ],
  total: 2,
  page: 1,
  per_page: 50,
  total_pages: 1,
};

const emptyData = {
  items: [],
  total: 0,
  page: 1,
  per_page: 50,
  total_pages: 1,
};

function renderAuditLog() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <AuditLog />
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActivityLogFilters.mockResolvedValue(mockFilters);
    mockGetActivityLog.mockResolvedValue(mockData);
    mockExportActivityLog.mockResolvedValue(new Blob(['csv,data'], { type: 'text/csv' }));

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetActivityLog.mockReturnValue(new Promise(() => {}));
    renderAuditLog();

    expect(screen.getByText('Loading audit log...')).toBeInTheDocument();
  });

  it('renders data table with entries', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Created patient record for John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Deleted medication record')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 2 results')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    expect(screen.getByText('Complete activity trail for compliance and auditing')).toBeInTheDocument();
  });

  it('renders empty state when no results', async () => {
    mockGetActivityLog.mockResolvedValue(emptyData);
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('No activity logs found')).toBeInTheDocument();
    });
  });

  it('search input triggers API call with debounce', async () => {
    vi.useFakeTimers();
    renderAuditLog();

    await waitFor(() => {
      expect(mockGetActivityLog).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText('Search descriptions...');
    fireEvent.change(searchInput, { target: { value: 'patient' } });

    // Before debounce fires
    expect(mockGetActivityLog).toHaveBeenCalledTimes(1);

    // After debounce
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockGetActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'patient' })
      );
    });

    vi.useRealTimers();
  });

  it('export button triggers download', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(mockExportActivityLog).toHaveBeenCalled();
    });
  });

  it('fetches filters on mount', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(mockGetActivityLogFilters).toHaveBeenCalledTimes(1);
    });
  });

  it('renders error state with retry', async () => {
    mockGetActivityLog.mockRejectedValueOnce(new Error('Network error'));
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Error loading audit log')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders action badges with correct text', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('created')).toBeInTheDocument();
      expect(screen.getByText('deleted')).toBeInTheDocument();
    });
  });

  it('renders entity type display names', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getAllByText('Patient').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medication').length).toBeGreaterThan(0);
    });
  });

  it('renders link icon for entries with entity_id and linkable type', async () => {
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Created patient record for John Doe')).toBeInTheDocument();
    });

    // First entry (created/patient) should have a link, second (deleted/medication) should not
    const linkButtons = screen.getAllByRole('button', { name: /^View / });
    expect(linkButtons.length).toBe(1);
  });

  it('does not render link for deleted entries', async () => {
    const deletedOnlyData = {
      items: [mockData.items[1]], // deleted medication entry
      total: 1,
      page: 1,
      per_page: 50,
      total_pages: 1,
    };
    mockGetActivityLog.mockResolvedValue(deletedOnlyData);
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Deleted medication record')).toBeInTheDocument();
    });

    // entity_id should show as plain text, not a link button
    expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders dash for entries without entity_id', async () => {
    const dataWithNoEntityId = {
      ...mockData,
      items: [
        { ...mockData.items[0], entity_id: null, entity_type: 'system' },
      ],
      total: 1,
    };
    mockGetActivityLog.mockResolvedValue(dataWithNoEntityId);
    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  it('pagination changes page', async () => {
    const paginatedData = {
      ...mockData,
      total: 100,
      total_pages: 2,
    };
    mockGetActivityLog.mockResolvedValue(paginatedData);

    renderAuditLog();

    await waitFor(() => {
      expect(screen.getByText('Created patient record for John Doe')).toBeInTheDocument();
    });

    const page2Button = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Button);

    await waitFor(() => {
      expect(mockGetActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });
});
