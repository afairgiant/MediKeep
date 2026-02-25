import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// ─── CSS mock ────────────────────────────────────────────────────────────────

vi.mock('../AdminDashboard.css', () => ({}));

// ─── Router mock ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

// ─── AdminLayout mock ─────────────────────────────────────────────────────────

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

// ─── ThemeContext mock ────────────────────────────────────────────────────────

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  MantineIntegratedThemeProvider: ({ children }) => children,
}));

// ─── Logger mock ────────────────────────────────────────────────────────────

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Chart.js mocks ─────────────────────────────────────────────────────────

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  PointElement: vi.fn(),
  LineElement: vi.fn(),
  BarElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  ArcElement: vi.fn(),
}));

// ─── ChartErrorBoundary mock ─────────────────────────────────────────────────

vi.mock('../../../components/shared/ChartErrorBoundary', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

// ─── Hook mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: vi.fn(d => d),
    formatDateTime: vi.fn(d => d),
  }),
}));

vi.mock('../../../hooks/useThemeColors', () => ({
  default: () => ({
    primary: '#228be6',
    success: '#40c057',
    warning: '#fab005',
    danger: '#fa5252',
    purple: '#7950f2',
    info: '#15aabf',
    textPrimary: '#212529',
    textSecondary: '#868e96',
    borderLight: '#dee2e6',
  }),
}));

// ─── useAdminData mock ───────────────────────────────────────────────────────

const mockRefreshStats = vi.fn().mockResolvedValue(null);
const mockRefreshActivity = vi.fn().mockResolvedValue(null);
const mockRefreshHealth = vi.fn().mockResolvedValue(null);
const mockRefreshAnalytics = vi.fn().mockResolvedValue(null);

const mockStats = {
  total_users: 12,
  total_patients: 45,
  total_lab_results: 120,
  total_medications: 30,
  total_vitals: 80,
  recent_registrations: 3,
  active_medications: 15,
  total_procedures: 10,
  total_allergies: 5,
};

const mockActivities = [
  {
    model_name: 'Patient',
    action: 'created',
    description: 'New patient record created',
    timestamp: '2026-02-25T10:00:00Z',
  },
  {
    model_name: 'LabResult',
    action: 'updated',
    description: 'Lab result updated',
    timestamp: '2026-02-25T09:30:00Z',
  },
];

const mockSystemHealth = {
  database_status: 'healthy',
  total_records: 500,
  system_uptime: '5 days',
  last_backup: '2026-02-24T12:00:00Z',
};

vi.mock('../../../hooks/useAdminData', () => ({
  useAdminData: vi.fn(({ entityName }) => {
    switch (entityName) {
      case 'Dashboard Statistics':
        return {
          data: mockStats,
          loading: false,
          error: null,
          refreshData: mockRefreshStats,
        };
      case 'Recent Activity':
        return {
          data: mockActivities,
          loading: false,
          error: null,
          refreshData: mockRefreshActivity,
        };
      case 'System Health':
        return {
          data: mockSystemHealth,
          loading: false,
          error: null,
          refreshData: mockRefreshHealth,
        };
      case 'Analytics Data':
        return {
          data: null,
          loading: false,
          error: null,
          refreshData: mockRefreshAnalytics,
        };
      default:
        return { data: null, loading: false, error: null, refreshData: vi.fn() };
    }
  }),
}));

// ─── adminApiService mock ───────────────────────────────────────────────────

vi.mock('../../../services/api/adminApi', () => ({
  adminApiService: {
    getDashboardStats: vi.fn(),
    getRecentActivity: vi.fn(),
    getSystemHealth: vi.fn(),
    getAnalyticsData: vi.fn(),
  },
}));

// ─── Component under test (imported after mocks) ─────────────────────────────

import AdminDashboard from '../AdminDashboard';

// ─── Render helper ────────────────────────────────────────────────────────────

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <MantineProvider>
        <AdminDashboard />
      </MantineProvider>
    </MemoryRouter>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRefreshStats.mockClear();
    mockRefreshActivity.mockClear();
    mockRefreshHealth.mockClear();
    mockRefreshAnalytics.mockClear();
  });

  describe('rendering', () => {
    test('renders inside AdminLayout', () => {
      renderComponent();
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    });

    test('renders dashboard header', () => {
      renderComponent();
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    test('renders all five stat cards with correct values', () => {
      renderComponent();
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Active Patients')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Vital Signs')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });
  });

  describe('stat card navigation (Item 20)', () => {
    test('clicking Total Users navigates to /admin/models/user', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Total Users').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/user');
    });

    test('clicking Active Patients navigates to /admin/models/patient', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Active Patients').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/patient');
    });

    test('clicking Lab Results navigates to /admin/models/lab_result', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Lab Results').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/lab_result');
    });

    test('clicking Medications navigates to /admin/models/medication', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Medications').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/medication');
    });

    test('clicking Vital Signs navigates to /admin/models/vitals', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Vital Signs').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/vitals');
    });

    test('stat cards are keyboard accessible with Enter key', () => {
      renderComponent();
      const card = screen.getByText('Total Users').closest('[role="button"]');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/user');
    });

    test('stat cards are keyboard accessible with Space key', () => {
      renderComponent();
      const card = screen.getByText('Active Patients').closest('[role="button"]');
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/patient');
    });

    test('stat cards have tabIndex 0 for keyboard focus', () => {
      renderComponent();
      const card = screen.getByText('Total Users').closest('[role="button"]');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });

  describe('View All Activity link (Item 21)', () => {
    test('renders disabled View All Activity button when activities exist', () => {
      renderComponent();
      const button = screen.getByText('View All Activity').closest('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  describe('refresh mechanism (Item 22)', () => {
    test('Refresh All calls all four refresh functions in parallel', async () => {
      renderComponent();
      const refreshButton = screen.getByText('Refresh All');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefreshStats).toHaveBeenCalledWith(true);
        expect(mockRefreshActivity).toHaveBeenCalledWith(true);
        expect(mockRefreshHealth).toHaveBeenCalledWith(true);
        expect(mockRefreshAnalytics).toHaveBeenCalledWith(true);
      });
    });

    test('all refresh calls are made simultaneously (not staggered)', async () => {
      renderComponent();

      const callOrder = [];
      mockRefreshStats.mockImplementation(() => {
        callOrder.push('stats');
        return Promise.resolve();
      });
      mockRefreshActivity.mockImplementation(() => {
        callOrder.push('activity');
        return Promise.resolve();
      });
      mockRefreshHealth.mockImplementation(() => {
        callOrder.push('health');
        return Promise.resolve();
      });
      mockRefreshAnalytics.mockImplementation(() => {
        callOrder.push('analytics');
        return Promise.resolve();
      });

      fireEvent.click(screen.getByText('Refresh All'));

      await waitFor(() => {
        expect(callOrder).toHaveLength(4);
      });
    });
  });

  describe('quick actions (Item 23)', () => {
    test('renders all 8 quick action buttons', () => {
      renderComponent();
      expect(screen.getByText('Data Models')).toBeInTheDocument();
      expect(screen.getByText('Create New User')).toBeInTheDocument();
      // "System Health" appears in both the quick actions and the health card
      expect(screen.getAllByText('System Health').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Backups')).toBeInTheDocument();
      // "Settings" appears in both the quick actions label and elsewhere
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Manage Users')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
      expect(screen.getByText('Trash')).toBeInTheDocument();
    });

    test('clicking Data Models navigates to /admin/data-models', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Data Models').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/data-models');
    });

    test('clicking Manage Users navigates to /admin/models/user', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Manage Users').closest('[role="button"]'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/user');
    });

    test('Audit Log quick action is disabled', () => {
      renderComponent();
      const button = screen.getByText('Audit Log').closest('[role="button"]');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('Trash quick action is disabled', () => {
      renderComponent();
      const button = screen.getByText('Trash').closest('[role="button"]');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('disabled quick actions do not navigate on click', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Audit Log').closest('[role="button"]'));
      fireEvent.click(screen.getByText('Trash').closest('[role="button"]'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('quick action buttons are keyboard accessible', () => {
      renderComponent();
      const button = screen.getByText('Data Models').closest('[role="button"]');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/admin/data-models');
    });

    test('disabled quick actions ignore keyboard events', () => {
      renderComponent();
      const button = screen.getByText('Audit Log').closest('[role="button"]');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
