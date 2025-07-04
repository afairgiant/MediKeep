/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import Dashboard from './Dashboard';
import { apiService } from '../services/api';
import frontendLogger from '../services/frontendLogger';
import AuthContext from '../contexts/AuthContext';
import { useCurrentPatient } from '../hooks/useGlobalData';

// Mock dependencies
jest.mock('../services/api');
jest.mock('../services/frontendLogger');
jest.mock('../utils/helpers', () => ({
  formatDateTime: jest.fn((date) => {
    if (!date) return '';
    return new Date(date).toLocaleString();
  }),
}));
jest.mock('../hooks/useGlobalData');
jest.mock('../components/auth/ProfileCompletionModal', () => {
  return function MockProfileCompletionModal({ isOpen, onClose, onComplete }) {
    return isOpen ? (
      <div data-testid="profile-completion-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={onComplete}>Complete</button>
      </div>
    ) : null;
  };
});
jest.mock('../components', () => ({
  PageHeader: ({ title, icon, variant, showBackButton }) => (
    <div data-testid="page-header">
      <span data-testid="header-title">{title}</span>
      <span data-testid="header-icon">{icon}</span>
      <span data-testid="header-variant">{variant}</span>
      <span data-testid="show-back-button">{showBackButton?.toString()}</span>
    </div>
  ),
}));

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock atob for JWT decoding
global.atob = jest.fn(str => {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch {
    return '{}';
  }
});

// Test utilities
const createMockAuthContext = (overrides = {}) => ({
  user: { id: 1, username: 'testuser', role: 'user' },
  shouldShowProfilePrompts: jest.fn(() => false),
  checkIsFirstLogin: jest.fn(() => false),
  ...overrides,
});

const createMockPatientData = (overrides = {}) => ({
  id: 1,
  first_name: 'John',
  last_name: 'Doe',
  birth_date: '1990-01-01',
  gender: 'M',
  address: '123 Test St',
  ...overrides,
});

const renderDashboard = (authContextValue = null, patientData = null) => {
  const defaultAuthContext = createMockAuthContext();
  const mockAuthContext = authContextValue || defaultAuthContext;
  
  const defaultPatientData = createMockPatientData();
  const mockPatientHook = {
    patient: patientData || defaultPatientData,
    loading: false,
  };
  
  useCurrentPatient.mockReturnValue(mockPatientHook);
  
  return render(
    <MemoryRouter>
      <MantineProvider>
        <AuthContext.Provider value={mockAuthContext}>
          <Dashboard />
        </AuthContext.Provider>
      </MantineProvider>
    </MemoryRouter>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Default API mocks
    apiService.getRecentActivity.mockResolvedValue([]);
    apiService.getDashboardStats.mockResolvedValue({
      total_records: 10,
      active_medications: 5,
      total_lab_results: 8,
      total_procedures: 3,
    });
    
    // Mock JWT token for admin check
    localStorageMock.getItem.mockImplementation(key => {
      if (key === 'token') {
        // Mock JWT with user role
        const payload = { role: 'user' };
        const encodedPayload = btoa(JSON.stringify(payload));
        return `header.${encodedPayload}.signature`;
      }
      return null;
    });
  });

  describe('Rendering and Layout', () => {
    it('renders dashboard with correct structure', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
        expect(screen.getByTestId('header-title')).toHaveTextContent('Medical Records App');
        expect(screen.getByTestId('header-icon')).toHaveTextContent('🏥');
        expect(screen.getByTestId('header-variant')).toHaveTextContent('dashboard');
        expect(screen.getByTestId('show-back-button')).toHaveTextContent('false');
      });
    });

    it('displays welcome box by default', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Medical Records Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Manage your health information securely')).toBeInTheDocument();
        expect(screen.getByText('Hello, John Doe!')).toBeInTheDocument();
      });
    });

    it('displays dashboard stats cards', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Total Records')).toBeInTheDocument();
        expect(screen.getByText('Active Medications')).toBeInTheDocument();
        expect(screen.getAllByText('Lab Results')).toHaveLength(2); // One in stats, one in modules
        expect(screen.getAllByText('Procedures')).toHaveLength(2); // One in stats, one in modules
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('displays all module sections', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Core Medical Information')).toBeInTheDocument();
        expect(screen.getByText('Active Treatments')).toBeInTheDocument();
        expect(screen.getByText('Health Monitoring')).toBeInTheDocument();
        expect(screen.getByText('Prevention & History')).toBeInTheDocument();
        expect(screen.getByText('Additional Resources')).toBeInTheDocument();
      });
    });

    it('displays search bar', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('search');
        expect(searchInput).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading screen when patient data is loading', async () => {
      useCurrentPatient.mockReturnValue({
        patient: null,
        loading: true,
      });

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Loading your medical dashboard...')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('shows loading screen when activity is loading', async () => {
      apiService.getRecentActivity.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        renderDashboard();
      });

      expect(screen.getByText('Loading your medical dashboard...')).toBeInTheDocument();
    });

    it('shows loading screen when stats are loading', async () => {
      apiService.getDashboardStats.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        renderDashboard();
      });

      expect(screen.getByText('Loading your medical dashboard...')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('fetches recent activity on mount', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(apiService.getRecentActivity).toHaveBeenCalledTimes(1);
      });
    });

    it('fetches dashboard stats on mount', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(apiService.getDashboardStats).toHaveBeenCalledTimes(1);
      });
    });

    it('handles API errors gracefully for recent activity', async () => {
      const errorMessage = 'Failed to fetch activity';
      apiService.getRecentActivity.mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(frontendLogger.logError).toHaveBeenCalledWith(
          'Error fetching activity',
          expect.objectContaining({
            error: errorMessage,
            component: 'Dashboard',
          })
        );
      });
    });

    it('handles API errors gracefully for dashboard stats', async () => {
      const errorMessage = 'Failed to fetch stats';
      apiService.getDashboardStats.mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(frontendLogger.logError).toHaveBeenCalledWith(
          'Error fetching dashboard stats',
          expect.objectContaining({
            error: errorMessage,
            component: 'Dashboard',
          })
        );
      });
      
      // Should display fallback stats - there are multiple 0s so check for presence
      await waitFor(() => {
        expect(screen.getAllByText('0')).toHaveLength(4); // Four stat cards with 0
      });
    });

    it('displays recent activity when available', async () => {
      const mockActivity = [
        {
          description: 'Added new medication: Aspirin',
          timestamp: '2023-12-01T10:30:00Z',
        },
        {
          description: 'Updated lab results',
          timestamp: '2023-12-01T09:15:00Z',
        },
      ];
      apiService.getRecentActivity.mockResolvedValue(mockActivity);

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Added new medication: Aspirin')).toBeInTheDocument();
        expect(screen.getByText('Updated lab results')).toBeInTheDocument();
      });
    });

    it('displays no activity message when activity list is empty', async () => {
      apiService.getRecentActivity.mockResolvedValue([]);

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to correct routes when module cards are clicked', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        const patientInfoCard = screen.getByText('Patient Information');
        fireEvent.click(patientInfoCard);
        expect(mockNavigate).toHaveBeenCalledWith('/patients/me');
      });

      const medicationsCard = screen.getByText('Medications');
      fireEvent.click(medicationsCard);
      expect(mockNavigate).toHaveBeenCalledWith('/medications');

      // Get the Lab Results card from the modules section (not stats)
      const labResultsCards = screen.getAllByText('Lab Results');
      fireEvent.click(labResultsCards[1]); // Click the module card, not the stat card
      expect(mockNavigate).toHaveBeenCalledWith('/lab-results');
    });

    it('navigates when additional resource items are clicked', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        const emergencyContactsItem = screen.getByText('Emergency Contacts');
        fireEvent.click(emergencyContactsItem);
        expect(mockNavigate).toHaveBeenCalledWith('/emergency-contacts');
      });

      const exportItem = screen.getByText('Export Records');
      fireEvent.click(exportItem);
      expect(mockNavigate).toHaveBeenCalledWith('/export');
    });
  });

  describe('Admin Features', () => {
    it('shows admin dashboard for admin users', async () => {
      // Mock admin JWT token
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'token') {
          const payload = { role: 'admin' };
          const encodedPayload = btoa(JSON.stringify(payload));
          return `header.${encodedPayload}.signature`;
        }
        return null;
      });

      await act(async () => {
        renderDashboard();
      });

      // The admin status check happens asynchronously, so we need to wait for it
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('does not show admin dashboard for regular users', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });
    });

    it('handles JWT decoding errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'token') {
          return 'invalid.jwt.token';
        }
        return null;
      });

      global.atob = jest.fn(() => {
        throw new Error('Invalid base64');
      });

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(frontendLogger.logError).toHaveBeenCalledWith(
          'Error checking admin status',
          expect.objectContaining({
            component: 'Dashboard',
          })
        );
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Profile Completion Modal', () => {
    it('shows profile modal for first-time users with incomplete profiles', async () => {
      const mockAuthContext = createMockAuthContext({
        checkIsFirstLogin: jest.fn(() => true),
        shouldShowProfilePrompts: jest.fn(() => true),
      });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.getByTestId('profile-completion-modal')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('does not show profile modal for returning users', async () => {
      const mockAuthContext = createMockAuthContext({
        checkIsFirstLogin: jest.fn(() => false),
        shouldShowProfilePrompts: jest.fn(() => false),
      });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('profile-completion-modal')).not.toBeInTheDocument();
      });
    });

    it('closes profile modal when close button is clicked', async () => {
      const mockAuthContext = createMockAuthContext({
        checkIsFirstLogin: jest.fn(() => true),
        shouldShowProfilePrompts: jest.fn(() => true),
      });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.getByTestId('profile-completion-modal')).toBeInTheDocument();
      }, { timeout: 2000 });

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('profile-completion-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Welcome Box', () => {
    it('can be dismissed and persists dismissal in localStorage', async () => {
      const mockAuthContext = createMockAuthContext({ user: { id: 123, username: 'testuser' } });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.getByText('Medical Records Dashboard')).toBeInTheDocument();
      });

      const closeButton = screen.getByTitle('Close welcome message');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Medical Records Dashboard')).not.toBeInTheDocument();
        expect(localStorageMock.setItem).toHaveBeenCalledWith('welcomeBox_dismissed_123', 'true');
      });
    });

    it('respects previously dismissed state from localStorage', async () => {
      const mockAuthContext = createMockAuthContext({ user: { id: 123, username: 'testuser' } });
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'welcomeBox_dismissed_123') return 'true';
        return null;
      });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.queryByText('Medical Records Dashboard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('updates search query when typing in search input', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('search');
        fireEvent.change(searchInput, { target: { value: 'medications' } });
        expect(searchInput.value).toBe('medications');
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing patient data gracefully', async () => {
      useCurrentPatient.mockReturnValue({
        patient: null,
        loading: false,
      });

      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        // Should still render dashboard structure
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
        // Welcome box should not crash without patient data
        expect(screen.queryByText('Hello, null null!')).not.toBeInTheDocument();
      });
    });

    it('handles missing auth user gracefully', async () => {
      const mockAuthContext = createMockAuthContext({ user: null });

      await act(async () => {
        renderDashboard(mockAuthContext);
      });

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });
    });
  });

  describe('Module Cards', () => {
    it('renders all core medical information modules', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Patient Information')).toBeInTheDocument();
        expect(screen.getByText('Medications')).toBeInTheDocument();
        expect(screen.getAllByText('Lab Results')).toHaveLength(2); // One in stats, one in modules
      }, { timeout: 2000 });
    });

    it('renders all treatment modules', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Treatments')).toBeInTheDocument();
        expect(screen.getAllByText('Procedures')).toHaveLength(2); // One in stats, one in modules
      }, { timeout: 2000 });
    });

    it('renders all monitoring modules', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Vital Signs')).toBeInTheDocument();
        expect(screen.getByText('Conditions')).toBeInTheDocument();
        expect(screen.getByText('Allergies')).toBeInTheDocument();
      });
    });

    it('renders all prevention modules', async () => {
      await act(async () => {
        renderDashboard();
      });

      await waitFor(() => {
        expect(screen.getByText('Immunizations')).toBeInTheDocument();
        expect(screen.getByText('Visit History')).toBeInTheDocument();
      });
    });
  });
});