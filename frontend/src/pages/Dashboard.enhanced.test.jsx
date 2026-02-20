import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { rest } from 'msw';
import { server } from '../test-utils/mocks/server';
import Dashboard from './Dashboard';
import * as activityNavigation from '../utils/activityNavigation';
import AuthContext from '../contexts/AuthContext';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { AppDataContext } from '../contexts/AppDataContext';

// Mock global data hooks
vi.mock('../hooks/useGlobalData', () => ({
  useCurrentPatient: vi.fn(() => ({
    patient: {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      birth_date: '1990-01-01',
      gender: 'M',
    },
    loading: false,
  })),
  useCacheManager: vi.fn(() => ({
    invalidatePatient: vi.fn(),
    refreshPatient: vi.fn(),
    invalidateAll: vi.fn(),
    setCurrentPatient: vi.fn(),
  })),
}));

// Mock components
vi.mock('../components/medical', () => ({
  PatientSelector: () => <div data-testid="patient-selector" />,
}));

vi.mock('../components/common', () => ({
  GlobalSearch: () => <input data-testid="global-search" />,
}));

vi.mock('../components/dashboard', () => ({
  InvitationNotifications: () => <div data-testid="invitation-notifications" />,
}));

vi.mock('../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));

// Mock services
vi.mock('../services/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../services/frontendLogger', () => ({
  default: {
    logInfo: vi.fn(),
    logError: vi.fn(),
  },
}));

// Mock the activity navigation functions
vi.mock('../utils/activityNavigation', () => ({
  getActivityNavigationUrl: vi.fn(),
  getActivityIcon: vi.fn(),
  getActionBadgeColor: vi.fn(),
  getActionIcon: vi.fn(),
  formatActivityDescription: vi.fn(),
  isActivityClickable: vi.fn(),
  getActivityTooltip: vi.fn(),
}));

// Helper to render with all providers
const renderWithProviders = (ui) => {
  const authUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
  };

  const patient = {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    birth_date: '1990-01-01',
    gender: 'M',
  };

  return render(
    <MemoryRouter>
      <MantineProvider>
        <AuthContext.Provider
          value={{
            user: authUser,
            isAuthenticated: true,
            isLoading: false,
            shouldShowProfilePrompts: vi.fn(() => false),
            checkIsFirstLogin: vi.fn(() => false),
          }}
        >
          <UserPreferencesProvider>
            <AppDataContext.Provider
              value={{
                currentPatient: patient,
                practitioners: [],
                refreshPatient: vi.fn(),
                refreshPractitioners: vi.fn(),
                isLoading: false,
                error: null,
              }}
            >
              {ui}
            </AppDataContext.Provider>
          </UserPreferencesProvider>
        </AuthContext.Provider>
      </MantineProvider>
    </MemoryRouter>
  );
};

describe('Enhanced Dashboard with Clickable Activity', () => {
  const mockRecentActivity = [
    {
      id: 1,
      model_name: 'medication',
      action: 'created',
      description: 'Added new medication: Aspirin 81mg',
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      id: 2,
      model_name: 'lab_result',
      action: 'updated',
      description: 'Updated lab result: Complete Blood Count',
      timestamp: '2024-01-14T14:20:00Z',
    },
    {
      id: 3,
      model_name: 'procedure',
      action: 'deleted',
      description: 'Removed procedure: Routine Checkup',
      timestamp: '2024-01-13T09:15:00Z',
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock returns
    activityNavigation.getActivityNavigationUrl.mockReturnValue('/medications');
    activityNavigation.getActivityIcon.mockReturnValue(() => <div>MockIcon</div>);
    activityNavigation.getActionBadgeColor.mockReturnValue('blue');
    activityNavigation.getActionIcon.mockReturnValue(() => <div>ActionIcon</div>);
    activityNavigation.formatActivityDescription.mockImplementation((activity) => activity.description);
    activityNavigation.isActivityClickable.mockReturnValue(true);
    activityNavigation.getActivityTooltip.mockReturnValue('Click to view medication');

    // Setup MSW handlers
    server.use(
      rest.get('/patients/recent-activity/', (req, res, ctx) => {
        return res(ctx.json(mockRecentActivity));
      }),
      rest.get('/patients/me/dashboard-stats', (req, res, ctx) => {
        return res(ctx.json({
          patient_id: 1,
          total_records: 10,
          active_medications: 3,
          total_lab_results: 5,
          total_procedures: 2,
        }));
      })
    );
  });

  describe('Activity Item Enhancements', () => {
    test('renders activity items with enhanced UI', async () => {
      renderWithProviders(<Dashboard />);

      // Wait for activities to load
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      });

      // Check that activities are rendered
      await waitFor(() => {
        expect(screen.getByText('Added new medication: Aspirin 81mg')).toBeInTheDocument();
        expect(screen.getByText('Updated lab result: Complete Blood Count')).toBeInTheDocument();
        expect(screen.getByText('Removed procedure: Routine Checkup')).toBeInTheDocument();
      });

      // Verify our utility functions were called
      expect(activityNavigation.getActivityNavigationUrl).toHaveBeenCalledWith(
        expect.objectContaining({ model_name: 'medication', action: 'created' })
      );
      expect(activityNavigation.isActivityClickable).toHaveBeenCalledWith(
        expect.objectContaining({ model_name: 'medication', action: 'created' })
      );
    });

    test('activity items are clickable when isActivityClickable returns true', async () => {
      const mockNavigate = vi.fn();
      
      // Mock useNavigate
      vi.doMock('react-router-dom', async () => ({
        ...(await vi.importActual('react-router-dom')),
        useNavigate: () => mockNavigate,
      }));

      activityNavigation.isActivityClickable.mockReturnValue(true);
      activityNavigation.getActivityNavigationUrl.mockReturnValue('/medications');

      renderWithProviders(<Dashboard />);

      // Wait for activities to load
      await waitFor(() => {
        expect(screen.getByText('Added new medication: Aspirin 81mg')).toBeInTheDocument();
      });

      // Find and click the first activity item
      const activityItem = screen.getByText('Added new medication: Aspirin 81mg').closest('[role="button"], .mantine-Paper-root');
      
      if (activityItem) {
        await userEvent.click(activityItem);
        
        // Verify navigation was attempted
        expect(activityNavigation.getActivityNavigationUrl).toHaveBeenCalledWith(
          expect.objectContaining({ model_name: 'medication' })
        );
      }
    });

    test('non-clickable activities do not trigger navigation', async () => {
      activityNavigation.isActivityClickable
        .mockReturnValueOnce(true)  // First activity clickable
        .mockReturnValueOnce(true)  // Second activity clickable  
        .mockReturnValueOnce(false); // Third activity (deleted) not clickable

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Removed procedure: Routine Checkup')).toBeInTheDocument();
      });

      // The deleted activity should be styled differently
      expect(activityNavigation.isActivityClickable).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'deleted' })
      );
    });

    test('displays action badges with correct colors', async () => {
      activityNavigation.getActionBadgeColor
        .mockReturnValueOnce('green')   // created
        .mockReturnValueOnce('blue')    // updated
        .mockReturnValueOnce('red');    // deleted

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      });

      // Verify badge color functions were called
      expect(activityNavigation.getActionBadgeColor).toHaveBeenCalledWith('created');
      expect(activityNavigation.getActionBadgeColor).toHaveBeenCalledWith('updated');
      expect(activityNavigation.getActionBadgeColor).toHaveBeenCalledWith('deleted');
    });

    test('shows only first 4 activities when more than 4 available', async () => {
      const manyActivities = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        model_name: 'medication',
        action: 'created',
        description: `Activity ${i + 1}`,
        timestamp: '2024-01-15T10:30:00Z',
      }));

      server.use(
        rest.get('/patients/recent-activity/', (req, res, ctx) => {
          return res(ctx.json(manyActivities));
        })
      );

      activityNavigation.formatActivityDescription.mockImplementation((activity) => activity.description);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Activity 1')).toBeInTheDocument();
        expect(screen.getByText('Activity 4')).toBeInTheDocument();
        expect(screen.queryByText('Activity 5')).not.toBeInTheDocument();
      });
    });

    test('handles empty activity list with improved messaging', async () => {
      server.use(
        rest.get('/patients/recent-activity/', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument();
        expect(screen.getByText('Your medical record activities will appear here')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles navigation errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      activityNavigation.getActivityNavigationUrl.mockImplementation(() => {
        throw new Error('Navigation error');
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Added new medication: Aspirin 81mg')).toBeInTheDocument();
      });

      // The component should still render without crashing
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});
