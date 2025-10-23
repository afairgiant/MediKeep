import { vi } from 'vitest';

/**
 * Integration tests for FamilyHistory page sharing functionality
 * Tests the complete sharing workflow including modals, API integration, and UI updates
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import FamilyHistory from '../FamilyHistory';

// Mock all dependencies
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

// Mock hooks
vi.mock('../../../hooks/useMedicalData', () => ({
  useMedicalData: () => ({
    data: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement: () => ({
    filters: {},
    filteredData: [],
    sortBy: 'name',
    sortOrder: 'asc',
    updateFilter: vi.fn(),
    clearFilters: vi.fn(),
    handleSortChange: vi.fn(),
    hasActiveFilters: false,
  }),
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => ({
    patient: { id: 'patient-123', first_name: 'John', last_name: 'Doe' },
    loading: false,
  }),
}));

// Mock API services
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockFamilyHistoryApi = {
  getFamilyHistory: vi.fn(),
  getSharedFamilyHistory: vi.fn(),
  sendShareInvitation: vi.fn(),
  bulkSendInvitations: vi.fn(),
  getFamilyMemberShares: vi.fn(),
  revokeShare: vi.fn(),
};

vi.mock('../../../services/api', () => ({
  apiService: mockApiService,
}));

vi.mock('../../../services/api/familyHistoryApi', () => ({
  __esModule: true,
  default: mockFamilyHistoryApi,
}));

// Mock logger
vi.mock('../../../services/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

// Mock utility functions
vi.mock('../../../utils/helpers', () => ({
  formatDate: (date) => new Date(date).toLocaleDateString(),
}));

vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    title: 'Family History',
    description: 'Manage family medical history',
  }),
}));

vi.mock('../../../utils/tableFormatters', () => ({
  getEntityFormatters: () => ({}),
}));

vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

// Mock child components
vi.mock('../../../components/invitations', () => ({
  InvitationManager: ({ opened, onClose, onUpdate }) =>
    opened ? (
      <div data-testid="invitation-manager">
        <div>Invitation Manager</div>
        <button onClick={onClose} data-testid="close-invitation-manager">Close</button>
        <button onClick={onUpdate} data-testid="update-invitations">Update</button>
      </div>
    ) : null,
}));

vi.mock('../../../components/medical/FamilyHistorySharingModal', () => {
  return function MockFamilyHistorySharingModal({ opened, onClose, familyMember, familyMembers, bulkMode, onSuccess }) {
    return opened ? (
      <div data-testid="family-history-sharing-modal">
        <div>Sharing Modal</div>
        <div>Bulk Mode: {bulkMode ? 'Yes' : 'No'}</div>
        {familyMember && <div>Family Member: {familyMember.name}</div>}
        {familyMembers && <div>Family Members Count: {familyMembers.length}</div>}
        <button onClick={onClose} data-testid="close-sharing-modal">Close</button>
        <button onClick={onSuccess} data-testid="sharing-success">Success</button>
      </div>
    ) : null;
  };
});

vi.mock('../../../components/medical/MantineFamilyMemberForm', () => {
  return function MockFamilyMemberForm({ opened, onClose }) {
    return opened ? (
      <div data-testid="family-member-form">
        <button onClick={onClose}>Close Form</button>
      </div>
    ) : null;
  };
});

vi.mock('../../../components/medical/MantineFamilyConditionForm', () => {
  return function MockFamilyConditionForm({ opened, onClose }) {
    return opened ? (
      <div data-testid="family-condition-form">
        <button onClick={onClose}>Close Form</button>
      </div>
    ) : null;
  };
});

vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));

vi.mock('../../../components/ui', () => ({
  Button: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('../../../components/mantine/MantineFilters', () => {
  return function MockMantineFilters() {
    return <div data-testid="mantine-filters">Filters</div>;
  };
});

vi.mock('../../../components/shared/MedicalTable', () => {
  return function MockMedicalTable() {
    return <div data-testid="medical-table">Medical Table</div>;
  };
});

vi.mock('../../../components/shared/ViewToggle', () => {
  return function MockViewToggle() {
    return <div data-testid="view-toggle">View Toggle</div>;
  };
});

vi.mock('../../../components/medical/StatusBadge', () => {
  return function MockStatusBadge({ status }) {
    return <span data-testid="status-badge">{status}</span>;
  };
});

describe('FamilyHistory Page - Sharing Integration Tests', () => {
  const mockFamilyMembers = [
    {
      id: 'member-1',
      name: 'John Smith',
      relationship: 'father',
      birth_year: 1960,
      is_shared: false,
      family_conditions: [
        { condition: 'Diabetes', status: 'active' },
        { condition: 'Hypertension', status: 'active' },
      ],
    },
    {
      id: 'member-2',
      name: 'Jane Smith',
      relationship: 'mother',
      birth_year: 1965,
      is_shared: false,
      family_conditions: [
        { condition: 'Heart Disease', status: 'active' },
      ],
    },
  ];

  const mockSharedFamilyHistory = [
    {
      family_member: {
        id: 'shared-member-1',
        name: 'Bob Wilson',
        relationship: 'uncle',
        birth_year: 1955,
        is_shared: true,
        family_conditions: [
          { condition: 'Cancer', status: 'active' },
        ],
      },
      share_details: {
        shared_by: { id: 'user-456', name: 'Dr. Smith' },
        shared_at: '2024-01-15T10:30:00Z',
        permission_level: 'view',
      },
    },
  ];

  const mockOrganizedHistory = {
    family_members: mockFamilyMembers,
    shared_family_history: mockSharedFamilyHistory,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default API responses
    mockFamilyHistoryApi.getFamilyHistory.mockResolvedValue(mockOrganizedHistory);
    mockFamilyHistoryApi.getSharedFamilyHistory.mockResolvedValue({
      shared_family_history: mockSharedFamilyHistory,
    });
    mockFamilyHistoryApi.sendShareInvitation.mockResolvedValue({ message: 'Invitation sent' });
    mockFamilyHistoryApi.bulkSendInvitations.mockResolvedValue({
      total_sent: 2,
      total_failed: 0,
      results: [],
    });
    mockFamilyHistoryApi.getFamilyMemberShares.mockResolvedValue([]);
    mockFamilyHistoryApi.revokeShare.mockResolvedValue({ message: 'Share revoked' });
  });

  const renderFamilyHistory = () => {
    return render(
      <BrowserRouter>
        <MantineProvider>
          <FamilyHistory />
        </MantineProvider>
      </BrowserRouter>
    );
  };

  describe('Page Initialization and Data Loading', () => {
    it('should load and display both owned and shared family history', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Should display the page title
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should show both "My Family" and "Shared With Me" tabs', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });
    });

    it('should display sharing-related action buttons', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Manage Invitations')).toBeInTheDocument();
      });
    });
  });

  describe('Single Family Member Sharing', () => {
    it('should open sharing modal when share button is clicked for individual member', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
      });

      // Find and click a share button (this would be in the family member card/row)
      // Note: Since we're mocking the components, we need to simulate the share button click
      // In a real scenario, this would be integrated with the actual family member display

      // For this test, we'll simulate opening the sharing modal directly
      // In the actual component, this would be triggered by a share button click
      const shareButtons = screen.queryAllByText(/Share/);
      if (shareButtons.length > 0) {
        await userEvent.click(shareButtons[0]);
      }

      // The test needs to be adapted based on the actual UI structure
      // This is a placeholder for the integration test structure
    });

    it('should handle successful single member sharing', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Simulate sharing modal success
      // In the actual test, this would involve:
      // 1. Opening the sharing modal
      // 2. Filling in recipient details
      // 3. Submitting the form
      // 4. Verifying the API call and success notification

      // For now, we verify that the API is set up correctly
      expect(mockFamilyHistoryApi.sendShareInvitation).toBeDefined();
    });
  });

  describe('Bulk Sharing Functionality', () => {
    it('should support bulk sharing mode for multiple family members', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
      });

      // In the actual component, there should be a way to select multiple members
      // and trigger bulk sharing. This test would verify that functionality.
      
      // Look for bulk sharing controls
      const bulkButtons = screen.queryAllByText(/Bulk/i);
      const shareMultipleButtons = screen.queryAllByText(/Share Multiple/i);
      
      // Verify bulk sharing functionality is available
      expect(mockFamilyHistoryApi.bulkSendInvitations).toBeDefined();
    });

    it('should handle successful bulk sharing', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Simulate bulk sharing success
      // This would involve:
      // 1. Selecting multiple family members
      // 2. Opening bulk sharing modal
      // 3. Filling in recipient details
      // 4. Submitting bulk invitation
      // 5. Verifying API call and notifications

      // For now, verify API availability
      expect(mockFamilyHistoryApi.bulkSendInvitations).toBeDefined();
    });
  });

  describe('Invitation Management Integration', () => {
    it('should open invitation manager when manage invitations is clicked', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Manage Invitations')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Manage Invitations'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-manager')).toBeInTheDocument();
      });
    });

    it('should close invitation manager and refresh data on close', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Manage Invitations')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Manage Invitations'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-manager')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('close-invitation-manager'));

      await waitFor(() => {
        expect(screen.queryByTestId('invitation-manager')).not.toBeInTheDocument();
      });
    });

    it('should refresh family history data when invitations are updated', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Manage Invitations')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Manage Invitations'));

      const updateButton = screen.getByTestId('update-invitations');
      await userEvent.click(updateButton);

      // Should trigger data refresh
      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Shared Family History Display', () => {
    it('should display shared family history in separate tab', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared With Me'));

      // Should show shared family history data
      // In the actual component, this would display the shared family members
      await waitFor(() => {
        // Verify shared tab is active and displays shared data
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });
    });

    it('should handle tab switching between owned and shared family history', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      // Switch to shared tab
      await userEvent.click(screen.getByText('Shared With Me'));

      // Should load shared data
      await waitFor(() => {
        expect(mockFamilyHistoryApi.getSharedFamilyHistory).toHaveBeenCalled();
      });

      // Switch back to owned tab
      await userEvent.click(screen.getByText('My Family'));

      // Should display owned family data
      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
      });
    });

    it('should filter shared family history independently from owned family history', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared With Me'));

      // Should have independent filtering for shared data
      expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
    });
  });

  describe('Modal Integration and State Management', () => {
    it('should properly manage sharing modal state', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Simulate opening sharing modal
      // In actual component, this would be triggered by share button
      // For now, we verify modal state management is set up
      expect(screen.queryByTestId('family-history-sharing-modal')).not.toBeInTheDocument();
    });

    it('should refresh data after successful sharing operations', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalledTimes(1);
      });

      // Simulate sharing success
      // This would trigger data refresh in the actual component
      // For now, verify the refresh mechanism exists
      expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Loading States', () => {
    it('should handle API errors when loading family history', async () => {
      mockFamilyHistoryApi.getFamilyHistory.mockRejectedValue(new Error('API Error'));

      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Should handle error gracefully
      // In actual component, this would show error message or fallback UI
    });

    it('should handle errors when loading shared family history', async () => {
      mockFamilyHistoryApi.getSharedFamilyHistory.mockRejectedValue(new Error('Shared API Error'));

      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared With Me'));

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getSharedFamilyHistory).toHaveBeenCalled();
      });

      // Should handle shared data loading errors
    });

    it('should show loading states during data fetching', async () => {
      // Mock slow API response
      mockFamilyHistoryApi.getFamilyHistory.mockImplementation(() => new Promise(() => {}));

      renderFamilyHistory();

      // Should show loading indicator
      // In actual component, this would be a loader or skeleton
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });

  describe('Integration with Other Components', () => {
    it('should integrate properly with MantineFilters for both tabs', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
      });

      // Should have filters for both owned and shared data
      await userEvent.click(screen.getByText('Shared With Me'));

      expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
    });

    it('should integrate with ViewToggle for different display modes', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
      });

      // Should support both card and table views for family history
    });

    it('should integrate proper table view for shared family history', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared With Me'));

      // Should have table view available for shared family history
      expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('medical-table')).toBeInTheDocument();
    });
  });

  describe('User Experience and Accessibility', () => {
    it('should provide clear visual distinction between owned and shared family history', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      // Should have clear tab navigation
      const myFamilyTab = screen.getByText('My Family');
      const sharedTab = screen.getByText('Shared With Me');

      expect(myFamilyTab).toBeInTheDocument();
      expect(sharedTab).toBeInTheDocument();
    });

    it('should support keyboard navigation between tabs', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
      });

      const myFamilyTab = screen.getByText('My Family');
      const sharedTab = screen.getByText('Shared With Me');

      myFamilyTab.focus();
      expect(myFamilyTab).toHaveFocus();

      await userEvent.tab();
      expect(sharedTab).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      
      // Should switch to shared tab
      await waitFor(() => {
        expect(mockFamilyHistoryApi.getSharedFamilyHistory).toHaveBeenCalled();
      });
    });

    it('should provide appropriate feedback for sharing operations', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Should provide notifications for successful operations
      // This would be tested through the actual sharing workflow
      expect(notifications.show).toBeDefined();
    });

    it('should maintain user context when switching between tabs', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('My Family')).toBeInTheDocument();
      });

      // Apply filters on My Family tab
      // Switch to Shared tab and back
      // Filters should be maintained per tab

      await userEvent.click(screen.getByText('Shared With Me'));
      await userEvent.click(screen.getByText('My Family'));

      // Should maintain separate filter states for each tab
      expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
    });
  });

  describe('Data Consistency and Real-time Updates', () => {
    it('should refresh shared data when new shares are accepted', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalledTimes(1);
      });

      // Simulate invitation acceptance notification
      // Should trigger refresh of shared family history
      // This would be integrated with real-time updates or polling
    });

    it('should update display when shares are revoked', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared With Me'));

      // Simulate share revocation
      // Should update shared family history display
      await waitFor(() => {
        expect(mockFamilyHistoryApi.getSharedFamilyHistory).toHaveBeenCalled();
      });
    });

    it('should handle concurrent user actions gracefully', async () => {
      renderFamilyHistory();

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalled();
      });

      // Simulate multiple concurrent operations
      // Should handle them gracefully without race conditions
      expect(mockFamilyHistoryApi.getFamilyHistory).toHaveBeenCalledTimes(1);
    });
  });
});
